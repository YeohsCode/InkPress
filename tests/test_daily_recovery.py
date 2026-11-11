import json
from pathlib import Path
import ssl
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

from pipeline.sources.common import fetch
from scripts.send_feishu_daily import digest, full_text, prepare, send, main


class DailyRecoveryTest(unittest.TestCase):
    def test_tls_fallback_keeps_verification(self):
        error = urllib.error.URLError(ssl.SSLError('BLOCK_CIPHER_PAD_IS_WRONG'))
        with patch('pipeline.sources.common.urllib.request.urlopen', side_effect=error), \
                patch('pipeline.sources.common.subprocess.check_output', return_value=b'<rss/>') as curl:
            self.assertEqual(fetch('https://www.latent.space/feed'), b'<rss/>')
            self.assertNotIn('--insecure', curl.call_args.args[0])
            self.assertIn('--proto-redir', curl.call_args.args[0])

    def test_http_errors_do_not_trigger_tls_fallback(self):
        error = urllib.error.HTTPError('https://example.com', 404, 'missing', {}, None)
        with patch('pipeline.sources.common.urllib.request.urlopen', side_effect=error), \
                patch('pipeline.sources.common.subprocess.check_output') as curl:
            with self.assertRaises(urllib.error.HTTPError):
                fetch('https://example.com')
            curl.assert_not_called()

    def test_text_uses_report_date_and_all_reference_shapes(self):
        report = {'date': '2026-10-12', 'cover': {'title_lines': ['AI', '游戏']},
                  'cards': [{'title': '验收', 'points': ['原文事实。']}],
                  'references': [{'title': '作者', 'url': 'https://example.com/a'},
                                 '讨论 https://example.com/b']}
        text = full_text(report)
        for expected in ['2026-10-12', 'https://example.com/a', 'https://example.com/b']:
            self.assertIn(expected, text)

    def test_changed_report_and_image_block_delivery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / 'report.json'
            report.write_text(json.dumps({'date': '2026-10-12', 'cards': [{'title': '事实'}],
                                          'references': ['https://example.com']}))
            image = root / 'cover.png'
            image.write_bytes(b'image')
            manifest = {'date': '2026-10-12', 'report_sha256': digest(report),
                        'images': [{'name': 'cover.png', 'sha256': digest(image)}]}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            self.assertEqual(prepare(report, root)[2], ['cover.png'])
            image.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, '图片已变动'):
                prepare(report, root)
            image.write_bytes(b'image')
            report.write_text(report.read_text() + '\n')
            with self.assertRaisesRegex(ValueError, '稿件不一致'):
                prepare(report, root)

    def test_nonzero_exit_is_not_a_receipt(self):
        results = [subprocess.CompletedProcess([], 1, 'not sent', ''),
                   subprocess.CompletedProcess([], 0, 'sent to feishu', '')]
        with patch('scripts.send_feishu_daily.subprocess.run', side_effect=results) as run, \
                patch('scripts.send_feishu_daily.time.sleep'):
            self.assertEqual(send([], {}), 'sent to feishu')
            self.assertEqual(run.call_count, 2)

    def test_timeout_does_not_retry_uncertain_delivery(self):
        with patch('scripts.send_feishu_daily.subprocess.run',
                   side_effect=subprocess.TimeoutExpired('hermes', 120)) as run:
            with self.assertRaisesRegex(RuntimeError, '状态不明'):
                send([], {})
            self.assertEqual(run.call_count, 1)

    def test_negative_success_output_is_not_a_receipt(self):
        results = [subprocess.CompletedProcess([], 0, 'not sent', ''),
                   subprocess.CompletedProcess([], 0, 'sent to feishu', '')]
        with patch('scripts.send_feishu_daily.subprocess.run', side_effect=results), \
                patch('scripts.send_feishu_daily.time.sleep'):
            self.assertEqual(send([], {}), 'sent to feishu')

    def test_archived_issue_uses_its_own_verified_images_and_receipts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            issue = root / 'issues/topic'
            images = issue / 'images'
            images.mkdir(parents=True)
            report_path = issue / 'report.json'
            report_path.write_text(json.dumps({
                'date': '2026-11-04', 'cover': {'title_lines': ['专题，', '第二版']},
                'cards': [{'title': '原文事实', 'points': ['经过核实的事实。']}],
                'references': ['https://example.com/source']}))
            image = images / 'cover.png'
            image.write_bytes(b'archived image')
            (images / 'manifest.json').write_text(json.dumps({
                'date': '2026-11-04', 'report_sha256': digest(report_path),
                'images': [{'name': image.name, 'sha256': digest(image)}]}))
            argv = ['sender', '--report', str(report_path), '--image-dir', str(images),
                    '--delivery-id', 'editorial-v2']
            with patch('scripts.send_feishu_daily.ROOT', root), \
                    patch('sys.argv', argv), \
                    patch('scripts.send_feishu_daily.send', return_value='sent') as deliver:
                main()
                self.assertEqual(deliver.call_count, 2)
                self.assertIn('MEDIA:' + str(image.resolve()), deliver.call_args_list[0].args[0])
                self.assertIn('1/1 专题，第二版', deliver.call_args_list[0].args[0])
                main()
                self.assertEqual(deliver.call_count, 2)  # Same issue resumes without duplicates.
                receipts = list((root / 'data/delivery').glob('*editorial-v2.json'))
                self.assertEqual(len(receipts), 1)
                self.assertEqual(set(json.loads(receipts[0].read_text())['sent']), {'img1', 'text'})

    def test_layout_history_is_written_only_after_complete_delivery(self):
        report = {'date': '2026-11-11', 'cover': {'title_lines': ['测试']},
                  'cards': [{'title': '测试', 'points': ['事实。']}], 'references': []}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            argv = ['sender', '--report', str(root/'report.json'), '--image-dir', str(root/'images')]
            with patch('scripts.send_feishu_daily.ROOT', root), \
                 patch('scripts.send_feishu_daily.prepare', return_value=(report, 'abcdef', ['cover.png'])), \
                 patch('scripts.send_feishu_daily.archive_plan') as archive, \
                 patch('scripts.send_feishu_daily.send', return_value='sent') as deliver:
                with patch('sys.argv', argv+['--dry-run']):
                    main()
                archive.assert_not_called()
                deliver.assert_not_called()
                with patch('sys.argv', argv+['--images-only']):
                    main()
                archive.assert_not_called()
                with patch('sys.argv', argv), patch('scripts.send_feishu_daily.send', side_effect=RuntimeError('failure')):
                    with self.assertRaises(RuntimeError):
                        main()
                archive.assert_not_called()
                with patch('sys.argv', argv):
                    main()
                archive.assert_called_once_with(report, 'abcdef', root/'data/layout-history')


if __name__ == '__main__':
    unittest.main()
