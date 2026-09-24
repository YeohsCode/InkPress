# 任务：重做小红书日报的卡片排版设计（render_html.js 设计系统 v4）

你现在在 `/Users/andrewyeoh/Werk/projects/content-pipeline` 仓库里工作。这个项目每天自动产出 9 页 1242×1656（小红书 3:4）的中文科技日报图文，渲染链是 `data/report.json` → `pipeline/core/render_html.js`（node + playwright 截图）→ `data/images/html/*.png`。

## 背景：为什么重做（用户三轮否决，必须读完再动工）

用户是唯一验收人，已经连续否决三轮：

1. v1：米白渐变背景 + 两颗低透明度装饰圆 + 左侧色条 + 大圆角阴影图。评价："布局色彩太单调"。
2. v2：加了 4 种版式（hero/side/top/below），但骨架仍是"标题→段落墙→配图"。评价："所有图片布局都是上图下文，没有动态、灵活一点的方案吗"。
3. v3（当前 HEAD）：换了皮肤（素纸背景 #F7F5F2 + 顶部强调色细线 + 扁平图 + 细线页脚），骨架没变。评价：**"排版没有任何提升，还有一张里的图片没了，整体越来越退步"**。

**v3 的已知 bug（必须修）**：`pickLayout()` 对无图卡片返回 `'text'`，但 `cardHTML()` 的 if/else 链没有 `text` 分支——无图卡片掉进 else（top 版式）渲染 `<img src="undefined">`，页面上是一个空白图框。9/24 刊第 9 页（P9）因此配图丢失。修复后 `grep -c 'undefined' data/images/html/*.html` 必须为 0，且 P9 渲染出的 png 里不能有空白图框。

## 你要做什么

**重新设计 `pipeline/core/render_html.js` 的排版系统（v4），目标是"高级移动端新闻单页"，不是"PPT 卡片"。**

### 硬性设计要求（验收逐条对照）

1. **打破"标题→段落墙→配图"的固定骨架**。每一页的结构必须由内容决定，至少实现并真实使用以下版式语言：
   - **数据卡**：本刊数字密集（13.42ms、5961 星、378/378、395 题/秒 这类），把关键数字做成大号数字+小标签的 stat 块（如 2-4 个并排），段落文字退居次要。report.json 的 card 可携带 `stats: [{value, label}]` 字段（本刊暂无，用正则从 points 里抽取数字生成也行，但不要臆造数字）。
   - **引语/要点前置**：把每段的第一句抽成大号 lede 或 pull-quote 放在标题下，正文续在后面——模拟新闻 App 的 "kicker + lede + body" 三层结构。
   - **编号/步骤感**：有的卡片本质是列表（如"三条 checkpoint"），就用编号行（01/02/03 大号序号+短行文字）替代段落墙。
   - **图文交织**：图不再只占一整块——可以做图占 55% 高度+文字环绕式留白、或图在底部出血（full-bleed 到页面左右边缘 0 边距）等，4 种以上真实差异化的整页构图。
2. **排版细节**：
   - 标题用衬线中文（本机有 Songti SC，`fc-list` 可查路径；Songti.ttc 在 /System/Library/Fonts/Supplemental/），正文保持 PingFang SC——衬线大标题 + 无衬线正文是新闻 App 的经典搭配。
   - 页面留白要大方：左右边距 ≥88px，元素间垂直节奏统一（建议 8px 网格）。
   - 颜色克制：背景纸色 + 一个主强调色 #C8442A + 次强调 #1F5F7A，灰阶分层，彩色只出现在数字/高亮/细线。
   - 每页必须有页码和系列名页脚，但视觉要轻。
3. **渲染健壮性（全部保留，别弄丢）**：
   - 实测自适应缩字循环：截图前量 `.fitbody` 的 scrollHeight-clientHeight，溢出就降字号重测（下限 20px，最多 8 轮）。这是 9/24 底部截断事故的修复，必须保留并对每种版式生效。
   - `em.en` 高亮必须是相对字号（0.9em），不能写死 px（38px 写死导致过整页行高膨胀把末段顶出页面的旧事故）。
   - 单遍 tokenize 的 richText()（数字/英文高亮）原样保留。
   - 无图卡片绝不能渲染 img 标签。
4. **不改的东西**：`data/report.json` 的 9 张卡内容一字不动（这是今天已发的刊）；`validate_text.py` 不动；输出仍是 `cover.png + info_02..09.png` 到 `data/images/html/`。

### 自测（必须真跑，不要停在理论上）

1. `node pipeline/core/render_html.js` 全量渲染 9 页成功。
2. `grep -c 'src="undefined"' data/images/html/*.html` → 全部 0。
3. 用 playwright 对每页截图前先在页面里执行检查：每页 `.fitbody` 无溢出、`.title` 存在、页脚存在。把检查结果打印到 stdout。
4. 9 张 png 全部生成，逐张用文件大小 sanity check（空白页通常 <100KB，正常版面 >300KB）。
5. 每完成一个阶段 git commit（先 commit 一次初始状态也行）。

### 交付

- 修好的 `pipeline/core/render_html.js`（一个文件搞定，不要新增依赖；playwright 从 `/Users/andrewyeoh/Werk/HermesAgent/code/node_modules/playwright` require，照抄现有写法）。
- 渲染出的 9 张新 png。
- 一段 ≤10 行的总结：改了什么结构、每页用了哪种版式、自测结果。
- commit message: `render: design v4 - content-driven editorial layouts, serif titles, stat blocks; fix text-layout img bug`

### 环境提示

- node 22，playwright 已装（见上）。
- 字体：Songti SC（衬线标题）、PingFang SC（正文）都在系统里，直接 font-family 引用即可。
- 不要起长驻服务；渲染脚本跑完即退。
- 若自适应缩字循环反复失败，跳过该页截图并报告，不要死循环。
