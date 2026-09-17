# InkPress 墨刊

**InkPress** = Ink（墨）+ Press（出版社/新闻界）。每天凌晨自动读完五路英文信息源，把值得讲的一件事写成一篇有完整论证链的中文图文笔记，排版成可直接发布的小红书轮播图。

**ink-press /ɪŋk pres/ 墨刊**：单人编辑部。机器采墨（信息源），编辑磨墨（判断+写作），排版机印刊（PIL 出图）。

一句话：**AI 罐头资讯的解药** —— 不搬运摘要，写论证过程。

[English](#english) | [中文](#中文)

---

# English

## What it is

InkPress is a single-person Chinese editorial pipeline. Every morning it reads five English-language sources, picks the one story worth telling, writes a full reasoned argument in Chinese (not a summary), typesets it as a Xiaohongshu (RED) photo-carousel, and delivers it to Feishu.

The design rule: **data plane is deterministic Python, zero LLM**. The LLM only appears at the judgment + writing layer.

## Sources

| Source | Method | Status |
|---|---|---|
| TBPN (podcast) | transistor.fm RSS → mp3 → whisper-cpp large-v3-turbo local transcription (~2 min / 30 min audio) | working |
| a16z | HTML listing crawl (official RSS is dead) | working |
| Hacker News | Algolia API (fallback for Reddit, which 403s from datacenter IPs) | working |
| Reddit | OAuth (user-configured, `data/reddit.env`) | pending key |
| YouTube | channel RSS, watchlist of AI channels | intermittent 404/500, retries pending |

## Architecture

```
pipeline/
├── sources/            # collection: pure scripts, no LLM
│   ├── tbpn.py         #   podcast RSS → new mp3 → whisper → transcript
│   ├── a16z.py         #   listing crawl → new articles
│   ├── hn.py           #   Algolia API → top stories
│   ├── reddit.py       #   OAuth API → hot posts (+ HN fallback)
│   ├── youtube.py      #   channel RSS → new videos
│   └── common.py       #   fetch/parse_rss/dedupe helpers
├── core/
│   ├── store.py        #   SQLite: seen (dedupe) / picks / digests
│   ├── digest.py       #   collect → structured candidate bundle (daily/weekly)
│   └── images.py       #   report.json → Xiaohongshu carousel pages (PIL)
└── data/               #   pipeline.db + transcripts + generated pages (gitignored)
```

## The single-source rule

`data/report.json` is the one file that drives **both** the copy and the images:

```jsonc
{
  "cover":  { "title_lines": ["..."], "kicker": "...", "accent_word": "7%" },
  "cards":  [ { "title": "...", "points": ["full paragraph 1", "full paragraph 2"] } ],
  "tags":   ["#...", "..."]
}
```

- one card = one carousel page = one argument
- `points` are **full paragraphs**, not label+one-liner fragments
- pages are chained with connective phrases so the whole set reads as one coherent essay
- the image generator is forbidden from inventing content; every word on every page comes from this file

## Quality gates (why pages look the way they do)

Each page passes:

1. **Fact red lines** — every number is verified against the source transcript; rates are labeled with instrument + country (US 10-year Treasury / US mortgage / China LPR); foreign events must answer "why should a Chinese reader care"
2. **Flip test** — read only the first sentence of every page in sequence; it must retell the full argument chain. If a page doesn't connect to the previous one, its opening gets rewritten
3. **Vision check** — every generated page is inspected (no text overflow, no overlap, English words never split, punctuation never starts a line)

## Typesetting

- PingFang SC (Semibold titles / Regular body), 1.7x leading
- word-level line breaking: English tokens stay whole; CJK closing punctuation never starts a line
- 1242×1656 (3:4), paper `#FAF7F2` / ink `#1A1A1A` / editorial red `#C8442A`

## Run

```bash
# collect
python3 -m pipeline.core.digest --mode daily
python3 -m pipeline.core.digest --mode weekly

# transcribe the latest TBPN episode (~2 min on M4 Pro)
python3 -m pipeline.sources.tbpn --transcribe 0

# typeset (reads data/report.json)
python3 -m pipeline.core.images
```

All source scripts are idempotent: SQLite `seen` table dedupes by item id, re-running has no side effects.

## Schedule

- daily 07:05, weekly Tue/Sat 08:00 (cron), delivered to Feishu
- LLM involvement: topic selection + writing only. Collection, dedupe, transcription, typesetting are all deterministic.

## License

MIT

---

# 中文

## 这是什么

InkPress 是一条单人中文编辑部流水线。每天早上自动读五路英文信息源，挑出唯一值得讲的一件事，写成**带完整论证过程的中文文章**（不是摘要），排成可直接发布的小红书轮播图，推送到飞书。

设计铁律：**数据面是确定性 Python，零 LLM**。LLM 只在"判断 + 写作"层出现。

## 信息源

| 信源 | 方式 | 状态 |
|---|---|---|
| TBPN（播客） | transistor.fm RSS → mp3 → whisper-cpp large-v3-turbo 本地转写（30 分钟音频约 2 分钟） | 可用 |
| a16z | 列表页爬取（官方 RSS 已死） | 可用 |
| Hacker News | Algolia API（Reddit 从机房 IP 被 403，HN 兜底） | 可用 |
| Reddit | OAuth（用户自配，`data/reddit.env`） | 待配 key |
| YouTube | 频道 RSS，AI 频道 watchlist | 间歇 404/500，待加重试 |

## 架构

```
pipeline/
├── sources/            # 采集层：纯脚本，零 LLM
│   ├── tbpn.py         #   播客 RSS → 新 mp3 → whisper 转写
│   ├── a16z.py         #   列表页爬取 → 新文章
│   ├── hn.py           #   Algolia API → 热帖
│   ├── reddit.py       #   OAuth API → 热帖（HN 兜底）
│   ├── youtube.py      #   频道 RSS → 新视频
│   └── common.py       #   fetch/parse_rss/去重 工具
├── core/
│   ├── store.py        #   SQLite：seen（去重）/ picks / digests
│   ├── digest.py       #   采集 → 结构化候选包（daily/weekly）
│   └── images.py       #   report.json → 小红书轮播页（PIL）
└── data/               #   pipeline.db + 转写稿 + 生成图（gitignore）
```

## 单一数据源规则

`data/report.json` 是同时驱动**文案和图片**的唯一文件：

- 一张 card = 一页轮播图 = 一个论点
- `points` 是**完整段落**，不是"标签+一句话"的词条
- 页与页之间用承接词衔接，整套图读起来是一篇连贯的文章
- 出图器禁止自造内容：每页每个字都来自这份文件

## 质量门（为什么长这样）

每页要通过三道门：

1. **事实红线**：每个数字回源核对；利率标注品种+国别（美国10年期国债 / 美国房贷 / 中国LPR）；境外事件必须回答"中国人为什么该看"
2. **翻页测试**：只按顺序读每页第一句，必须能复述完整论证链（起点→案例→机制→结论）；接不上的页重写开头
3. **视觉自检**：每页生成后检查（无溢出、无重叠、英文不拆词、标点不落行首）

## 排版

- PingFang SC（Semibold 标题 / Regular 正文），1.7 倍行距
- 词级断行：英文整词不拆；中文标点不落行首
- 1242×1656（3:4），纸色 `#FAF7F2` / 墨黑 `#1A1A1A` / 编辑红 `#C8442A`

## 运行

```bash
# 采集
python3 -m pipeline.core.digest --mode daily
python3 -m pipeline.core.digest --mode weekly

# 转写最新一期 TBPN（M4 Pro 约 2 分钟）
python3 -m pipeline.sources.tbpn --transcribe 0

# 排版（读 data/report.json）
python3 -m pipeline.core.images
```

所有采集脚本幂等：SQLite `seen` 表按条目 id 去重，重复跑无副作用。

## 排期

- daily 每天 07:05，weekly 周二/周六 08:00（cron），推送到飞书
- LLM 参与：选题 + 写作。采集、去重、转写、排版全部确定性执行。

## 许可

MIT
