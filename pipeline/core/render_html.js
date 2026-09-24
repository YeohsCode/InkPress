#!/usr/bin/env node
/* HTML → PNG 卡片渲染器（2026-09-22 改版：布局/色彩分层 + 支持配图）。
 * 用法: node render_html.js [report.json]   默认 data/report.json
 * 输出: data/images/html/cover.png, info_NN.png
 * 图片不带参考资料 ref（ref 只进正文 report.references）。
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join('/Users/andrewyeoh/Werk/HermesAgent/code/node_modules/playwright'));

const ROOT = path.resolve(__dirname, '..', '..');
const reportPath = process.argv[2] || path.join(ROOT, 'data', 'report.json');
const OUT_DIR = path.join(ROOT, 'data', 'images', 'html');
fs.mkdirSync(OUT_DIR, { recursive: true });

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const THEME = report.theme || {};
const ACCENT = THEME.accent || '#C8442A';
const ACCENT2 = THEME.accent2 || '#1F5F7A';
const BG1 = THEME.bg1 || '#FAF7F2';
const BG2 = THEME.bg2 || '#F2ECE3';
const INK = THEME.ink || '#1A1A1A';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 关键数字/百分比/英文词上色：36%、$241.6、AI agent、Perplexity 等
// 关键数字/百分比/英文词上色：36%、$241.6、AI agent、Perplexity 等
// 单遍 tokenize：在原文上切 token 再包标签，杜绝"上一步注入的标签被下一步正则二次命中"
// （2026-09-23 bug：串行 replace 把 <em class="num"> 里的 class/num 又包了层 <em>，
//  标签撕碎后浏览器把残片 class="num"> 当纯文本渲染 —— 页 07 实锤）
function richText(s) {
  const NUM_RE = /\$?\d[\d,.]*\s*(?:%|亿|万|美元|MW|GB|天|年|个月|倍|点|分)/y;
  const EN_RE = /[A-Za-z][A-Za-z0-9.\-]{2,}(?: [A-Za-z][A-Za-z0-9.\-]{2,})?/y;
  let out = '';
  let i = 0;
  while (i < s.length) {
    NUM_RE.lastIndex = i;
    let m = NUM_RE.exec(s);
    if (m) { out += `<em class="num">${esc(m[0])}</em>`; i = NUM_RE.lastIndex; continue; }
    EN_RE.lastIndex = i;
    m = EN_RE.exec(s);
    if (m) { out += `<em class="en">${esc(m[0])}</em>`; i = EN_RE.lastIndex; continue; }
    out += esc(s[i]);
    i += 1;
  }
  return out;
}

function pageShell(inner, opts = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  /* ====== 设计系统 v3（2026-09-24 重做）：Apple News / iOS Dynamic Type 语系 ======
     依据：NN/g legibility（大默认字号+高对比+素背景）、Baymard 50-75 字符行宽、
     Refactoring UI（灰阶分层+单一强调色克制使用）、Apple HIG type ladder 比例 */
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { -webkit-font-smoothing:antialiased; }
  body { width:1242px; height:1656px; font-family:"PingFang SC","Helvetica Neue",sans-serif;
         background:#F7F5F2; color:#111111; position:relative; overflow:hidden; }
  /* 素背景：去掉渐变+装饰圆，改为纸感单色 + 头部强调色细线 */
  .topline { position:absolute; top:0; left:0; right:0; height:14px; background:${ACCENT}; }
  .topmeta { position:absolute; top:52px; left:96px; right:96px; display:flex; justify-content:space-between;
             font-size:26px; letter-spacing:5px; color:#8A8580; font-weight:500; }
  .kicker { font-size:28px; color:#8A8580; letter-spacing:6px; font-weight:500; }
  .chip { display:inline-block; padding:10px 28px; border-radius:12px; color:#fff;
          font-size:30px; font-weight:600; letter-spacing:3px; background:${ACCENT}; }
  .chip.alt { background:${ACCENT2}; }
  /* type ladder（对齐 iOS Dynamic Type 比例）：title 72 / body 34-40 / caption 26。
     行宽控制 50-75 字符（Baymard）：左右留白 96px。 */
  h1.title { font-size:72px; font-weight:800; line-height:1.22; letter-spacing:0.5px; }
  .body { font-weight:400; color:#2A2A2A; }
  .body p { margin-bottom:30px; text-align:left; }
  .body p:last-child { margin-bottom:0; }
  em.num { font-style:normal; color:${ACCENT}; font-weight:700; }
  em.en { font-style:normal; color:${ACCENT2}; font-weight:600; font-size:0.9em; }
  .imgbox { border-radius:0; overflow:hidden; box-shadow:none; }
  .imgbox img { width:100%; height:100%; object-fit:cover; display:block; }
  .rule { width:72px; height:8px; background:${ACCENT}; margin:28px 0; }
  .footer { position:absolute; bottom:44px; left:96px; right:96px; display:flex;
            justify-content:space-between; align-items:center; font-size:26px; color:#A29B93;
            border-top:2px solid #E5E0DA; padding-top:20px; }
  .pgnum { font-variant-numeric:tabular-nums; letter-spacing:2px; }
  </style></head><body>
  <div class="topline"></div>
  ${inner}
  </body></html>`;
}

// ---- 布局选择（2026-09-24 用户要求打破"全部上图下文"）----
// card.layout 显式指定优先（'hero' | 'side' | 'top' | 'below'）；否则按内容特征自动分配。
// 自动规则（确定性，可复现）：
//   无图                 -> text 纯文本
//   points<=2 且 <=200字 -> hero  短文大图，图占上半屏
//   <=300字              -> side  左文右图并排
//   其余                 -> 交替 top / below（上图下文 / 上文下图）错开节奏
function pickLayout(card, idx) {
  if (card.layout) return card.layout;
  if (!card.image) return 'text';
  const chars = card.points.join('').length;
  if (card.points.length <= 2 && chars <= 200) return 'hero';
  if (chars <= 300) return 'side';
  return (idx % 2 === 0) ? 'top' : 'below';
}

function cardHTML(card, idx, total) {
  const pts = card.points.map(p => `<p>${richText(p)}</p>`).join('\n');
  const totalChars = card.points.join('').length;
  const layout = pickLayout(card, idx);
  const chipCls = idx % 2 === 1 ? 'chip' : 'chip alt';
  const chipHTML = `<div><span class="${chipCls}">${esc(card.tag || (String(idx).padStart(2, '0')))}</span></div>`;
  const bodyStyle = (fs) => `class="body fitbody" data-base="${fs}" style="flex:1; overflow:hidden; font-size:${fs}px; line-height:1.72;"`;
  const est = (penalty) => {
    const scale = Math.min(1, penalty * Math.sqrt(260 / totalChars));
    return Math.max(27, Math.round(42 * scale * 10) / 10);
  };
  let inner = '';
  if (layout === 'hero') {
    const fs = est(0.42);
    inner = `
  <div style="position:absolute; left:0; right:0; top:0; height:820px; overflow:hidden;">
    <img src="${esc(card.image)}" style="width:100%; height:100%; object-fit:cover; display:block;">
    <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,16,12,0.06) 0%, rgba(20,16,12,0.62) 100%);"></div>
    <div style="position:absolute; left:96px; bottom:40px; right:96px;"><span class="${chipCls}">${esc(card.tag || (String(idx).padStart(2, '0')))}</span></div>
  </div>
  <div style="position:absolute; left:96px; right:96px; top:880px; bottom:124px; display:flex; flex-direction:column;">
    <h1 class="title">${esc(card.title)}</h1>
    <div class="rule"></div>
    <div ${bodyStyle(fs)}>${pts}</div>
  </div>`;
  } else if (layout === 'side') {
    const fs = est(0.82);
    inner = `
  <div style="position:absolute; left:96px; right:96px; top:132px; bottom:124px; display:flex; flex-direction:column;">
    ${chipHTML}
    <div style="height:40px"></div>
    <h1 class="title">${esc(card.title)}</h1>
    <div class="rule"></div>
    <div style="flex:1; display:flex; gap:44px; margin-top:40px; min-height:0; align-items:stretch;">
      <div class="body fitbody" data-base="${fs}" style="flex:1.6; min-width:0; overflow:hidden; font-size:${fs}px; line-height:1.72;">${pts}</div>
      <div style="flex:1; min-width:0; overflow:hidden;">
        <img src="${esc(card.image)}" style="width:100%; height:100%; object-fit:cover; display:block;">
      </div>
    </div>
  </div>`;
  } else if (layout === 'below') {
    const fs = est(0.66);
    inner = `
  <div style="position:absolute; left:96px; right:96px; top:132px; bottom:124px; display:flex; flex-direction:column;">
    ${chipHTML}
    <div style="height:40px"></div>
    <h1 class="title">${esc(card.title)}</h1>
    <div class="rule"></div>
    <div class="body fitbody" data-base="${fs}" style="flex:1; overflow:hidden; font-size:${fs}px; line-height:1.72; margin-top:36px;">${pts}</div>
    <div class="imgbox" style="height:430px; margin-top:36px; flex:none;"><img src="${esc(card.image)}"></div>
  </div>`;
  } else {
    const fs = est(0.72);
    inner = `
  <div style="position:absolute; left:96px; right:96px; top:132px; bottom:124px; display:flex; flex-direction:column;">
    ${chipHTML}
    <div style="height:40px"></div>
    <h1 class="title">${esc(card.title)}</h1>
    <div class="rule"></div>
    <div class="imgbox" style="height:380px; margin-bottom:44px; margin-top:36px; flex:none;"><img src="${esc(card.image)}"></div>
    <div ${bodyStyle(fs)}>${pts}</div>
  </div>`;
  }
  return pageShell(inner + `
  <div class="footer"><span>${esc(report.series || '')}</span><span class="pgnum">${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></div>`);
}

// 封面与第一页整合：第 1 页 = 封面大字区 + 第一卡正文，总计 9 页（2026-09-23 用户要求）
function mergedFirstHTML(spec, card, idx, total) {
  const acc = spec.accent_word || '';
  const lines = spec.title_lines.map(l => {
    if (acc && l.includes(acc)) {
      const [pre, post] = l.split(acc);
      return `<span>${esc(pre)}<span style="color:${ACCENT}">${esc(acc)}</span>${esc(post || '')}</span>`;
    }
    return `<span>${esc(l)}</span>`;
  }).join(' ');
  const pts = card.points.map(p => `<p>${richText(p)}</p>`).join('\n');
  const totalChars = card.points.join('').length;
  const imgPenalty = card.image ? 0.50 : 0.80;
  const scale = Math.min(1, imgPenalty * Math.sqrt(260 / totalChars));
  const bodyPx = Math.max(27, Math.round(42 * scale * 10) / 10);
  const img = card.image
    ? `<div class="imgbox" style="height:240px; margin-bottom:26px; flex:none;"><img src="${esc(card.image)}"></div>`
    : '';
  return pageShell(`
  <div class="topmeta"><span>${esc(spec.series || 'AI 圈每日深读')}</span><span>${esc(spec.kicker || '')}</span></div>
  <div style="position:absolute; left:96px; right:96px; top:132px; bottom:124px; display:flex; flex-direction:column;">
    <div style="font-size:92px; font-weight:800; line-height:1.18; letter-spacing:1px;">${lines}</div>
    <div class="rule" style="margin:32px 0;"></div>
    <div><span class="chip">${esc(card.tag || '01')}</span></div>
    <div style="height:28px"></div>
    ${img}
    <div class="body fitbody" data-base="${bodyPx}" style="flex:1; overflow:hidden; font-size:${bodyPx}px; line-height:1.66;">${pts}</div>
  </div>
  <div class="footer"><span>${esc(spec.series || 'AI 圈每日深读')}</span><span class="pgnum">01 / ${String(total).padStart(2, '0')}</span></div>`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1242, height: 1656 }, deviceScaleFactor: 2 });
  const rest = report.cards.slice(1);
  const shots = [['cover', mergedFirstHTML(report.cover, report.cards[0], 1, report.cards.length)]];
  rest.forEach((c, i) => shots.push([`info_${String(i + 2).padStart(2, '0')}`, cardHTML(c, i + 2, report.cards.length)]));
  for (const [name, html] of shots) {
    const tmp = path.join(OUT_DIR, `${name}.html`);
    fs.writeFileSync(tmp, html);
    await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    // measured auto-fit: heuristic mis-estimates pages with many English <em>; measure real
    // scroll overflow and shrink until it fits (floor 20px, max 8 passes)
    for (let fit = 0; fit < 8; fit++) {
      const ov = await page.evaluate(() => {
        const b = document.querySelector('.fitbody');
        if (!b) return 0;
        return b.scrollHeight - b.clientHeight;
      });
      if (ov <= 0) break;
      const base = await page.evaluate(() => {
        const b = document.querySelector('.fitbody');
        return parseFloat(b.style.fontSize);
      });
      const next = Math.max(20, Math.floor((base * Math.min(0.96, 1 - ov / 2600)) * 10) / 10);
      if (next >= base) break;
      await page.evaluate((px) => {
        const b = document.querySelector('.fitbody');
        b.style.fontSize = px + 'px';
      }, next);
      await page.waitForTimeout(60);
    }
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip: { x: 0, y: 0, width: 1242, height: 1656 } });
    console.log(path.join(OUT_DIR, `${name}.png`));
  }
  await browser.close();
})();