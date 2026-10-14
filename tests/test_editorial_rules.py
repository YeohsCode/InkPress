"""Regression checks for removed daily columns and the Latent Space collector."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline.core.digest import SOURCES, EDITORIAL_RULES
from pipeline.core.validate_text import validate, load_valid_report
from pipeline.sources import latent_space, rssbase


class EditorialRulesTest(unittest.TestCase):
    def setUp(self):
        self.report = {
            "cover": {"title_lines": ["Claude Code 的变化"], "kicker": "访谈观察"},
            "cards": [{"title": "权限边界仍需由系统控制", "points": ["研究团队公布了实验细节。"]}],
            "references": [{"url": "https://www.latent.space/p/thariq"}],
        }

    def test_removed_columns_and_renamed_headings(self):
        for title in ["跟你有什么关系", "跟我有什么关系", "与你有什么关系", "接下来干什么",
                      "接下来该做什么", "对你有什么影响", "接下来看两件事", "下一步", "行动建议"]:
            with self.subTest(title=title):
                report = copy.deepcopy(self.report)
                report["cards"][0]["title"] = title
                self.assertTrue(validate(report))

    def test_all_visible_copy_fields_are_checked(self):
        for field in ["title", "tag", "side_label", "points"]:
            with self.subTest(field=field):
                report = copy.deepcopy(self.report)
                report["cards"][0][field] = ["接下来干什么"] if field == "points" else "接下来干什么"
                self.assertTrue(validate(report))
        for field in ["title_lines", "kicker"]:
            report = copy.deepcopy(self.report)
            report["cover"][field] = ["跟你有什么关系"] if field == "title_lines" else "跟你有什么关系"
            self.assertTrue(validate(report))

    def test_event_analysis_remains_allowed(self):
        self.report["cards"][0]["points"] = ["接下来模型会调用工具。权限检查决定请求能否通过。"]
        self.assertEqual([], validate(self.report))

    def test_delivery_loader_rejects_removed_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            path.write_text(json.dumps(self.report))
            self.assertEqual(self.report, load_valid_report(path))
            self.report["cards"][0]["title"] = "接下来看两件事"
            path.write_text(json.dumps(self.report))
            with self.assertRaisesRegex(ValueError, "停止投递"):
                load_valid_report(path)

    def test_source_registered_and_editorial_rules_carried(self):
        self.assertIn("latent_space", SOURCES)
        self.assertIn("接下来干什么", EDITORIAL_RULES["removed_sections"])

    def test_rss_window_and_dedup(self):
        fixture = """<rss><channel>
        <item><title>New episode</title><link>https://www.latent.space/p/new</link>
        <guid>new</guid><pubDate>Sat, 10 Oct 2026 00:00:00 GMT</pubDate></item>
        <item><title>Old episode</title><link>https://www.latent.space/p/old</link>
        <guid>old</guid><pubDate>Tue, 29 Sep 2026 00:00:00 GMT</pubDate></item>
        </channel></rss>"""
        with patch.object(rssbase, "fetch_text", return_value=fixture) as fetch, \
             patch("pipeline.sources.common.time.time", return_value=1791594000), \
             patch.object(rssbase.store, "is_new", return_value=True), \
             patch.object(rssbase.store, "mark_seen") as mark:
            result = rssbase.run(latent_space.SOURCE, latent_space.FEED_URL, 1)
            fetch.assert_called_once_with(latent_space.FEED_URL, timeout=40)
            self.assertEqual(["new"], [i["item_id"] for i in result["items"]])
            self.assertEqual(1, result["new_count"])
            mark.assert_called_once_with("latent_space", ["new"])


if __name__ == "__main__":
    unittest.main()
