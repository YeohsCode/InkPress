#!/usr/bin/env node
/* HTML → PNG 渲染器（v4：内容驱动的编辑部版式）。 */
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
const INK = THEME.ink || '#16130F';

const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 单遍 tokenize：先按原文边界命中，再包标签，避免串行 replace 二次命中注入标签。
function richText(value) {
  const NUM_RE = /\$?\d[\d,.]*\s*(?:%|亿|万|美元|MW|GB|天|年|个月|倍|点|分)/y;
  const EN_RE = /[A-Za-z][A-Za-z0-9.\-/]{2,}(?: [A-Za-z][A-Za-z0-9.\-/]{2,})?/y;
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    NUM_RE.lastIndex = cursor;
    let match = NUM_RE.exec(value);
    if (match) {
      output += `<em class="num">${esc(match[0])}</em>`;
      cursor = NUM_RE.lastIndex;
      continue;
    }
    EN_RE.lastIndex = cursor;
    match = EN_RE.exec(value);
    if (match) {
      output += `<em class="en">${esc(match[0])}</em>`;
      cursor = EN_RE.lastIndex;
      continue;
    }
    output += esc(value[cursor]);
    cursor += 1;
  }
  return output;
}

function firstSentence(text) {
  const sentence = text.match(/^[\s\S]{0,125}?[。！？；：]/);
  if (sentence) return sentence[0];
  const comma = text.slice(32).search(/[，,]/);
  if (comma >= 0) return text.slice(0, 33 + comma);
  return text;
}

function splitLede(text) {
  const lede = firstSentence(text).trim();
  return [lede, text.slice(lede.length).trim()];
}

function ledeBody(points) {
  const [lede, remainder] = splitLede(points[0]);
  const paragraphs = [];
  if (remainder) paragraphs.push(remainder);
  paragraphs.push(...points.slice(1));
  return {
    lede: richText(lede),
    body: paragraphs.map(item => `<p>${richText(item)}</p>`).join('')
  };
}

