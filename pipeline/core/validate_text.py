"""文案校验器：对 data/report.json 逐项扫 AI 味/禁用格式，返回违规清单。

规则来源（交叉验证）：
- `humanize` skill references/29-patterns.md（blader/humanizer, Wikipedia AI-signs）
- `humanizer` skill（同源参考备份）
- `carousel-copywriting` skill 去 GPT味段（无 emoji、禁"不是…而是…"、结尾不提问不指路）
- 用户 2026-09-22 逐字指令：禁"但……是……"对照格式、禁"……为什么该……"、
  禁"中国人为什么该看/为什么中国人"话术；结尾带参考资料 ref（正文有、图片无）。

用法:
    python3 -m pipeline.core.validate_text            # 校验 data/report.json
    python3 -m pipeline.core.validate_text path.json  # 校验指定文件
退出码 0 = 通过；1 = 有违规（打印全部命中）。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── 硬禁格式（regex，命中即违规）────────────────────────────────────────
HARD_BANS = [
    # 用户 2026-09-22 指令
    (r"但[^。！？，]{0,30}是[，。：]",
     "禁用「但……是……」对照句式"),
    (r"为什么该|为什么中国人|中国人为什么",
     "禁用「为什么该/中国人为什么」话术"),
    (r"值得注意的是|值得一提的是|不难发现|综上所述|总而言之",
     "拔高/总结套话（humanize 中文禁词表）"),
    (r"首先[^。]{10,}其次",
     "「首先…其次…」三连结构"),
    (r"不是[^。！？]{2,20}[，,][^。！？]{0,6}而是",
     "「不是…而是…」句式（carousel-copywriting 禁）"),
    (r"看似[^。]{2,20}[，,]实则",
     "「看似…实则…」假深刻"),
    (r"不仅[^。]{2,20}[，,][^。！？]{0,4}而且",
     "「不仅…而且…」负并列"),
    (r"让我们|接下来让我们|一起来看| dive in|深入剖析|深度解析|赋能|打造",
     "元解说/客服腔/AI 高频词"),
    (r"——|――",
     "em dash（humanize §14 硬约束，中文可用逗号/句号替代）"),
    (r"[\U0001F300-\U0001FAFF\u2705\u274C\u26A1\U0001F525]",
     "emoji（正文与图片文字均禁）"),
    (r"你猜|猜猜看|想知道吗|吗？\s*$",
     "提问式钩子/结尾（carousel 禁提问式结尾）"),
    (r"点[了再看]|关注|点赞|收藏起来|转发给",
     "指路式/求互动结尾（carousel 禁指路式结尾）"),
]

# 收藏类文案允许的提示词（若命中上条“收藏起来”但属于以上短语则仍禁）
REF_LINE = re.compile(r"^参考资料|^来源|^Refs?[:：]|^参考[:：]")


def _iter_fields(report):
    """产出 (位置标签, 文本)"""
    cover = report.get("cover", {})
    for i, ln in enumerate(cover.get("title_lines", [])):
        yield f"cover.title_lines[{i}]", ln
    if cover.get("kicker"):
        yield "cover.kicker", cover["kicker"]
    for ci, card in enumerate(report.get("cards", [])):
        yield f"cards[{ci}].title", card.get("title", "")
        for pi, p in enumerate(card.get("points", [])):
            yield f"cards[{ci}].points[{pi}]", p


def validate(report):
    problems = []
    for where, text in _iter_fields(report):
        for pat, msg in HARD_BANS:
            m = re.search(pat, text)
            if m:
                problems.append(f"[{where}] {msg}: 「…{m.group(0)[:40]}…」")
    # ref 要求：正文（最后推送的文本版）应有参考资料，但不进图片字段
    # report.json 本身不渲染 ref；ref 存在 report['references']（正文推送用）
    if not report.get("references"):
        problems.append("[report] 缺 references 字段（正文结尾需带参考资料，图片不带）")
    return problems


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "report.json")
    with open(path, encoding="utf-8") as f:
        report = json.load(f)
    problems = validate(report)
    if problems:
        print(f"FAIL {len(problems)} 处违规：")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("PASS 文案校验通过（无禁用格式/话术，references 已配）")


if __name__ == "__main__":
    main()
