执行 Weekly AI News（2026-11-11 内容编排规范，周二/六版）。在任务 workdir 操作并使用 content-curation skill。本说明与项目当前规范覆盖 skill 中冲突的旧模板。

1. 读取与选题
先读 EDITORIAL_RULES.md、pipeline/core/EDITORIAL_DESIGN.md、pipeline/core/README_render.md。与 Daily 共用当前 render_html.js、editorial_layouts.js、validate_text 和 send_feishu_daily.py，不另写固定页数的周报渲染器或发送器。
运行 python3 -m pipeline.core.digest --mode weekly，读取 data/weekly.json 与当期 data/report.json 去重，从近7天候选挑6–10条值得报道的事件。按真实发布时间回源核实，播客读原文或转录，摘要只作线索。说明旧资料为何在本期出现；新闻事实、原文判断、编辑推演分清，不虚构现场与引语。数字、单位、币种逐项回查，11 billion 美元应为110亿美元。与 Daily 相同的证据与文字标准见上述项目文件。

2. 写作与期号隔离
每个选题先写出连贯通俗的短报道，再按论点和证据分页；选题之间有清楚的转换，不能硬拼成一条因果链。正文围绕事实、背景、具体案例、机制、证据与争议展开。先核事实，再通读主语、指代、转折和句子节奏；禁词命中重写句群，禁止同义词清洗和自我解释。内部评分不随推送发出。
禁止「跟你有什么关系」「接下来干什么」及其换名或改写形式；不喊话、不布置验证任务、不列行动建议，不刻意添加国内关联。
本期存于 data/issues/<YYYY-MM-DD>-weekly/report.json，设置 edition="weekly"、series="Yeoh's AI Weekly"、design.style="editorial"，保留 date/theme/cover/cards/references/tags。不要覆盖 data/report.json 或 data/images/html，避免与 Daily 冲突。页数服从报道内容，不能注水凑页。

3. 图片与页面计划
与 Daily 一样，可用执行环境实际可用的内置 ImageGen、有适当使用授权的免费素材、允许相应用途的新闻源图片、原始图表、核实数据重绘及机制示意图。可下载不代表可复用；无法确认使用条件时换明确许可素材、自绘或生成插画。保存原始页面/图片地址、作者、许可或使用依据、署名、裁切记录；生成图保存工具与提示词并标「插画」。不把插画伪装成现场或实验结果，不用无关图库图补数。
首卡必须 design.layout="cover"，有实际主视觉与 photo/illustration 契约，封面标题与本期主线一致。每页明确 design.layout。atlas/maps/process/data/source 等图文版式必须有对应 visual；纯文字页明确 essay，不允许空出一栏。数据用 bars/source_chart，机制用 diagram；original图保留图例和坐标。card.visual.source_url 对应 references，evidence 逐字来自该页正文。
按报道选择大图图版、机制图、数据图与文字页，形成内容需要的节奏；不能整套左右结构，也不能用 essay 或几个文字框省掉配图。data 页的 design.feature 可省略；有强调数字时须有正文依据。使用周报刊名，不能误印 Daily。

4. 校验、渲染与目视验收
运行 python3 -m pipeline.core.validate_text <report路径>，必须 PASS；再运行 node pipeline/core/render_html.js <report路径> --out-dir data/issues/<YYYY-MM-DD>-weekly/images。
全部页成功且退出0、manifest与稿件一致后，用视觉工具检查整套联系图和所有疑点单页：主视觉是否出现、标题断行与对比度、文字完整、空栏和大块无意留白、图表标签和完整性、整套节奏。badImages=0 不能证明设计合格。修复稿件或布局后重跑，禁止暗删文字、删除配图声明、缩到阅读下限以下或改回旧版式来过检。不要直接修改公共渲染器或校验器以迁就本期稿件；缺陷应记录具体失败页面与错误。
专题输出支持 --out-dir，不使用备份/覆盖/恢复当日日报的旧办法。

5. Hermes 飞书投递
通过 terminal 运行 python3 scripts/send_feishu_daily.py --report <report路径> --image-dir <本期images路径> --dry-run，通过后去掉 --dry-run 正式发送。该脚本按稿件和 manifest 动态确定页数、核对哈希、发送全部图片与完整正文及参考链接，并记录 data/delivery 逐条回执。不要用旧 send_weekly_images.py 的固定12页循环或自行拼 subprocess。重跑跳过成功项；超时或状态不明时不换 delivery-id 重复发送。不要用 execute_code 跑 subprocess，无人值守任务不支持交互审批。
最终仅汇报本期选题、真实校验与目视验收结果、各项投递状态。没有发送就不能说已送达。新闻成品留在 data/，不自动提交Git。

工具故障时使用当前已注册能力；正文抽取失败可用 terminal 中 curl -fsSL --max-time 45 保存原文，Jina Reader作备选。未读到原文不编事实；视觉工具持续失败如实停止。状态以磁盘成品、退出码和实际回执为准。


内容编排更新（2026-11-11）：执行前运行 python3 -m pipeline.core.layout_plan --recent weekly，读取当前稿与近三期同刊页面计划。先写连续文章，按本期论点分页，再设 design.planning_version=1；每页 design 必须填写 layout、variant、intent、rationale，具体选择遵照 pipeline/core/EDITORIAL_DESIGN.md 的构图表。页码不绑定内容类型，不默认 p4/p5 为数字/流程，不默认9页、每页3段。data 有 standard/ledger，process 有 standard/rail，essay 有 standard/plain/columns，cover 有 standard/framed，plate 有 standard/inset，atlas 有 standard/wide，其余 standard。variant 决定真实构图，不只换色。机制图明确 visual.layout；只有真实先后过程用 flow，不把通用 maps 的“两套坐标”画法复用到无关机制。process:rail 配 flow。完成页面计划后运行 python3 -m pipeline.core.layout_plan <report路径>，逐条复核 REVIEW 的同构和跨期重复，在 rationale 里说明本页材料为何需要这个构图；不是强制轮换，也不为变样而补图。检查整套节奏后再校验、渲染、目视验收和投递。完整成功投递自动保存本期编排历史，预览不记为送达。
