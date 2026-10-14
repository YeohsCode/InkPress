/* Magazine layouts: content-led grids, full-bleed photographs and readable copy. */
const { mastheadTitle } = require('./publication');
const escapeHTML = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headline(card, extra = '') {
  const lines = card.design?.title_lines || [card.title];
  if (lines.join('') !== card.title) throw new Error(`Design title differs from copy: ${card.title}`);
  return `<h1 class="title ${extra}">${lines.map(line => `<span>${escapeHTML(line)}</span>`).join('')}</h1>`;
}
const paragraph = (text, index, cls = '') => `<p class="source-copy ${cls}" data-source-paragraph="${index}">${escapeHTML(text)}</p>`;
const body = (card, start = 1, cls = '') => `<div class="body fitbody ${cls}" data-base="34" style="font-size:34px;">${card.points.slice(start).map((p, i) => paragraph(p, i + start)).join('')}</div>`;
const lede = card => paragraph(card.points[0], 0, 'lede');
const image = (card, cls = '', override) => {
  const file = override || card.design?.figure || card.image;
  return file ? `<figure class="figure ${cls}"><img src="${escapeHTML(file)}" alt="">${card.design?.caption ? `<figcaption>${escapeHTML(card.design.caption)}</figcaption>` : ''}</figure>` : '';
};
const label = card => `<div class="eyebrow">${escapeHTML(card.tag || '')}</div>`;
function feature(card, cls = '') {
  if (!card.design?.feature) return '';
  const f = card.design.feature;
  return `<div class="feature ${cls}"><strong>${escapeHTML(f.value)}</strong><span>${escapeHTML(f.label)}</span></div>`;
}

function cover(card, report) {
  const lines = report.cover.title_lines;
  return `${image(card, 'cover-photo')}<div class="cover-shade"></div>
    <main class="cover-content"><div class="eyebrow">${escapeHTML(card.tag)}</div>
      <h1 class="title cover-title">${lines.map((s, i) => `<span class="${i === lines.length - 1 ? 'accent' : ''}">${escapeHTML(s)}</span>`).join('')}</h1>
      ${lede(card)}</main>
    <section class="cover-bottom">${body(card, 1, 'columns')}</section>`;
}

function showcase(card) {
  return `<main class="canvas showcase"><header>${label(card)}${headline(card)}${lede(card)}</header>
    ${image(card, 'screen')}${body(card, 1, 'columns')}</main>`;
}

function proof(card) {
  return `<main class="canvas proof"><header>${label(card)}${headline(card)}</header>
    <section class="proof-band"><div>${feature(card)}<div class="formula">${escapeHTML(card.design?.formula || '')}</div></div><div class="proof-lede">${lede(card)}</div></section>
    ${image(card, 'screen')}${body(card, 1, 'columns')}</main>`;
}

function engineering(card) {
  return `${image(card, 'engineering-photo')}<div class="engineering-shade"></div>
    <main class="canvas engineering"><header>${label(card)}${headline(card)}${lede(card)}</header>
      <section class="engineering-copy">${body(card)}${feature(card, 'engineering-feature')}</section></main>`;
}

function editorial(card) {
  return `<main class="canvas editorial"><header>${label(card)}${headline(card)}</header>
    <section class="editorial-lede">${lede(card)}${feature(card)}</section>
    ${image(card, 'screen')}${body(card, 1, 'columns')}</main>`;
}

function split(card) {
  return `${image(card, 'split-photo')}<main class="canvas split">
    <header>${label(card)}${feature(card)}${headline(card)}</header>
    <section class="split-copy">${lede(card)}${body(card)}</section></main>`;
}

function service(card) {
  return `${image(card, 'service-photo')}<div class="service-shade"></div>
    <main class="canvas service"><header>${label(card)}${headline(card)}${lede(card)}</header>
      <section class="service-copy">${body(card, 1, 'columns')}</section></main>`;
}

function limits(card) {
  return `<main class="canvas limits"><header>${label(card)}${headline(card)}${lede(card)}</header>
    <section class="limit-metric">${feature(card)}<div class="metric-rule"></div></section>
    ${body(card)}${image(card, 'screen')}</main>`;
}

function closing(card) {
  return `<main class="canvas closing"><header>${label(card)}${headline(card)}</header>
    <section class="closing-lede">${lede(card)}</section>
    <section class="closing-copy">${body(card)}</section>
    <div class="closing-mark">${escapeHTML(card.design?.feature?.value || '')}</div></main>`;
}

const layouts = { cover, showcase, proof, engineering, editorial, split, service, limits, closing };

