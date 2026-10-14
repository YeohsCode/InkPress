#!/usr/bin/env python3
"""Validate rendered issue, then deliver via Hermes with resumable receipts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from pipeline.core.validate_text import load_valid_report


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def full_text(report):
    title = '，'.join(report['cover']['title_lines'])
    lines = [f"{report.get('series', 'AI 圈每天深读')} · {report['date']}｜{title}", '']
    for card in report['cards']:
        lines.extend([card['title'], *card['points'], ''])
    lines.append('参考资料：')
    for ref in report['references']:
        lines.append(f"{ref.get('title', '来源')}：{ref['url']}" if isinstance(ref, dict) else ref)
    if report.get('tags'):
        lines.extend(['', ' '.join('#' + tag for tag in report['tags'])])
    lines.extend(report.get('source_notes', []))
    if report.get('quality_check'):
        check = report['quality_check']
        lines.extend(['', '文案自检：' + ' / '.join(map(str, check['scores'])) +
                      f"，合计 {check['total']}/30。" + check['evidence']])
    return '\n'.join(lines)


def prepare(report_path, image_dir):
    report = load_valid_report(report_path)
    fingerprint = digest(report_path)
    manifest = json.loads((image_dir / 'manifest.json').read_text())
    expected = ['cover.png'] + [f'info_{i:02}.png' for i in range(2, len(report['cards']) + 1)]
    if (manifest['report_sha256'] != fingerprint or manifest['date'] != report['date'] or
            [image['name'] for image in manifest['images']] != expected):
        raise ValueError('渲染结果与稿件不一致，请重新渲染')
    for image in manifest['images']:
        if digest(image_dir / image['name']) != image['sha256']:
            raise ValueError('图片已变动，请重新渲染：' + image['name'])
    return report, fingerprint, expected


def send(args, env):
    for attempt in range(2):
        try:
            result = subprocess.run(['hermes', 'send', *args], capture_output=True,
                                    text=True, timeout=120, env=env)
            output = result.stdout + result.stderr
            if result.returncode == 0 and re.search(r'\bsent\b', output, re.I):
                return output.strip()
            error = output.strip()[-500:]
        except subprocess.TimeoutExpired:
            # A timeout may already have delivered; avoid an automatic duplicate.
            raise RuntimeError('发送超时，送达状态不明，停止以避免重复投递')
        if attempt == 0:
            time.sleep(3)
    raise RuntimeError(error)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--images-only', action='store_true', help='Deliver a revised layout without repeating the article text')
    parser.add_argument('--pages', nargs='+', type=int, help='Deliver only these numbered image pages')
    args = parser.parse_args()
    report, fingerprint, images = prepare(ROOT / 'data/report.json', ROOT / 'data/images/html')
    chat = os.environ.get('FEISHU_DAILY_CHAT', 'feishu:oc_4f6f0ec40c6b9fb609ed619bfa60f659')
    if not chat.startswith('feishu:'):
        chat = 'feishu:' + chat
    title = '，'.join(report['cover']['title_lines'])
    if args.pages is not None and any(number < 1 or number > len(images) for number in args.pages):
        parser.error(f'--pages must be between 1 and {len(images)}')
    selected_pages = set(args.pages) if args.pages is not None else set(range(1, len(images) + 1))
    items = [(f'img{i}', ['--to', chat, '-s', f'{i}/{len(images)} {title}',
                         'MEDIA:' + str(ROOT / 'data/images/html' / name)])
             for i, name in enumerate(images, 1) if i in selected_pages]
    if not args.images_only and args.pages is None:
        items.append(('text', ['--to', chat, '-s', f"{report['date']} 全文文案", full_text(report)]))
    if args.dry_run:
        print(f"PASS {report['date']}：{len(selected_pages)} 张图{' + 全文' if not args.images_only and args.pages is None else ''}；稿件、图片哈希一致")
        return
    receipt_dir = ROOT / 'data/delivery'
    receipt_dir.mkdir(exist_ok=True)
    target_hash = hashlib.sha256(chat.encode()).hexdigest()[:12]
    receipt_path = receipt_dir / f"{report['date']}-{fingerprint[:16]}-{target_hash}.json"
    receipts = json.loads(receipt_path.read_text()) if receipt_path.exists() else {
        'date': report['date'], 'report_sha256': fingerprint, 'chat': chat, 'sent': {}}
    env = {key: value for key, value in os.environ.items()
           if not key.startswith('HERMES_CRON_AUTO_DELIVER')}
    for label, send_args in items:
        if label in receipts['sent']:
            print(label, 'already sent', flush=True)
            continue
        receipts['sent'][label] = send(send_args, env)
        temporary = receipt_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(receipts, ensure_ascii=False, indent=2))
        temporary.replace(receipt_path)
        print(label, 'sent', flush=True)
    print('PASS 全部投递完成，回执：' + str(receipt_path))


if __name__ == '__main__':
    main()
