执行 Daily AI News（2026-11-06 图文编辑规范）。在任务 workdir 中操作，使用 content-curation skill；以下新规则覆盖旧 skill 中冲突的固定模板与配图要求。

1. 选题与回源
运行 python3 -m pipeline.core.digest --mode daily。读取 EDITORIAL_RULES.md、pipeline/core/EDITORIAL_DESIGN.md、pipeline/core/README_render.md 及 data/daily.json，挑一个值得深写的事件。先读当前 data/report.json，避免重复选题，再回源核对原始报道、论文或节目转录。RSS 与搜索摘要只能作线索。写明真实发布日期，旧论文不能写成当天新闻；人名、数字、单位与比较条件逐项核对。不得虚构现场、引语或实验细节。不刻意添加国内关联。

2. 先写文章，再分页面
先写出一篇连续、通俗、读得通的报道，沿事实、背景、案例、机制、证据与争议推进。编辑分两遍：先核事实和论证，再通读主语、指代、转折、句子节奏与比喻。用具体名词和动词解释概念，一个主要比喻足够；删掉自我解释和空泛口号。禁词命中时重写整个句群，不能只换同义词。评分仅供内部编辑，不能替代通读，也不在正文后贴自评分。
禁止恢复「跟你有什么关系」「接下来干什么」及其换名或改写形式，包括「对你有什么影响」「下一步」「行动建议」。结尾继续讲事件，不喊话、不布置验证任务，不靠固定栏目凑页数。
写入 data/report.json，包含 date、theme、cover、cards、references、tags。通常9页，封面与首卡合一；按实际内容分页，不能为页数注水。每条 references 带真实原文链接；标题数字与正文一致。每页 points 是完整段落，段数按论证决定。

3. 图片选择与出处
取消配图配额不等于省掉图片。为选题寻找承担叙事、解释或气氛的主视觉和内页配图；允许有意的纯文字页，禁止无图空栏和全套文字框冒充配图。
可使用：执行环境实际可用的内置 ImageGen；具有适当使用授权的免费照片或插画；允许相应用途的新闻源图片；原始论文图表；依据核实数据重绘的图表及机制示意图。不能仅因图片可下载就推定可复用；无法确认使用条件时换有明确许可的素材、自绘或生成插画。
为本期素材保存出处记录（如 data/issues/<date>-<slug>/assets/credits.json）：文件、原始页面及图片地址、作者/机构、许可或使用依据、所需署名、裁切改动。生成插画保存工具及提示词，图注明确「插画」；不得伪装成现场照片或实验结果。图片URL需实际验证且人工查看内容，不能凭记忆编造。环境无 ImageGen 时使用其他可用素材途径，不声称已调用。
填写完整 card.visual；source_url 对应 references，evidence 逐字来自本页正文。数据页声明 content_type=data，用 bars/source_chart；机制示意用 diagram；概念插画用 illustration。bars/diagram 不填写外部 image。原始图表完整显示，保留图例、坐标、单位和截止日期；插画不充当数据证据，不用无关图库照片补数。百万、亿、十亿的换算与指标口径逐项核对。

4. 页面设计与校验
使用 design.style="editorial"，为每页选 design.layout（cover/atlas/plate/maps/process/data/source/essay/closing）。依内容组织大图、原图图版、关系图、数据页、单栏文章和收尾；不要机械轮换，也不能全部做成左右结构。封面概念插画允许有意叠字，但图表、刊头、图注不能互相遮挡。旧兼容双栏不是新稿默认审美。
运行 python3 -m pipeline.core.validate_text，必须 PASS；再运行 node pipeline/core/render_html.js。渲染必须退出0且 manifest 页数与稿件一致。整批成功才更新成品，失败应保留上一批。修复源稿或布局，不允许排版器暗删正文、缩到阅读下限以下或删除配图声明来过检。
用视觉工具检查全部页面或整套联系图，有疑点放大单页：主视觉确实出现、标题对比度和断行、正文完整、图幅与留白、图表标签和读图顺序、整套节奏。badImages=0 只说明已声明图片未加载失败。工具持续失败时记录具体错误并停止，不得冒充已检查。

5. Hermes 飞书投递
通过 terminal 运行 python3 scripts/send_feishu_daily.py --dry-run，核对稿件与图片哈希；通过后运行 python3 scripts/send_feishu_daily.py，发送全部图片与全文。以 data/delivery 中逐条成功回执为准；同一稿件重跑会跳过成功项。发送失败如实记录，超时或状态不明时不自动重复。不要用 execute_code 跑 subprocess，无人值守任务不支持交互审批。
专题另存 data/issues/<date>-<slug>/report.json，并用 render_html.js <report> --out-dir <images> 及 send_feishu_daily.py --report <report> --image-dir <images> 隔离处理，不覆盖当日日报。
最终只汇报选题理由、真实校验和视觉检查结果、逐条投递状态；不重复全文，不把尚未发送的内容说成已送达。新闻正文与图片留在 data/，不因日常运行自动提交 Git。

执行故障处理：网页工具以当前已注册能力为准；正文抽取失败时可在 terminal 用 curl -fsSL --max-time 45 保存原文，Jina Reader 作备选。浏览器端口拒绝连接后不要反复重试。未读到原文不得编写确定事实。最终状态以磁盘成品、退出码和实际回执为准。

Daily 与 Weekly 的共同执行约束（2026-11-09）：日常生产仅编辑本期稿件和素材，不为迁就稿件而修改公共渲染器、校验器或 content-curation skill。缺陷须记录具体页面与报错。atlas/maps/process/data/source 等图文版式必须有对应 visual；纯文字页明确 essay，不能保留空栏。Weekly 的稿件和图片已独立存放，Daily 保持当前默认路径。
