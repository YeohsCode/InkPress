import copy
import unittest

from pipeline.core.validate_text import validate


class VisualEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.report = {
            "date": "2026-10-28", "cover": {"title_lines": ["贡献数的变化"], "kicker": "2026.10.28"},
            "cards": [{"title": "月贡献变化", "content_type": "data", "points": ["8月427次，9月301次。"]}],
            "references": [{"url": "https://example.com/source"}],
        }
        self.visual = {
            "kind": "bars", "source_url": "https://example.com/source", "caption": "按原文数字重绘。",
            "evidence": "8月427次", "panels": [{"title": "月贡献", "unit": "次",
                "rows": [{"label": "8月", "value": 427, "evidence": "8月427次"},
                         {"label": "9月", "value": 301, "evidence": "9月301次"}]}],
        }

    def test_no_photo_quota(self):
        self.report["cards"] *= 9
        self.assertEqual([], validate(self.report))

    def test_editorial_illustration_is_distinct_from_data_evidence(self):
        report = copy.deepcopy(self.report)
        report['design'] = {'style': 'editorial'}
        card = report['cards'][0]
        card.pop('content_type')
        card['image'] = 'https://example.com/illustration.png'
        card['visual'] = dict(kind='illustration', source_url='https://example.com/source',
                              caption='AI 概念插画', evidence='8月427次')
        self.assertEqual([], validate(report))
        card['content_type'] = 'data'
        self.assertTrue(any('数据页必须' in p for p in validate(report)))
        card.pop('content_type')
        card['visual']['caption'] = '这是真实实验结果'
        self.assertTrue(any('插画' in p for p in validate(report)))

    def test_chart_unit_conversion_does_not_force_awkward_copy(self):
        card = self.report['cards'][0]
        card['points'] = ['新方法用2160万次训练样本，另一方法用9亿次样本。']
        card['visual'] = dict(kind='bars', source_url='https://example.com/source',
            caption='统一换算为百万次训练样本。', evidence=card['points'][0],
            panels=[dict(title='样本数', unit='百万次训练样本', rows=[
                dict(label='新方法', value=21.6, evidence='新方法用2160万次训练样本'),
                dict(label='另一方法', value=900, evidence='另一方法用9亿次样本')])])
        self.assertEqual([], validate(self.report))
        card['visual']['panels'][0]['rows'][0]['value'] = 216
        self.assertTrue(any('value=216' in p for p in validate(self.report)))
        card['visual']['panels'][0]['rows'][0]['value'] = 21.6
        card['points'][0] = card['points'][0].replace('2160万次训练样本', '2160万元')
        card['visual']['evidence'] = card['points'][0]
        card['visual']['panels'][0]['rows'][0]['evidence'] = '新方法用2160万元'
        self.assertTrue(any('value=21.6' in p for p in validate(self.report)))

    def test_unreviewed_stock_image_and_design_override_are_blocked(self):
        for field in ("image", "design"):
            report = copy.deepcopy(self.report)
            report["cards"][0][field] = "https://images.unsplash.com/unrelated" if field == "image" else {"figure": "https://images.unsplash.com/unrelated"}
            self.assertTrue(any("配图缺证据" in p for p in validate(report)))

    def test_numbers_must_match_the_specific_row_evidence(self):
        self.report["cards"][0]["visual"] = copy.deepcopy(self.visual)
        self.assertEqual([], validate(self.report))
        row = self.report["cards"][0]["visual"]["panels"][0]["rows"][0]
        for value in (319, 301, 27, -1, float("nan"), True):
            row["value"] = value
            with self.subTest(value=value):
                self.assertTrue(any("value" in p for p in validate(self.report)))

    def test_ranges_and_evidence_provenance(self):
        self.report["cards"][0]["points"] = ["完整年份有40到46天，部分年份有18天。"]
        visual = copy.deepcopy(self.visual)
        visual["evidence"] = "完整年份有40到46天"
        visual["panels"][0]["rows"] = [{"label": "完整年份", "value": 40, "max_value": 46, "evidence": visual["evidence"]}]
        self.report["cards"][0]["visual"] = visual
        self.assertEqual([], validate(self.report))
        visual["source_url"] = "https://example.com/not-reviewed"
        self.assertTrue(any("source_url" in p for p in validate(self.report)))
        visual["source_url"] = "https://example.com/source"
        visual["panels"][0]["rows"][0]["evidence"] = "一段未出现在正文的证据"
        self.assertTrue(any("逐字对应" in p for p in validate(self.report)))

    def test_data_page_rejects_a_photo_even_with_metadata(self):
        card = self.report["cards"][0]
        card["image"] = "https://images.unsplash.com/unrelated"
        card["visual"] = dict(kind="photo", source_url="https://example.com/source", caption="办公桌示意图", evidence="8月427次")
        self.assertTrue(any("数据页必须" in p for p in validate(self.report)))

    def test_dangling_references_in_copy_caption_and_diagram(self):
        self.report["cards"][0]["visual"] = copy.deepcopy(self.visual)
        for marker in ("（见文末）", "(见文末)", "见 文 末", "详见参考资料", "参见文章末尾"):
            for field in ("points", "caption", "label"):
                report = copy.deepcopy(self.report)
                if field == "points":
                    report["cards"][0]["points"][0] += marker
                elif field == "caption":
                    report["cards"][0]["visual"]["caption"] = marker
                else:
                    report["cards"][0]["visual"]["panels"][0]["rows"][0]["label"] = marker
                with self.subTest(marker=marker, field=field):
                    self.assertTrue(any("悬空引用" in p for p in validate(report)))

    def test_issue_date_is_valid_and_matches_the_cover(self):
        for value in (None, "2026-02-30", "2026-2-3", "yesterday"):
            self.report["date"] = value
            self.assertTrue(any("[date]" in p for p in validate(self.report)))
        self.report["date"] = "2026-10-27"
        self.assertTrue(any("刊头日期" in p for p in validate(self.report)))


if __name__ == "__main__":
    unittest.main()
