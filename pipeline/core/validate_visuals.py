"""Evidence contracts for figures; semantic source review remains editorial work."""
import datetime
import math
import re


def number_in_evidence(number, excerpt, unit):
    """Keep natural Chinese copy while checking the chart's explicit unit conversion."""
    if re.search(rf"(?<![\d.]){re.escape(f'{number:g}')}(?![\d.])", excerpt):
        return True
    if unit == "百万次训练样本":
        for scale, suffix in ((100, "万"), (0.01, "亿")):
            value = f"{number * scale:.10g}"
            if re.search(rf"(?<![\d.]){re.escape(value)}\s*{suffix}\s*次\s*(?:训练\s*)?样本", excerpt):
                return True
    return False


def validate_dates(report):
    value = report.get("date", "")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError
        datetime.date.fromisoformat(value)
    except (TypeError, ValueError):
        return ["[date] 期号日期必须是有效的 YYYY-MM-DD"]
    problems = []
    kicker = report.get("cover", {}).get("kicker", "")
    for year, month, day in re.findall(r"(\d{4})[.年/-](\d{1,2})[.月/-](\d{1,2})日?", kicker):
        if f"{year}-{int(month):02}-{int(day):02}" != value:
            problems.append("[cover.kicker] 刊头日期与 report.date 不一致")
    return problems


def validate_visuals(report):
    from .layout_plan import validate_plan
    problems = validate_plan(report)
    editorial = report.get("design", {}).get("style") == "editorial"
    weekly = report.get("edition") == "weekly" or bool(re.search(r"\bweekly\b|周报|周刊", report.get("series", ""), re.I))
    if weekly:
        if not editorial:
            problems.append("[design.style] 周报须使用 editorial 图文系统")
        cards = report.get("cards", [])
        if not cards or cards[0].get("design", {}).get("layout") != "cover":
            problems.append("[cards[0].design.layout] 周报首张须为有主视觉的 cover，不能用普通正文页充当封面")
        for ci, card in enumerate(cards):
            if not card.get("design", {}).get("layout"):
                problems.append(f"[cards[{ci}].design.layout] 周报需明确每页版式")
    urls = set()
    for ref in report.get("references", []):
        urls.update(re.findall(r"https?://[^\s<>\"）)]+", ref.get("url", "") if isinstance(ref, dict) else str(ref)))
    for ci, card in enumerate(report.get("cards", [])):
        prefix = f"[cards[{ci}].visual]"
        visual = card.get("visual")
        image = card.get("design", {}).get("figure") or card.get("image")
        layout = card.get("design", {}).get("layout") if editorial else None
        needs_visual = {"cover", "atlas", "plate", "maps", "process", "data", "source", "closing"}
        if layout in needs_visual and not visual:
            problems.append(f"{prefix} {layout} 版式需要配图，不能保留空白图栏；纯文字页请明确选择 essay")
        if not visual:
            if image:
                problems.append(f"{prefix} 配图缺证据说明：需 kind、source_url、caption、evidence")
            continue
        if not isinstance(visual, dict):
            problems.append(f"{prefix} 必须是对象")
            continue
        allowed = {"cover": {"photo", "illustration"}, "maps": {"diagram"},
                   "process": {"diagram"}, "data": {"bars", "source_chart"},
                   "source": {"source_chart"}, "plate": {"photo", "illustration", "source_chart"},
                   "closing": {"photo", "illustration", "source_chart"}, "essay": set()}
        if layout in allowed and visual.get("kind") not in allowed[layout]:
            problems.append(f"{prefix} {layout} 版式与 visual.kind 不匹配")
        kind = visual.get("kind")
        if kind not in {"bars", "diagram", "source_chart", "photo", "illustration"}:
            problems.append(f"{prefix} 未知 kind")
        if visual.get("source_url") not in urls:
            problems.append(f"{prefix} source_url 必须对应 references 中的原文链接")
        if not isinstance(visual.get("caption"), str) or not visual["caption"].strip():
            problems.append(f"{prefix} 缺可见图注 caption")
        copy = "\n".join([card.get("title", ""), *card.get("points", [])])

        def evidence(item, where):
            excerpt = item.get("evidence")
            if not isinstance(excerpt, str) or not excerpt.strip() or excerpt not in copy:
                problems.append(f"{prefix} {where} evidence 必须逐字对应本页正文")
                return ""
            return excerpt

        evidence(visual, "")
        if card.get("content_type") == "data" and kind not in {"bars", "source_chart"}:
            problems.append(f"{prefix} 数据页必须使用数据图或原始图表")
        if kind in {"source_chart", "photo", "illustration"} and not image:
            problems.append(f"{prefix} 原图/照片缺 image 或 design.figure")
        if kind in {"bars", "diagram"} and image:
            problems.append(f"{prefix} 自绘图不得同时指定外部 image/design.figure")
        if kind == "photo" and "示意" not in visual.get("caption", ""):
            problems.append(f"{prefix} 照片图注必须标明示意")
        if kind == "illustration":
            if "插画" not in visual.get("caption", ""):
                problems.append(f"{prefix} 概念插画图注必须标明插画，不能冒充实证图表")
            if report.get("design", {}).get("style") != "editorial":
                problems.append(f"{prefix} 概念插画使用 editorial 版式")
        if kind == "diagram" and report.get("design", {}).get("style") == "editorial":
            if visual.get("layout") not in {None, "maps", "constellation", "views", "flow"}:
                problems.append(f"{prefix} 未知示意图 layout")
        if kind == "bars":
            panels = visual.get("panels")
            if not isinstance(panels, list) or not 1 <= len(panels) <= 3:
                problems.append(f"{prefix} bars 需要 1–3 组 panels")
                continue
            for pi, panel in enumerate(panels):
                if not isinstance(panel, dict):
                    problems.append(f"{prefix} panel 必须是对象")
                    continue
                rows = panel.get("rows")
                if not panel.get("title") or not panel.get("unit") or not isinstance(rows, list) or not 1 <= len(rows) <= 8:
                    problems.append(f"{prefix} panel 需 title、unit 和 1–8 行 rows")
                    continue
                for ri, row in enumerate(rows):
                    if not isinstance(row, dict):
                        problems.append(f"{prefix} row 必须是对象")
                        continue
                    excerpt = evidence(row, f"panels[{pi}].rows[{ri}]").replace(",", "")
                    if not row.get("label"):
                        problems.append(f"{prefix} row 缺 label")
                    for field in ("value", "max_value"):
                        if field == "max_value" and field not in row:
                            continue
                        number = row.get(field)
                        if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or number < 0:
                            problems.append(f"{prefix} {field} 必须为非负有限数字")
                        elif not number_in_evidence(number, excerpt, panel.get("unit")):
                            problems.append(f"{prefix} {field}={number} 未出现在本行正文证据中")
                    if isinstance(row.get("max_value"), (int, float)) and isinstance(row.get("value"), (int, float)) and row["max_value"] < row["value"]:
                        problems.append(f"{prefix} max_value 不能小于 value")
        if kind == "diagram":
            nodes = visual.get("nodes")
            if not isinstance(nodes, list) or not 2 <= len(nodes) <= 5:
                problems.append(f"{prefix} diagram 需要 2–5 个 nodes")
                continue
            if visual.get("layout") == "views" and len(nodes) != 3:
                problems.append(f"{prefix} views 示意需要两个描述与一个共同场景，共3个 nodes")
            for node in nodes:
                if not isinstance(node, dict) or not node.get("label"):
                    problems.append(f"{prefix} node 必须含 label")
                    continue
                evidence(node, "node")
    return problems
