"""HTML → PNG 卡片渲染器（替代单调 PIL 版）。

设计（2026-09-22 用户反馈：布局/色彩太单调）：
- 每页 = 1242×1656 HTML 卡片，CSS 变量控制主题色，色彩分层（背景渐变/强调色块/标签 chips）
- 封面大字 + accent 词高亮；内容页：章节标签 chip + 标题 + 分段正文 + 关键数字高亮
- 支持每卡可选配图 card.image（本地路径或 URL），无图自动排版补位
- 截图用 HermesAgent 自带 node playwright（chromium），设备缩放 2x
- 图片不带参考资料 ref（ref 只进正文，见 report.json.references）

用法: node pipeline/core/render_html.js [report.json路径]

当前杂志模式：`report.design.style = "editorial"`。阅读 `EDITORIAL_DESIGN.md`，先写连续文章与页面计划。
每页 `design.layout` 选择 cover / atlas / plate / maps / process / data / source / essay / closing。
明确页面计划优先于 visual 的通用模板；图片、单栏、局部左右结构与数据页可以共存。
`illustration` 是独立的概念插画类型，必须有图片及含「插画」的图注，不能用于数据页。
封面艺术区域允许叠字；原始图表和其他证据图仍完整显示、禁止文字遮盖。
旧双栏排版是兼容回退，不是所有新稿的设计标准。全部回归：`node --test tests/*.js`。

2026-11-04：无图页统一使用内容驱动的双栏正文，字号在 20–42px 内按可用空间调整，
保留全部 points，避免旧 steps/verify 等布局在没有图片时仍预留一栏。
标题自动平衡断行。图形检查核对声明与实际数量、解码、可见尺寸、裁切与页面边界。
先等待字体和图片解码，再排版截图；本地素材优先相对稿件目录解析，兼容项目根目录路径。

每批先在临时目录渲染，全部成功后再整体替换输出目录及 manifest；失败保留旧成品，
成功时移除旧的多余页，同一输出目录禁止并发渲染。不要为过检查而删正文或去掉配图。
专题可直接隔离输出，不必备份/覆盖日报：
`node pipeline/core/render_html.js data/issues/<slug>/report.json --out-dir data/issues/<slug>/images`。
最终检查全部页或联系图，有疑点放大复检；只看首末页不能发现中间页空栏。
回归检查：`node --test tests/test_render_*.js`。

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

专题投递（不替换当日日报）：
`python3 scripts/send_feishu_daily.py --report data/issues/<slug>/report.json --image-dir data/issues/<slug>/images --dry-run`
校验通过后去掉 `--dry-run` 投递整套图片与全文。`--delivery-id <name>` 用于明确要求重发的独立批次；
同一批次重跑仍跳过已有成功回执。不要用新 ID 绕过超时或状态不明的消息。


Weekly 与 Daily 使用同一渲染器与发送器。周报建议设置 `edition: "weekly"`、`series: "Yeoh's AI Weekly"`；
校验器也识别 series 中的 Weekly/周报/周刊。周报要求 editorial、明确的逐页 layout，以及有主视觉的 cover 首卡。
atlas/maps/process/data/source 等图文页必须有对应 visual；纯文字页明确 essay。data 页可省略 design.feature，
此时不会渲染空的主数字区域。刊头自动选择周报刊名。diagram 的 flow 用于有方向的顺序流程。
周报独立输出至 `data/issues/<date>-weekly/`，发送用上述 --report / --image-dir，不调用固定12页的旧脚本。

"""

### 内容编排与跨期对照

新稿使用 `design.planning_version: 1`，每卡声明 `design.layout/variant/intent/rationale`。支持的组合来自 `editorial_variants.json`，语义与用法见 `EDITORIAL_DESIGN.md`。`python3 -m pipeline.core.layout_plan --recent daily`（或 weekly）查看近期编排；`python3 -m pipeline.core.layout_plan <report>` 校验计划并提示相邻、跨期同构。提示用于编辑判断，不按日期或页码轮换。整期发送成功后自动记录不含投递目标的布局历史，预览和部分发送不冒充已发期号。
