"""HTML → PNG 卡片渲染器（替代单调 PIL 版）。

设计（2026-09-22 用户反馈：布局/色彩太单调）：
- 每页 = 1242×1656 HTML 卡片，CSS 变量控制主题色，色彩分层（背景渐变/强调色块/标签 chips）
- 封面大字 + accent 词高亮；内容页：章节标签 chip + 标题 + 分段正文 + 关键数字高亮
- 支持每卡可选配图 card.image（本地路径或 URL），无图自动排版补位
- 截图用 HermesAgent 自带 node playwright（chromium），设备缩放 2x
- 图片不带参考资料 ref（ref 只进正文，见 report.json.references）

用法: node pipeline/core/render_html.js [report.json路径]

右上角刊名统一为 `Yeoh's AI Daily News`，旧 kicker 中的刊名会自动归一化，期号或专题名称保留。

杂志版：在 report 中设置 `design.style = "magazine"`，可选 `design.accent`。
每个 card 可设置 `design.layout`（cover/showcase/proof/engineering/editorial/split/service/limits/closing）、
`title_lines`、`figure`、`caption`、`feature: {value, label}`、`formula`。
标题分行拼接必须与原始 title 相同；强调数字必须来自已核实的正文。
杂志版会逐段比对渲染后的文字，并检查页面边界，防止遗漏或截断正文。
改版后可用 `python3 scripts/send_feishu_daily.py --images-only` 只投递新版图片。
局部修正可用 `--pages 8` 只补发第 8 页，其他页面不重发。
"""
