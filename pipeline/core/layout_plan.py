"""Inspect content-led page plans and compare recent issues without rotating templates."""
import argparse
import datetime
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
VARIANTS = json.loads(Path(__file__).with_name('editorial_variants.json').read_text())


def edition(report):
    return 'weekly' if report.get('edition') == 'weekly' or re.search(r'\bweekly\b|周报|周刊', report.get('series', ''), re.I) else 'daily'


def validate_plan(report):
    problems = []
    planned = report.get('design', {}).get('planning_version') == 1
    if report.get('design', {}).get('style') != 'editorial':
        return problems
    for i, card in enumerate(report.get('cards', [])):
        design = card.get('design', {})
        layout, variant = design.get('layout'), design.get('variant', 'standard')
        visual = card.get('visual') if isinstance(card.get('visual'), dict) else {}
        prefix = f'[cards[{i}].design]'
        if layout and layout not in VARIANTS:
            problems.append(f'{prefix} 未知 layout: {layout}')
        elif layout and variant not in VARIANTS[layout]:
            problems.append(f'{prefix} {layout} 不支持 variant={variant}')
        if layout == 'process' and variant == 'rail' and visual.get('layout') != 'flow':
            problems.append(f'{prefix} process:rail 需要明确的 flow 流程图')
        if planned:
            for key in ('layout', 'variant', 'intent', 'rationale'):
                if not isinstance(design.get(key), str) or not design[key].strip():
                    problems.append(f'{prefix} 页面计划缺 {key}')
            if visual.get('kind') == 'diagram' and not visual.get('layout'):
                problems.append(f'{prefix} 机制图须明确 visual.layout，不能让通用关系图代替真实机制')
    return problems


def snapshot(report, fingerprint, origin='delivered'):
    return dict(date=report['date'], edition=edition(report), report_sha256=fingerprint, origin=origin,
                pages=[dict(page=i + 1, title=c['title'], layout=c.get('design', {}).get('layout'),
                            variant=c.get('design', {}).get('variant', 'standard'),
                            intent=c.get('design', {}).get('intent', ''),
                            rationale=c.get('design', {}).get('rationale', ''))
                       for i, c in enumerate(report['cards'])])


def archive_plan(report, fingerprint, directory=None, origin='delivered'):
    if report.get('design', {}).get('style') != 'editorial':
        return
    directory = Path(directory) if directory else ROOT / 'data/layout-history'
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"{report['date']}-{edition(report)}-{fingerprint[:16]}.json"
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot(report, fingerprint, origin), ensure_ascii=False, indent=2))
    temporary.replace(target)


def recent_plans(report, directory):
    plans = []
    for file in Path(directory).glob('*.json'):
        try:
            plan = json.loads(file.read_text())
            if plan['edition'] == edition(report) and plan['date'] < report['date']:
                plans.append(plan)
        except (ValueError, KeyError):
            continue
    # One comparison issue per date; prefer delivered over authored draft evidence.
    latest = {}
    for plan in sorted(plans, key=lambda p: (p['date'], p.get('origin') == 'delivered')):
        latest[plan['date']] = plan
    return sorted(latest.values(), key=lambda p: p['date'], reverse=True)[:3]


def review(report, history):
    pages = snapshot(report, '')['pages']
    warnings = []
    signature = lambda p: (p['layout'], p['variant'])
    for a, b in zip(pages, pages[1:]):
        if signature(a) == signature(b):
            warnings.append(f"本期 p{a['page']}–p{b['page']} 同构：{signature(a)}；检查密度、图幅与阅读任务是否确有需要")
    if len(history) >= 2:
        for i, page in enumerate(pages):
            if page['layout'] == 'cover':
                continue
            if all(len(p['pages']) > i and signature(p['pages'][i]) == signature(page) for p in history):
                warnings.append(f"p{i+1} 连续 {len(history)+1} 期沿用 {signature(page)}；按本期内容复核，勿按页码套用")
    return warnings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', nargs='?', type=Path, default=ROOT / 'data/report.json')
    parser.add_argument('--history', type=Path, default=ROOT / 'data/layout-history')
    parser.add_argument('--recent', choices=['daily', 'weekly'], help='Show recent plans before drafting the next issue')
    args = parser.parse_args()
    report = (dict(date=(datetime.date.today()+datetime.timedelta(days=1)).isoformat(),
                   edition=args.recent, cards=[]) if args.recent else json.loads(args.report.read_text()))
    history = recent_plans(report, args.history)
    for plan in history:
        print(f"近期 {plan['date']} [{plan.get('origin', 'unknown')}]: " + ' / '.join(
            f"p{p['page']} {p['layout']}:{p['variant']}（{p['title']}）" for p in plan['pages']))
    if args.recent:
        if not history:
            print('尚无可用的同刊历史，不能声称已完成跨期对照。')
        return
    for page in snapshot(report, '')['pages']:
        print(f"p{page['page']} {page['layout']}:{page['variant']} | {page['intent']} | {page['rationale']}")
    for warning in review(report, history):
        print('REVIEW ' + warning)
    problems = validate_plan(report)
    for problem in problems:
        print('ERROR ' + problem)
    if problems:
        raise SystemExit(1)
    print('页面计划有效；REVIEW 是编辑复核提示，不要求机械换版或添加无关配图。')


if __name__ == '__main__':
    main()
