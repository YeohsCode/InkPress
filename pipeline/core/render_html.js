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
function richText(s) {
  let out = esc(s);
  out = out.replace(/(\$?\d[\d,.]*\s*(?:%|亿|万|美元|MW|GB|天|年|个月|倍|点|分))/g,
    `<em class="num">$1</em>`);
  out = out.replace(/([A-Za-z][A-Za-z0-9.\-]{2,}(?: [A-Za-z][A-Za-z0-9.\-]{2,})?)/g, (m, w, off, full) => {
    return `<em class="en">${m}</em>`;
  });
  return out;
}

function pageShell(inner, opts = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1242px; height:1656px; font-family:"PingFang SC","Helvetica Neue",sans-serif;
         background: linear-gradient(160deg, ${BG1} 0%, ${BG2} 100%); color:${INK};
         position:relative; overflow:hidden; }
  .deco { position:absolute; border-radius:50%; opacity:.10; }
  .d1 { width:520px; height:520px; right:-160px; top:-140px; background:${ACCENT}; }
  .d2 { width:380px; height:380px; left:-120px; bottom:120px; background:${ACCENT2}; }
  .rail { position:absolute; left:0; top:0; bottom:0; width:14px; background:${ACCENT}; }
  .kicker { font-size:34px; color:#8A8A8A; letter-spacing:6px; }
  .chip { display:inline-block; padding:14px 34px; border-radius:44px; color:#fff;
          font-size:36px; font-weight:600; letter-spacing:2px; background:${ACCENT}; }
  .chip.alt { background:${ACCENT2}; }
  h1.title { font-size:76px; font-weight:700; line-height:1.28; letter-spacing:1px; }
  .body { font-size:42px; line-height:1.72; font-weight:400; }
  .body p { margin-bottom:34px; text-align:justify; }
  .body p:last-child { margin-bottom:0; }
  em.num { font-style:normal; color:${ACCENT}; font-weight:700; }
  em.en { font-style:normal; color:${ACCENT2}; font-weight:600; font-size:38px; }
  .footer { position:absolute; bottom:52px; left:110px; right:110px; display:flex;
            justify-content:space-between; align-items:center; font-size:32px; color:#9a938a; }
  .brand { letter-spacing:4px; }
  .pgnum { font-weight:600; color:${INK}; }
  .rule { width:120px; height:8px; background:${ACCENT}; margin:44px 0 52px; border-radius:4px; }
  .imgbox { border-radius:24px; overflow:hidden; box-shadow:0 18px 50px rgba(0,0,0,.14); }
  .imgbox img { width:100%; height:100%; object-fit:cover; display:block; }
  </style></head><body>
  <div class="deco d1"></div><div class="deco d2"></div>
  <div class="rail"></div>
  ${inner}
  </body></html>`;
}

function coverHTML(spec) {
  const lines = spec.title_lines.map(l => {
    const acc = spec.accent_word;
    if (acc && l.includes(acc)) {
      const [pre, post] = l.split(acc);
      return `<div>${esc(pre)}<span style="color:${ACCENT}">${esc(acc)}</span>${esc(post || '')}</div>`;
    }
    return `<div>${esc(l)}</div>`;
  }).join('');
  return pageShell(`
  <div style="position:absolute; left:110px; right:100px; top:0; bottom:0; display:flex; flex-direction:column; justify-content:center;">
    <div class="kicker">${esc(spec.kicker || '')}</div>
    <div style="height:56px"></div>
    <div style="font-size:112px; font-weight:800; line-height:1.24; letter-spacing:2px;">${lines}</div>
    <div class="rule" style="width:220px; height:10px;"></div>
    <div style="font-size:40px; color:#6f6a63; letter-spacing:8px;">${esc(spec.series || 'AI 圈每日深读')}</div>
  </div>
  <div class="footer"><span class="brand">${esc(report.series || '')}</span><span class="pgnum">${esc(report.date || '')}</span></div>`);
}

function cardHTML(card, idx, total) {
  const pts = card.points.map(p => `<p>${richText(p)}</p>`).join('\n');
  // 自适应缩字：按字符总量估字号（基准 42px / ~260 全角字符满页，配图占位时缩减）
  const totalChars = card.points.join('').length;
  const imgPenalty = card.image ? 0.72 : 1;
  const scale = Math.min(1, imgPenalty * Math.sqrt(260 / totalChars));
  const bodyPx = Math.max(30, Math.round(42 * scale * 10) / 10);
  const lh = 1.72;
  const img = card.image
    ? `<div class="imgbox" style="height:380px; margin-bottom:44px;"><img src="${esc(card.image)}"></div>`
    : '';
  const chipCls = idx % 2 === 1 ? 'chip' : 'chip alt';
  return pageShell(`
  <div style="position:absolute; left:110px; right:100px; top:96px; bottom:140px; display:flex; flex-direction:column;">
    <div><span class="${chipCls}">${esc(card.tag || (String(idx).padStart(2, '0')))}</span></div>
    <div style="height:40px"></div>
    <h1 class="title">${esc(card.title)}</h1>
    <div class="rule"></div>
    ${img}
    <div class="body" style="flex:1; overflow:hidden; font-size:${bodyPx}px; line-height:${lh};">${pts}</div>
  </div>
  <div class="footer"><span class="brand">${esc(report.series || '')}</span><span class="pgnum">${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></div>`);
}

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1242, height: 1656 }, deviceScaleFactor: 2 });
  const shots = [['cover', coverHTML(report.cover)]];
  report.cards.forEach((c, i) => shots.push([`info_${String(i + 1).padStart(2, '0')}`, cardHTML(c, i + 1, report.cards.length)]));
  for (const [name, html] of shots) {
    const tmp = path.join(OUT_DIR, `${name}.html`);
    fs.writeFileSync(tmp, html);
    await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), clip: { x: 0, y: 0, width: 1242, height: 1656 } });
    console.log(path.join(OUT_DIR, `${name}.png`));
  }
  await browser.close();
})();