function selectedStats(card, index) {
  const text = card.points.join('\n');
  const grab = (pattern, label, suffix = '') => {
    const match = text.match(pattern);
    return match ? { value: match[1] + suffix, label } : null;
  };
  const candidates = [
    grab(/核心数字是\s*(\d+(?:\.\d+)?)\s*毫秒/, '端到端延迟', ' ms'),
    grab(/P50\s*(\d+(?:\.\d+)?)\s*毫秒/, '端到端 P50', ' ms'),
    ...[...text.matchAll(/(\d+(?:\.\d+)?)\s*题\/秒/g)].map(match => ({ value: match[1], label: '题 / 秒' })),
    grab(/多语言版\s*(\d+(?:\.\d+)?)\s*毫秒/, '多语言 P50', ' ms'),
    grab(/(\d+)\s*个\s*star/i, 'GitHub Stars'),
    grab(/(\d+)\s*星/, 'GitHub Stars'),
    grab(/(\d+)\s*个\s*fork/i, 'GitHub Forks'),
    grab(/(\d+\s*\/\s*\d+)/, '逐题对照'),
    grab(/重复调用\s*(\d+)\s*次/, '稳定性轮次', ' 次'),
    grab(/(\d+)\s*个文件/, '发布文件', ' 个'),
    grab(/拿了\s*(\d+)\s*分/, 'HN 得分'),
    grab(/(\d+)\s*条评论/, '条评论'),
    grab(/(\d+(?:\.\d+)?)\s*道题/, '基准题', ' 道'),
    grab(/(\d+)M 参数/, '英文版参数', 'M'),
    ...[...text.matchAll(/上下文\s*(\d+)/g)].map(match => ({ value: match[1], label: '上下文' }))
  ].filter(Boolean);
  const seen = new Set();
  const unique = candidates.filter(item => {
    const key = item.value + item.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (index === 8) return unique.filter(item => /参数|上下文/.test(item.label)).slice(0, 4);
  return unique.slice(0, index === 3 ? 4 : 3);
}

function statBlocks(stats, columns) {
  if (!stats.length) return '';
  return `<div class="statrow cols-${columns}">${stats.map((stat, position) => `
    <div class="stat ${position % 2 === 1 ? 'alt' : ''}">
      <span class="statvalue">${esc(stat.value)}</span>
      <span class="statlabel">${esc(stat.label)}</span>
    </div>`).join('')}</div>`;
}

function imageHTML(card, className = '') {
  if (!card.image) return '';
  return `<div class="image ${className}"><img src="${esc(card.image)}" alt=""></div>`;
}

function numberedRows(points) {
  return points.map((point, index) => `
    <article class="numberrow">
      <span class="number">${String(index + 1).padStart(2, '0')}</span>
      <div class="numberbody">${richText(point)}</div>
    </article>`).join('');
}

function pageShell(inner, index, total, layout) {
  const pageNo = String(index).padStart(2, '0');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  body { width:1242px; height:1656px; overflow:hidden; position:relative; color:${INK};
    background:#F7F4EF; font-family:"PingFang SC","Helvetica Neue",sans-serif; }
  .topline { position:absolute; top:0; left:0; right:0; height:10px; background:${ACCENT}; z-index:5; }
  .masthead { position:absolute; top:46px; left:96px; right:96px; z-index:4; display:flex;
    align-items:center; justify-content:space-between; font-size:25px; font-weight:550;
    letter-spacing:5px; color:#756F67; }
  .masthead .brand::before { content:""; width:14px; height:14px; margin-right:14px;
    display:inline-block; background:${ACCENT}; transform:translateY(1px); }
  .page { position:absolute; left:96px; right:96px; top:126px; bottom:132px; z-index:2; }
  .kicker { display:inline-flex; gap:14px; align-items:center; font-size:25px; font-weight:600;
    letter-spacing:4px; color:#756F67; }
  .kicker::before { content:""; width:34px; height:3px; background:${ACCENT}; }
  h1.title { font-family:"Songti SC","Noto Serif CJK SC",serif; font-weight:800; line-height:1.15;
    letter-spacing:.5px; font-size:72px; color:#171310; }
  .lede { font-family:"Songti SC","Noto Serif CJK SC",serif; color:#242019; font-weight:650; line-height:1.35; }
  .body { color:#38332C; line-height:1.70; }
  .body p + p { margin-top:24px; }
  em.num { font-style:normal; color:${ACCENT}; font-weight:700; }
  em.en { font-style:normal; color:${ACCENT2}; font-weight:600; font-size:.9em; }
  .image { overflow:hidden; background:#E4DFD7; }
  .image img { width:100%; height:100%; object-fit:cover; display:block; }
  .statrow { display:grid; gap:20px; }
  .statrow.cols-3 { grid-template-columns:repeat(3,1fr); }
  .statrow.cols-4 { grid-template-columns:repeat(4,1fr); }
  .statrow.cols-4 .statvalue { font-size:33px; }
  .stat { padding:26px 22px 22px; background:#FFF; border-top:4px solid ${ACCENT};
    box-shadow:0 14px 34px rgba(60,48,37,.07); min-width:0; }
  .stat.alt { border-top-color:${ACCENT2}; }
  .statvalue { display:block; font-family:"Avenir Next","PingFang SC",sans-serif; font-size:42px;
    line-height:1.05; font-weight:750; color:${ACCENT}; white-space:nowrap; }
  .stat.alt .statvalue { color:${ACCENT2}; }
  .statlabel { display:block; margin-top:10px; font-size:22px; line-height:1.25; color:#6A645B;
    font-weight:550; letter-spacing:1px; }
  .numbered { display:flex; flex-direction:column; justify-content:flex-start; }
  .numberrow { display:flex; gap:24px; min-height:0; }
  .number { flex:none; width:82px; font-family:"Avenir Next",sans-serif; font-size:50px; line-height:1;
    font-weight:750; color:${ACCENT}; opacity:.82; }
  .numberbody { min-width:0; color:#38332C; font-size:30px; line-height:1.62; }
  .footer { position:absolute; left:96px; right:96px; bottom:42px; z-index:4; display:flex;
    justify-content:space-between; align-items:center; border-top:1px solid #DAD3C8; padding-top:16px;
    font-size:23px; font-weight:500; letter-spacing:2px; color:#8A8378; }
  .pageno { font-variant-numeric:tabular-nums; color:${ACCENT}; font-weight:700; }
  .fitbody { overflow:hidden; min-height:0; }
  main.layout-front { display:grid; grid-template-columns:1.24fr .76fr; gap:46px; }
  .layout-front .leadcolumn { display:flex; flex-direction:column; min-width:0; }
  figure.layout-hero.stage { position:absolute; top:0; left:0; right:0; height:630px; }
  figure.layout-hero.stage .image { height:100%; }
  main.layout-hero.copy { position:absolute; left:96px; right:96px; top:690px; bottom:132px;
    display:flex; flex-direction:column; }
  main.layout-stat.copy { display:flex; flex-direction:column; }
  .layout-stat .lower { flex:1; display:grid; grid-template-columns:1.72fr 1fr; gap:42px; margin-top:44px; min-height:0; }
  main.layout-verify.copy { display:flex; flex-direction:column; }
  .layout-verify .lower { flex:1; display:grid; grid-template-columns:1.08fr .92fr; gap:40px; margin-top:42px; min-height:0; }
  main.layout-quote.copy { display:flex; flex-direction:column; z-index:2; }
  .layout-quote .bigquote { font-size:50px; line-height:1.32; padding:0 0 32px;
    border-bottom:1px solid #D9D2C6; margin-bottom:30px; }
  .layout-quote .columns { flex:1; column-count:2; column-gap:46px; }
  .layout-quote .columns p { break-inside:avoid-column; }
  .layout-index { display:grid; grid-template-columns:.84fr 1.16fr; }
  .layout-index .left { display:flex; flex-direction:column; padding-right:40px; min-width:0; }
  .layout-index .right { display:flex; flex-direction:column; min-width:0; padding-top:72px; }
  main.layout-weave { display:grid; grid-template-columns:.82fr 1.18fr; gap:40px; }
  .layout-weave .visual { display:flex; flex-direction:column; min-width:0; }
  main.layout-steps.copy { display:flex; flex-direction:column; }
  .layout-steps .lower { flex:1; display:grid; grid-template-columns:1.26fr .74fr; gap:40px; margin-top:40px; min-height:0; }
  main.layout-endpoint.copy { display:flex; flex-direction:column; }
  .layout-endpoint .timeline { flex:1; margin-top:46px; }
  .layout-endpoint .numberrow + .numberrow { margin-top:44px; }
  .layout-endpoint .numberrow + .numberrow { margin-top:30px; border-top:1px solid #DDD6CA; padding-top:28px; }
  </style></head><body data-layout="${esc(layout)}">
  <div class="topline"></div>
  <div class="masthead"><span class="brand">${esc(report.series || 'AI 圈每日深读')}</span><span>${esc(report.cover.kicker || '')}</span></div>
  ${inner}
  <div class="footer"><span>${esc(report.series || 'AI 圈每日深读')}</span><span class="pageno">${pageNo} / ${String(total).padStart(2, '0')}</span></div>
  </body></html>`;
}

function coverFirstHTML(card, index, total) {
  const spec = report.cover;
  const accent = spec.accent_word || '';
  const titleLines = spec.title_lines.map(line => {
    if (!accent || !line.includes(accent)) return `<span>${esc(line)}</span>`;
    const [before, after] = line.split(accent);
    return `<span>${esc(before)}<span style="color:${ACCENT}">${esc(accent)}</span>${esc(after || '')}</span>`;
  }).join('');
  const { lede, body } = ledeBody(card.points);
  const stats = selectedStats(card, index);
  const bodySize = 31;
  return pageShell(`
  <main class="page layout-front">
    <section class="leadcolumn">
      <div class="kicker">TODAY · 9月24日</div>
      <h1 class="title" style="font-size:90px; margin:28px 0 0;">${titleLines}</h1>
      <div style="width:92px;height:8px;background:${ACCENT};margin:34px 0;"></div>
      <div class="lede" style="font-size:35px; margin-bottom:28px;">${lede}</div>
      <div class="body fitbody" data-base="${bodySize}" style="flex:1; font-size:${bodySize}px;">${body}</div>
    </section>
    <section style="display:flex;flex-direction:column;min-width:0;">
      ${statBlocks(stats, 3)}
      ${imageHTML(card, 'fitbody').replace('class="image fitbody"', 'class="image fitbody" style="flex:1;margin-top:24px;"')}
    </section>
  </main>`, index, total, 'front');
}

function heroHTML(card, index, total) {
  const { lede, body } = ledeBody(card.points);
  const bodySize = 32;
  return pageShell(`
  <figure class="layout-hero stage">${imageHTML(card)}</figure>
  <main class="layout-hero copy">
    <div class="kicker">${esc(card.tag || '')}</div>
    <h1 class="title" style="margin:24px 0 26px;">${esc(card.title)}</h1>
    <div class="lede" style="font-size:38px; margin-bottom:28px;">${lede}</div>
    <div class="body fitbody" data-base="${bodySize}" style="flex:1; font-size:${bodySize}px;">${body}</div>
  </main>`, index, total, 'hero');
}

function statHTML(card, index, total) {
  const { lede, body } = ledeBody(card.points);
  const stats = selectedStats(card, index);
  const bodySize = 29;
  return pageShell(`
  <main class="page layout-stat copy">
    <div class="kicker">${esc(card.tag || '')}</div>
    <h1 class="title" style="margin:24px 0 32px;">${esc(card.title)}</h1>
    ${statBlocks(stats, 4)}
    <section class="lower">
      <div class="body fitbody" data-base="${bodySize}" style="font-size:${bodySize}px;">${body}</div>
      <aside style="display:flex;flex-direction:column;min-width:0;">
        <div class="lede" style="font-size:32px;margin-bottom:24px;">${lede}</div>
        ${imageHTML(card, 'fitbody').replace('class="image fitbody"', 'class="image fitbody" style="flex:1;"')}
      </aside>
    </section>
  </main>`, index, total, 'stat');
}

function verifyHTML(card, index, total) {
  const { lede, body } = ledeBody(card.points);
  const stats = selectedStats(card, index);
  const bodySize = 29;
  return pageShell(`
  <main class="page layout-verify copy">
    <div class="kicker">${esc(card.tag || '')}</div>
    <h1 class="title" style="margin:24px 0 28px;">${esc(card.title)}</h1>
    <div class="lede" style="font-size:35px;">${lede}</div>
    ${statBlocks(stats, 3)}
    <section class="lower">
      <div class="body fitbody" data-base="${bodySize}" style="font-size:${bodySize}px;">${body}</div>
      ${imageHTML(card, 'fitbody').replace('class="image fitbody"', 'class="image fitbody" style="height:100%;"')}
    </section>
  </main>`, index, total, 'verify');
}

function quoteHTML(card, index, total) {
  const { lede, body } = ledeBody(card.points);
  const bodySize = 28;
  return pageShell(`
  <main class="page layout-quote copy">
    <div class="kicker">${esc(card.tag || '')}</div>
    <h1 class="title" style="margin:22px 0 30px;">${esc(card.title)}</h1>
    <blockquote class="lede bigquote">${lede}</blockquote>
    <div class="body columns fitbody" data-base="${bodySize}" style="font-size:${bodySize}px;">${body}</div>
  </main>`, index, total, 'quote').replace('<div class="topline"></div>',
    `<figure class="image" style="position:absolute;left:0;right:0;bottom:104px;height:430px;z-index:1;">${imageHTML(card)}</figure><div class="topline"></div>`);
}

function indexHTML(card, index, total) {
  const { lede } = ledeBody(card.points);
  const bodySize = 27;
  return pageShell(`
  <main class="page layout-index">
    <section class="left">
      <div class="kicker">${esc(card.tag || '')}</div>
      <h1 class="title" style="font-size:66px;margin:26px 0 30px;">${esc(card.title)}</h1>
      <div class="lede fitbody" data-base="${bodySize + 7}" style="font-size:${bodySize + 7}px;line-height:1.45;">${lede}</div>
      <div style="flex:1;"></div>
    </section>
    <section class="right">
      <div class="numbered fitbody" data-base="${bodySize}" style="flex:1;font-size:${bodySize}px;">${numberedRows(card.points)}</div>
      ${imageHTML(card).replace('class="image"', 'class="image" style="height:330px;margin:34px -96px 0;"')}
    </section>
  </main>`, index, total, 'index');
}

function weaveHTML(card, index, total) {
  const { lede } = ledeBody(card.points);
  const bodySize = 30;
  return pageShell(`
  <main class="page layout-weave copy">
    <section style="display:flex;flex-direction:column;min-width:0;">
      <div class="kicker">${esc(card.tag || '')}</div>
      <h1 class="title" style="font-size:66px;margin:24px 0 28px;">${esc(card.title)}</h1>
      <div class="lede" style="font-size:34px;margin-bottom:28px;">${lede}</div>
      <div class="body fitbody" data-base="${bodySize}" style="flex:1;font-size:${bodySize}px;">${richText(card.points[1] || '')}</div>
    </section>
    <section class="visual">
      ${imageHTML(card, 'fitbody').replace('class="image fitbody"', 'class="image fitbody" style="height:59%;"')}
      <div style="flex:1;background:#FFF;border-top:5px solid ${ACCENT2};padding:34px 32px;box-shadow:0 16px 36px rgba(60,48,37,.08);">
        <div style="font-size:23px;letter-spacing:3px;color:${ACCENT2};font-weight:700;">LOCAL-FIRST</div>
        <div style="width:44px;height:3px;background:${ACCENT2};margin:18px 0 22px;"></div>
        <div class="body" style="font-size:26px;line-height:1.58;">${richText(card.points[2] || '')}</div>
      </div>
    </section>
  </main>`, index, total, 'weave');
}

function stepsHTML(card, index, total) {
  const stats = selectedStats(card, index);
  const bodySize = 26;
  return pageShell(`
  <main class="page layout-steps copy">
    <div class="kicker">${esc(card.tag || '')}</div>
    <h1 class="title" style="margin:24px 0 26px;">${esc(card.title)}</h1>
    ${statBlocks(stats, 3)}
    <section class="lower">
      <div class="numbered fitbody" data-base="${bodySize}" style="font-size:${bodySize}px;">${numberedRows(card.points)}</div>
      <aside style="display:flex;flex-direction:column;min-width:0;">
        ${imageHTML(card, 'fitbody').replace('class="image fitbody"', 'class="image fitbody" style="flex:1;"')}
      </aside>
    </section>
  </main>`, index, total, 'steps');
}

function endpointHTML(card, index, total) {
  const { lede } = ledeBody(card.points);
  const stats = selectedStats(card, index);
  const bodySize = 29;
  return pageShell(`
  <main class="page layout-endpoint copy">
    <div class="kicker">${esc(card.tag || '')} · TIMELINE</div>
    <h1 class="title" style="font-size:82px;margin:30px 0 28px;">${esc(card.title)}</h1>
    <div class="lede" style="font-size:38px;">${lede}</div>
    ${statBlocks(stats, 3)}
    <div class="numbered timeline fitbody" data-base="${bodySize}" style="font-size:${bodySize}px;">${numberedRows(card.points)}</div>
  </main>`, index, total, 'endpoint');
}

function cardHTML(card, index, total) {
  const layouts = [heroHTML, statHTML, verifyHTML, quoteHTML, indexHTML, weaveHTML, stepsHTML, endpointHTML];
  return layouts[index - 2](card, index, total);
}

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1242, height: 1656 }, deviceScaleFactor: 2 });
  const shots = [['cover', coverFirstHTML(report.cards[0], 1, report.cards.length)]];
  report.cards.slice(1).forEach((card, offset) => {
    const index = offset + 2;
    shots.push([`info_${String(index).padStart(2, '0')}`, cardHTML(card, index, report.cards.length)]);
  });

  const failures = [];
  for (const [name, html] of shots) {
    const outputFile = path.join(OUT_DIR, `${name}.png`);
    try {
      const temporaryFile = path.join(OUT_DIR, `${name}.html`);
      fs.writeFileSync(temporaryFile, html);
      await page.goto(`file://${temporaryFile}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(120);

      for (let pass = 0; pass < 8; pass += 1) {
        const overflows = await page.evaluate(() => [...document.querySelectorAll('.fitbody')].map(element => ({
          overflow: element.scrollHeight - element.clientHeight,
          size: parseFloat(element.style.fontSize) || 0
        })));
        if (!overflows.some(item => item.overflow > 0)) break;
        for (const item of overflows.filter(item => item.overflow > 0)) {
          const nextSize = Math.max(20, Math.floor((item.size * Math.min(.96, 1 - item.overflow / 2600)) * 10) / 10);
          if (nextSize < item.size) {
            await page.evaluate(({ from, to }) => {
              const element = [...document.querySelectorAll('.fitbody')].find(node => parseFloat(node.style.fontSize) === from);
              if (element) element.style.fontSize = `${to}px`;
            }, { from: item.size, to: nextSize });
          }
        }
        await page.waitForTimeout(60);
      }

      const audit = await page.evaluate(() => ({
        title: Boolean(document.querySelector('.title')),
        footer: Boolean(document.querySelector('.footer')),
        badImages: [...document.querySelectorAll('img')].filter(img => !img.complete || img.naturalWidth === 0).length,
        overflow: [...document.querySelectorAll('.fitbody')].map(element => element.scrollHeight - element.clientHeight),
        layout: document.body.dataset.layout || 'unknown'
      }));
      if (!audit.title || !audit.footer || audit.badImages || audit.overflow.some(value => value > 0)) {
        throw new Error(`${name}: ${JSON.stringify(audit)}`);
      }
      await page.screenshot({ path: outputFile, clip: { x: 0, y: 0, width: 1242, height: 1656 } });
      console.log(`${outputFile} layout=${audit.layout} overflow=${audit.overflow.join(',') || 'none'} badImages=${audit.badImages}`);
    } catch (error) {
      failures.push(error.message);
      console.error(`SKIP ${error.message}`);
    }
  }
  await browser.close();
  if (failures.length) process.exit(1);
})();
