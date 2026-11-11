import copy
import json
from pathlib import Path
import tempfile
import unittest
from pipeline.core.layout_plan import archive_plan, recent_plans, review, snapshot, validate_plan


class LayoutPlanTest(unittest.TestCase):
    def setUp(self):
        self.report = dict(date='2026-11-11', design=dict(style='editorial', planning_version=1), cards=[
            dict(title='机制', points=['先发布，再核验。'], design=dict(layout='process', variant='rail',
                 intent='解释', rationale='四步发布链条竖排，正文解释权限差异。'), visual=dict(kind='diagram', layout='flow'))])

    def test_explicit_content_plan_and_supported_compositions(self):
        self.assertEqual([], validate_plan(self.report))
        for field in ('layout', 'variant', 'intent', 'rationale'):
            report = copy.deepcopy(self.report)
            del report['cards'][0]['design'][field]
            self.assertTrue(any(field in p for p in validate_plan(report)))
        self.report['cards'][0]['design']['variant'] = 'ledger'
        self.assertTrue(any('不支持' in p for p in validate_plan(self.report)))

    def test_mechanism_cannot_silently_fall_back_to_generic_map(self):
        del self.report['cards'][0]['visual']['layout']
        self.assertTrue(any('机制图须明确' in p for p in validate_plan(self.report)))

    def test_history_compares_editions_and_dates_without_forcing_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            for day in ('2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'):
                prior = {**self.report, 'date': day}
                archive_plan(prior, day, directory)
                archive_plan({**prior, 'edition': 'weekly'}, day, directory)
            history = recent_plans(self.report, directory)
            self.assertEqual(['2026-11-10', '2026-11-09', '2026-11-08'], [p['date'] for p in history])
            self.assertTrue(any('连续 4 期' in p for p in review(self.report, history)))
            self.assertEqual([], validate_plan(self.report))
            self.report['cards'][0]['design']['variant'] = 'standard'
            self.assertEqual([], review(self.report, history))
            self.assertEqual(10, len(list(Path(directory).glob('*.json'))))

    def test_legacy_issue_is_readable_and_history_does_not_contain_delivery_targets(self):
        self.report['design'].pop('planning_version')
        self.report['cards'][0]['design'] = dict(layout='process')
        self.assertEqual([], validate_plan(self.report))
        plan = snapshot(self.report, 'fingerprint')
        self.assertNotIn('chat', plan)
        self.assertEqual('standard', plan['pages'][0]['variant'])