function magazineHTML(report, card, index, total) {
  const fallback = index === 1 ? 'cover' : card.image ? 'showcase' : 'editorial';
  const kind = card.design?.layout || fallback;
  const render = layouts[kind];
  if (!render) throw new Error(`Unknown magazine layout: ${kind}`);
  const dark = ['cover', 'engineering', 'service', 'closing'].includes(kind);
  const accent = report.design?.accent || '#F0BD35';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    * { box-sizing:border-box; margin:0; padding:0; }
    html,body { width:1242px;height:1656px;overflow:hidden;-webkit-font-smoothing:antialiased; }
    body { --accent:${accent};--paper:#F4F0E6;--ink:#171917;background:var(--paper);color:var(--ink);
      font-family:"PingFang SC","Helvetica Neue",sans-serif; }
    body.dark { background:var(--ink);color:var(--paper); }
    .masthead { position:absolute;top:49px;left:74px;right:74px;display:flex;align-items:center;justify-content:space-between;
      z-index:10;font-size:23px;letter-spacing:2px;font-weight:600; }
    .masthead .brand { border-left:7px solid var(--accent);padding-left:17px; }
    .masthead .issue { font-size:19px;letter-spacing:1px;opacity:.8; }
    .footer { position:absolute;bottom:37px;left:74px;right:74px;z-index:10;display:flex;justify-content:space-between;
      align-items:center;border-top:1px solid currentColor;padding-top:18px;font-size:20px;letter-spacing:2px; }
    .pageno { font-weight:700;font-variant-numeric:tabular-nums; }
    .canvas { position:absolute;top:150px;left:74px;right:74px;bottom:116px;z-index:2; }
    .eyebrow { font-size:23px;letter-spacing:5px;font-weight:650;display:flex;align-items:center;gap:16px; }
    .eyebrow::before { content:"";height:4px;width:40px;background:var(--accent); }
    .title { font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:88px;line-height:1.14;font-weight:900;letter-spacing:-1px;
      margin:26px 0 32px;text-wrap:balance; }
    .title>span { display:block; }
    .lede { font-family:"Songti SC","Noto Serif CJK SC",serif;font-weight:700;font-size:38px;line-height:1.48; }
    .body { line-height:1.65;text-align:left;overflow-wrap:break-word; }
    .body p+p { margin-top:30px; }
    .columns { column-count:2;column-gap:46px;column-fill:balance; }
    .columns p { break-inside:auto; }
    .figure { overflow:hidden;position:relative; }
    .figure img { display:block;width:100%;height:100%;object-fit:cover; }
    .figure figcaption { position:absolute;bottom:0;left:0;right:0;padding:12px 18px;background:rgba(15,18,17,.82);color:white;font-size:19px; }
    .screen { background:#E8E3D9; }
    .screen img { object-fit:contain; }
    .fitbody { overflow:hidden;min-height:0; }
    .feature strong { display:block;font-family:"Avenir Next","Helvetica Neue",sans-serif;font-size:164px;line-height:.92;font-weight:850;letter-spacing:-8px; }
    .feature span { display:block;font-size:25px;letter-spacing:2px;margin-top:18px; }
    .cover-photo { position:absolute;top:0;left:0;width:1242px;height:1050px; }
    .cover-photo img { object-position:50% 40%; }
    .cover-shade { position:absolute;inset:0 0 auto;height:1050px;background:linear-gradient(180deg,rgba(6,12,14,.76),rgba(6,12,14,.15)); }
    .cover-content { position:absolute;top:180px;left:74px;right:74px;z-index:2; }
    .cover-title { font-size:139px;line-height:1.05;margin:40px 0 42px; }
    .cover-title .accent { color:var(--accent); }
    .cover-content .lede { max-width:920px;font-size:43px; }
    .cover-bottom { position:absolute;top:1030px;bottom:0;left:0;right:0;background:var(--paper);color:var(--ink);padding:62px 74px 152px;z-index:3;
      border-top:12px solid var(--accent); }
    .cover-bottom .body { height:100%; }
    body.layout-cover .footer { color:var(--ink); }
    .showcase { display:flex;flex-direction:column; }
    .showcase .title { font-size:92px; }
    .showcase .screen { height:500px;flex:none;margin:38px -74px 34px; }
    .showcase .body { flex:1; }
    .proof { display:flex;flex-direction:column; }
    .proof .title { font-size:91px; }
    .proof-band { display:grid;grid-template-columns:350px 1fr;align-items:center;gap:46px;padding:30px 0;border-top:3px solid var(--ink);border-bottom:1px solid #BEB9AE; }
    .proof .feature strong { font-size:165px; }
    .formula { font-family:"Menlo",monospace;font-size:25px;margin-top:22px; }
    .proof-lede { border-left:10px solid var(--accent);padding-left:38px; }
    .proof .screen { height:310px;flex:none;margin:28px 0; }
    .proof .body { flex:1; }
    .engineering-photo { position:absolute;inset:0; }
    .engineering-photo img { object-position:63% 50%; }
    .engineering-shade { position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,15,17,.87),rgba(9,15,17,.12) 54%,rgba(9,15,17,.85)); }
    .engineering { display:flex;flex-direction:column; }
    .engineering .title { font-size:89px;max-width:1060px; }
    .engineering header { max-width:1000px; }
    .engineering-copy { margin-top:auto;display:grid;grid-template-columns:720px 1fr;gap:42px;align-items:end;background:rgba(9,15,17,.84);
      padding:38px 40px;margin-left:-40px;margin-right:-40px;border-top:6px solid var(--accent); }
    .engineering-copy .body { height:620px; }
    .engineering-feature { padding-bottom:24px;border-left:1px solid #85877A;padding-left:34px; }
    .engineering-feature strong { font-size:104px;letter-spacing:-5px; }
    .engineering-feature span { font-size:25px;line-height:1.5; }
    .editorial { display:flex;flex-direction:column; }
    .editorial .title { font-size:87px; }
    .editorial-lede { display:grid;grid-template-columns:1fr 240px;gap:50px;align-items:center;padding:22px 0 30px; }
    .editorial-lede .feature { background:var(--accent);padding:26px 25px;color:var(--ink); }
    .editorial-lede .feature strong { font-size:106px;letter-spacing:-6px; }
    .editorial-lede .feature span { font-size:23px; }
    .editorial .screen { flex:none;height:390px;margin:22px -74px 30px; }
    .editorial .body { flex:1; }
    .split-photo { position:absolute;top:0;bottom:0;left:0;width:465px; }
    .split-photo::after { content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,18,20,.78),rgba(10,18,20,.23)); }
    .split { display:grid;grid-template-columns:328px 1fr;gap:108px; }
    .split header { color:var(--paper);display:flex;flex-direction:column; }
    .split .feature { margin:64px 0 55px;color:var(--accent); }
    .split .feature strong { font-size:146px;letter-spacing:-8px; }
    .split .title { font-size:58px;line-height:1.22;margin:0 0 32px; }
    .split .lede { font-size:31px; }
    .split-copy { display:flex;flex-direction:column;justify-content:flex-start;padding-top:78px;gap:75px; }
    .split-copy>.lede { font-size:45px;border-top:8px solid var(--accent);padding-top:32px; }
    .split-copy .body { line-height:1.75;height:auto;max-height:100%; }
    body.layout-split .masthead .brand,body.layout-split .footer>span:first-child { color:var(--paper); }
    .service-photo { position:absolute;top:0;left:0;width:1242px;height:1030px; }
    .service-photo img { object-position:center; }
    .service-shade { position:absolute;inset:0 0 auto;height:1030px;background:linear-gradient(180deg,rgba(7,12,12,.76),rgba(7,12,12,.08)); }
    .service header { max-width:970px; }
    .service .title { font-size:105px; }
    .service-copy { position:absolute;top:800px;left:-74px;right:-74px;bottom:-116px;background:var(--paper);color:var(--ink);border-top:12px solid var(--accent);padding:48px 74px 141px; }
    .service-copy .body { height:100%; }
    body.layout-service .footer { color:var(--ink);background:var(--paper); }
    .limits { display:flex;flex-direction:column; }
    .limits .title { font-size:88px; }
    .limit-metric { display:flex;align-items:center;gap:50px;margin:36px 0 38px; }
    .limit-metric .feature { display:flex;align-items:baseline;gap:30px; }
    .limit-metric .feature strong { font-size:112px;letter-spacing:-5px; }
    .limit-metric .feature span { font-size:26px; }
    .metric-rule { height:9px;background:var(--accent);flex:1; }
    .limits .body { flex:1;column-count:2;column-gap:46px; }
    .limits .body p { break-inside:auto; }
    .limits .screen { height:340px;flex:none;margin-top:30px; }
    .closing { display:flex;flex-direction:column; }
    .closing .title { font-size:112px;color:var(--accent);margin-top:55px; }
    .closing-lede { padding:34px 0 45px;border-bottom:1px solid #74776B; }
    .closing-copy { margin-top:52px;width:1020px; }
    .closing-copy .body { max-height:700px;line-height:1.75; }
    .closing-mark { margin-top:auto;font-family:"Avenir Next",sans-serif;font-size:196px;line-height:1;font-weight:800;letter-spacing:-8px;color:var(--accent);opacity:.95; }
  </style></head><body class="layout-${kind} ${dark ? 'dark' : ''}" data-layout="magazine-${kind}">
    <div class="masthead"><span class="brand">${escapeHTML(report.series || 'AI 圈每天深读')}</span><span class="issue">${escapeHTML(mastheadTitle(report.cover.kicker))}</span></div>
    ${render(card, report)}
    <div class="footer"><span>${escapeHTML(card.tag || '')}</span><span class="pageno">${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span></div>
  </body></html>`;
}

module.exports = { magazineHTML };
