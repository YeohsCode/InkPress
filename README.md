# InkPress 墨刊

**A one-person editorial pipeline for Chinese technology stories.** It gathers English-language signals, supports the selection and verification of one story, and typesets the finished Chinese essay as a Xiaohongshu (RED) carousel.

**一条面向中文科技深读的单人编辑流水线。**它收集英文信源，辅助挑选和核实一个值得讲的故事，再把完成的中文文章排成小红书轮播图。

[English](#english) · [中文](#中文)

## English

### Why it exists

Technology news moves faster than a reader can follow. Headline lists and short summaries often skip the evidence, mechanism, and consequences that make a story useful. InkPress aims to publish one coherent argument at a time: what happened, how it works, what the sources actually support, and what may change next. Each carousel page advances that argument rather than standing alone as a news brief.

*Ink* and *press* describe a small newsroom: code gathers material and typesets the issue; an editor, working alone or with an external agent, chooses the story, checks claims, and writes. This repository contains deterministic collection, validation, and rendering scripts. It does not contain an autonomous LLM writer or a direct Xiaohongshu publisher.

```text
English sources → daily/weekly candidate bundle → editorial selection and verification
                → Chinese writing → data/report.json → copy validation → carousel PNGs
                                                         └───────────────→ Feishu scripts
```

### Sources

`pipeline/core/digest.py` runs nine collectors and writes `data/daily.json` or `data/weekly.json`. The usual windows are one and seven days, respectively; listing-only sources do not strictly filter by time. A failed source is recorded in the bundle without stopping the others.

| Source | Method | Current behavior |
| --- | --- | --- |
| TBPN | Podcast RSS | Collects episode metadata; transcription is a separate command. |
| a16z | News listing page | Returns recent entries; `--since` is informational. |
| Reddit | OAuth API | Requires a user-provided client ID and secret. |
| YouTube | Channel RSS watchlist | Retries requests three times; individual channels may still fail. |
| Hacker News | Algolia API | Included as an independent source. |
| OpenAI News | Official RSS | Uses the shared RSS collector. |
| TechCrunch AI | Category RSS | Uses the shared RSS collector. |
| Ars Technica | Technology RSS | Filters for AI-related keywords. |
| Simon Willison | Atom feed | Uses the shared RSS collector. |

Collectors store seen item IDs in `pipeline/data/pipeline.db`. The digest also provides `recent_topics` hints from the current report and recent Git commit subjects. These are word-level hints; an editor still decides whether stories overlap.

### Architecture

```text
pipeline/
  sources/               Source collectors and shared HTTP/RSS helpers
  core/digest.py         Build daily/weekly candidate bundles
  core/store.py          SQLite seen-item and editorial-history helpers
  core/validate_text.py  Static copy and reference checks
  core/render_html.js    Current HTML/Playwright carousel renderer
  core/images.py         Older Pillow renderer, retained as an alternative
scripts/
  send_feishu_api.py     Delivery through Feishu Open API
  send_feishu_daily.py   Delivery through the local hermes CLI
data/                    Local reports, bundles, transcripts and images (Git-ignored)
```

### The report contract

The editor creates `data/report.json` after selecting and verifying a story. Collection does not generate it. This Git-ignored file supplies the finished copy to the renderer and sender scripts. Each `cards` entry is one page; the first card shares the cover. For the currently supported layouts, **N cards produce N HTML-rendered pages**: `cover.png`, `info_02.png`, and so on. The renderer currently defines layouts for up to nine cards.

```json
{
  "date": "YYYY-MM-DD",
  "series": "AI 圈每天深读",
  "cover": {
    "title_lines": ["First line", "Second line"],
    "kicker": "Issue label",
    "accent_word": "First line"
  },
  "cards": [
    {
      "tag": "Context",
      "title": "A claim supported by the story",
      "points": ["A complete paragraph with evidence and context."],
      "image": "https://example.com/image.jpg"
    }
  ],
  "references": [
    {"title": "Primary source", "url": "https://example.com/story"}
  ],
  "tags": ["AI"]
}
```

`image`, `tags`, and theme colors are optional. References belong in the delivered text, not the PNG pages. The HTML renderer uses Songti SC headings and PingFang SC body text, varies its layouts, and checks titles, footers, broken images, and text overflow before each 1242 × 1656 screenshot. The static validator catches banned copy patterns and missing reference links. It cannot verify factual claims; source checking and final visual review remain editorial work.

### Run locally

Run these commands from the repository root. Collection and validation use the Python standard library. HTML rendering requires Node.js, Chromium/Playwright, and the macOS fonts above. The Playwright import in `pipeline/core/render_html.js` currently points to a local HermesAgent installation and needs adjustment on another machine.

```bash
# Collect candidates; the two modes can run independently.
python3 -m pipeline.core.digest --mode daily
python3 -m pipeline.core.digest --mode weekly

# After editorial selection, save data/report.json and validate it.
python3 -m pipeline.core.validate_text

# Render to data/images/html/.
node pipeline/core/render_html.js
```

Both the validator and HTML renderer accept another report path:

```bash
python3 -m pipeline.core.validate_text /absolute/path/to/report.json
node pipeline/core/render_html.js /absolute/path/to/report.json
```

For optional TBPN transcription, install `curl`, `ffmpeg`, and `whisper-cli`. Put the model at `~/bin-whisper/ggml-large-v3-turbo.bin` or change that path in `pipeline/sources/tbpn.py`. The episode index starts at zero and must be within the requested window:

```bash
python3 -m pipeline.sources.tbpn --since 7d --transcribe 0
```

For Reddit, create `data/reddit.env` with the following values, or set the same environment variables. The entire `data/` directory is Git-ignored, so the local example file is not included in a fresh clone.

```dotenv
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
```

### Delivery and known gaps

Two Feishu sender scripts exist, but both currently assume exactly nine images and hard-code an issue date. Align them with the report's actual page count and date before use. `send_feishu_daily.py` also expects string references, while current reports use `{title, url}` objects. The renderer does not remove old PNGs when a new issue has fewer pages; check the output directory before sending. There is no direct Xiaohongshu publishing command.

The previous README described a daily 07:05 and Tuesday/Saturday 08:00 schedule. Scheduling lives outside this repository; no scheduler configuration is versioned here. Files in `data/` are local artifacts, not a reproducible sample issue.

### License

The project has been described as MIT-licensed, but this repository currently has no `LICENSE` file.

## 中文

### 项目背景与编辑原则

科技新闻更新得太快，标题列表和短摘要常常省略真正重要的证据、运作机制与后续影响。墨刊希望每次只讲清一个故事：发生了什么、如何运作、原始资料能证明什么、接下来可能改变什么。轮播图每一页承接前一页，合起来是一篇短文章，而不是几张独立资讯卡。

“墨刊”是一间单人编辑部：程序负责采墨和排版，编辑可以借助外部 agent 选题、核实与写作。仓库内实现的是确定性的采集、校验和渲染脚本；**没有**自动写稿的 LLM 程序，也没有直接发布小红书的功能。

```text
英文信源 → daily/weekly 候选包 → 选题、核实、中文写稿
         → data/report.json → 文案校验 → 轮播 PNG
                                └────────→ 飞书发送脚本
```

### 信源

`pipeline/core/digest.py` 调用九路信源，生成 `data/daily.json` 或 `data/weekly.json`。通常分别取近一天和近七天；只提供最新列表的信源不会严格按时间窗口筛选。单个信源失败会记录在候选包中，不阻断其余信源。

| 信源 | 方式 | 当前行为 |
| --- | --- | --- |
| TBPN | 播客 RSS | 候选包只收集节目元数据；转写需另行运行。 |
| a16z | 新闻列表页 | 返回最新条目；`--since` 仅作提示。 |
| Reddit | OAuth API | 需要用户配置 client ID 和 secret。 |
| YouTube | 频道 RSS watchlist | 请求最多重试三次；单个频道仍可能报错。 |
| Hacker News | Algolia API | 作为独立信源纳入候选包。 |
| OpenAI News | 官方 RSS | 使用通用 RSS 采集器。 |
| TechCrunch AI | 分类 RSS | 使用通用 RSS 采集器。 |
| Ars Technica | 技术栏目 RSS | 按 AI 相关关键词过滤。 |
| Simon Willison | Atom 订阅 | 使用通用 RSS 采集器。 |

采集器将已见条目 ID 存入 `pipeline/data/pipeline.db`。候选包还会根据当前稿件和近期 Git 提交标题生成 `recent_topics` 提示。这是词级提示，编辑仍需判断两个题目是否实际撞题。

### 仓库结构

```text
pipeline/
  sources/               各信源采集器、HTTP/RSS 通用工具
  core/digest.py         汇集信源并生成日报/周报候选包
  core/store.py          SQLite 已见条目与编辑记录工具
  core/validate_text.py  文案和参考资料静态校验
  core/render_html.js    当前 HTML/Playwright 轮播图渲染器
  core/images.py         保留的旧版 Pillow 渲染器
scripts/
  send_feishu_api.py     飞书 Open API 发送
  send_feishu_daily.py   通过本地 hermes CLI 发送
data/                    本地稿件、候选包、转写稿和图片（Git 忽略）
```

### 稿件格式

编辑选题、核实后创建 `data/report.json`；采集命令不会自动生成它。这个被 Git 忽略的文件为出图和发送脚本提供定稿文案。`cards` 中每项对应一页，第一页卡片与封面合并。对于当前支持的版式，**N 张 card 生成 N 张 HTML 图片**：`cover.png`、`info_02.png` 等；渲染器目前定义了最多九张 card 的版式。上面的英文部分提供了最小 JSON 示例。

`image`、`tags` 和主题色可选。`references` 用于发送的正文，不进入图片。HTML 渲染器使用宋体标题与苹方正文，按页采用不同版式，截图前检查标题、页脚、失效图片与正文溢出；图片尺寸为 1242 × 1656。静态校验器检查禁用话术和参考资料链接，**不能替代事实核查**；回源核实与最终视觉检查仍由编辑完成。

### 本地运行

在仓库根目录执行。采集和校验使用 Python 标准库。HTML 渲染需要 Node.js、Chromium/Playwright 和上述 macOS 字体。`pipeline/core/render_html.js` 目前从本机 HermesAgent 路径导入 Playwright；在其他机器上需要调整。

```bash
# 采集候选题；两种模式可以独立运行。
python3 -m pipeline.core.digest --mode daily
python3 -m pipeline.core.digest --mode weekly

# 选题、写稿后保存 data/report.json，并执行校验。
python3 -m pipeline.core.validate_text

# 出图到 data/images/html/。
node pipeline/core/render_html.js
```

校验器和 HTML 渲染器也接受自定义稿件路径：

```bash
python3 -m pipeline.core.validate_text /absolute/path/to/report.json
node pipeline/core/render_html.js /absolute/path/to/report.json
```

TBPN 转写是可选步骤：安装 `curl`、`ffmpeg`、`whisper-cli`，并把模型放到 `~/bin-whisper/ggml-large-v3-turbo.bin`，或修改 `pipeline/sources/tbpn.py` 中的路径。节目索引从零开始，且必须在指定时间窗口内：

```bash
python3 -m pipeline.sources.tbpn --since 7d --transcribe 0
```

使用 Reddit 时，创建 `data/reddit.env` 并填写以下内容；也可直接设置同名环境变量。整个 `data/` 目录都被 Git 忽略，因此本地的示例文件不会出现在新克隆的仓库中。

```dotenv
REDDIT_CLIENT_ID=你的_client_id
REDDIT_CLIENT_SECRET=你的_client_secret
```

### 发送与已知限制

仓库内有两套飞书发送脚本，但目前都固定发送九张图片，并写死刊期日期。使用前需让发送数量与稿件实际页数、日期一致。`send_feishu_daily.py` 还按字符串处理参考资料，而当前稿件采用 `{title, url}` 对象。新刊页数变少时，渲染器不会清理旧图片，发送前还需核对输出目录。仓库没有直接发布小红书的命令。

旧 README 记载日报 07:05、周二和周六周报 08:00 的排期。调度配置位于仓库之外，没有纳入版本管理。`data/` 下的稿件和图片是本地运行产物，不是可复现的示例刊物。

### 许可

项目曾标为 MIT，但仓库目前没有独立的 `LICENSE` 文件。
