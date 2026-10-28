"""HTML → PNG 卡片渲染器（替代单调 PIL 版）。

设计（2026-09-22 用户反馈：布局/色彩太单调）：
- 每页 = 1242×1656 HTML 卡片，CSS 变量控制主题色，色彩分层（背景渐变/强调色块/标签 chips）
- 封面大字 + accent 词高亮；内容页：章节标签 chip + 标题 + 分段正文 + 关键数字高亮
- 支持每卡可选配图 card.image（本地路径或 URL），无图自动排版补位
- 截图用 HermesAgent 自带 node playwright（chromium），设备缩放 2x
- 图片不带参考资料 ref（ref 只进正文，见 report.json.references）

用法: node pipeline/core/render_html.js [report.json路径]

封面正文限制在页面网格内，长标题使用较小字号；引语页的配图参与正常排版，正文与照片各占独立区域。
出图前逐个检查文字片段是否越过页脚、被祖先容器裁切或横向溢出。普通版式还检查文字是否叠到图片上；
杂志版保留有遮罩的图片叠字设计。检查失败则该页不出图，整个渲染命令失败。
排版回归检查：`node --test tests/test_render_audit.js`。

2026-10-28：取消「至少四张配图」要求。无图稿件可以通过；指定 `image` 或
`design.figure` 的卡片必须提供下述 `visual` 来源与证据。数据页声明
`content_type: "data"`，只允许 `bars` 或 `source_chart`。

```json
{
  "title": "月贡献变化",
  "content_type": "data",
  "points": ["8月427次，9月301次。"],
  "visual": {
    "kind": "bars",
    "source_url": "https://example.com/original",
    "caption": "按原文数字重绘，单位为次贡献。",
    "evidence": "8月427次",
    "panels": [{
      "title": "月贡献", "unit": "次贡献",
      "rows": [
        {"label": "8月", "value": 427, "evidence": "8月427次"},
        {"label": "9月", "value": 301, "evidence": "9月301次"}
      ]
    }]
  }
}
```

`source_url` 必须与 references 内某一原文 URL 一致，`evidence` 必须逐字来自本页
title/points。`bars` 支持 1–3 个 panel，各自独立零基线；每组 1–8 行，`value`
为非负有限数字。范围用 `value` 与 `max_value`，两端必须在本行 evidence 中出现。
图形直接从这些值生成，不另选外部曲线。缺测月份不画成连续序列。

`source_chart` 使用 `card.image` 或 `design.figure`，完整 contain 显示原图；
`diagram` 使用 2–5 个 `nodes: [{label, detail, evidence}]`（detail 可省略），
每个节点也需本页证据。`photo` 必须在 caption 标明「示意」，不能用于数据页。
bars/diagram 不得另指定 image/figure。所有 visual 卡片采用独立的图表版式，
刊头、图形、可见图注和正文各占一块区域，保留并核对全部 points。
重叠检查包括刊头、图注和图内文字；杂志模式也不能覆盖受保护图表。

自动校验可拦截缺来源、数字不在正文证据中、悬空引用、无效日期与刊头日期冲突；
不能判断任意外部图片的真实内容，也不能证明标签和解释正确。编辑仍须回源逐页核对。
期号使用 report.date，按年月日直接排版，避免 UTC 日期转本地时区后错一天。
正文发布日期和数据截止日不参与刊头日期匹配，差异应在图注说明。

回归检查：`python3 -m unittest discover -s tests -v`。

右上角刊名统一为 `Yeoh's AI Daily News`，旧 kicker 中的刊名会自动归一化，期号或专题名称保留。

杂志版：在 report 中设置 `design.style = "magazine"`，可选 `design.accent`。
每个 card 可设置 `design.layout`（cover/showcase/proof/engineering/editorial/split/service/limits/closing）、
`title_lines`、`figure`、`caption`、`feature: {value, label}`、`formula`。
标题分行拼接必须与原始 title 相同；强调数字必须来自已核实的正文。
杂志版会逐段比对渲染后的文字，并检查页面边界，防止遗漏或截断正文。
改版后可用 `python3 scripts/send_feishu_daily.py --images-only` 只投递新版图片。
局部修正可用 `--pages 8` 只补发第 8 页，其他页面不重发。
"""
