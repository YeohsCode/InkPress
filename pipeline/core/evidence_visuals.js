/* Figures generated from the same evidence-backed values validated in report.json. */
const { mastheadTitle, issueDateLabel } = require('./publication');
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function bars(visual) {
  return visual.panels.map(panel => {
    const maximum = Math.max(1, ...panel.rows.map(row => row.max_value ?? row.value));
    return `<section class="chart-panel"><h2>${esc(panel.title)}<small>${esc(panel.unit)}</small></h2>
      ${panel.rows.map(row => `<div class="chart-row"><span class="row-label">${esc(row.label)}</span>
        <div class="track"><div class="bar" style="width:${100 * row.value / maximum}%"></div>
          ${row.max_value === undefined ? '' : `<div class="range" style="left:${100 * row.value / maximum}%;width:${100 * (row.max_value - row.value) / maximum}%"></div>`}</div>
        <strong>${esc(row.value)}${row.max_value === undefined ? '' : `–${esc(row.max_value)}`}</strong></div>`).join('')}
      <div class="axis">0<span>各组独立尺度 · 条形从零起算</span></div></section>`;
  }).join('');
}

function diagram(visual) {
  return `<div class="diagram">${visual.nodes.map((node, i) => `<section class="diagram-node">
    <span class="node-number">${String(i + 1).padStart(2, '0')}</span>
    <strong>${esc(node.label)}</strong>${node.detail ? `<p>${esc(node.detail)}</p>` : ''}</section>`).join('')}</div>`;
}

function evidenceHTML(report, card, index, total) {
  const visual = card.visual;
  const isCover = index === 1;
  const title = isCover ? report.cover.title_lines.map(line => `<span>${esc(line)}</span>`).join('') : esc(card.title);
  const kind = visual.kind;
  let figure;
  if (kind === 'bars') figure = bars(visual);
  else if (kind === 'diagram') figure = diagram(visual);
  else figure = `<img src="${esc(card.design?.figure || card.image)}" alt="${esc(visual.caption)}">`;
  // Masthead, figure, caption and copy occupy separate grid rows in every mode.
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{width:1242px;height:1656px;overflow:hidden;background:#F7F4EF;color:#242019;
      font-family:"PingFang SC","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
    .topline{height:10px;background:#C8442A}
    .masthead{position:absolute;left:76px;right:76px;top:44px;display:flex;justify-content:space-between;
      gap:32px;font-size:21px;letter-spacing:1px;color:#756F67}
    .masthead>span:last-child{text-align:right}
    main{position:absolute;inset:122px 76px 132px;display:flex;flex-direction:column;gap:26px}
    header{flex:none}.kicker{font-size:23px;letter-spacing:3px;color:#9C402E;margin-bottom:16px}
    .title{font-family:"Songti SC",serif;font-size:68px;line-height:1.16;font-weight:800}
    .title span{display:block}.cover .title{font-size:62px}
    .cover header{display:flex;align-items:center;justify-content:space-between}
    .cover .kicker{max-width:330px;line-height:1.8}
    .visual{flex:none;padding:24px 28px;background:#FFF;border:1px solid #DDD6CA;
      border-top:5px solid #C8442A;display:flex;flex-direction:column;gap:20px;overflow:hidden}
    .visual.source_chart,.visual.photo{height:545px;padding:14px;background:#111827}
    .visual img{width:100%;height:100%;object-fit:contain;display:block}
    h2{font-size:25px;font-weight:650;margin-bottom:12px;display:flex;justify-content:space-between;gap:20px}
    h2 small{font-size:20px;font-weight:500;color:#756F67}
    .chart-row{display:grid;grid-template-columns:238px 1fr 125px;align-items:center;gap:20px;min-height:43px}
    .row-label{font-size:23px}.chart-row strong{font-size:27px;font-variant-numeric:tabular-nums;text-align:right;color:#9C402E}
    .track{height:18px;background:#F0ECE6;position:relative}.bar{height:100%;background:#C8442A;min-width:0}
    .range{position:absolute;top:0;height:100%;background:repeating-linear-gradient(90deg,#C8442A 0 4px,transparent 4px 8px)}
    .axis{margin:6px 145px 0 258px;font-size:16px;color:#756F67;display:flex;justify-content:space-between}
    .axis span{font-size:14px}
    .diagram{display:flex;gap:20px}.diagram-node{flex:1;min-width:0;padding:16px 18px;background:#F7F4EF;border-top:3px solid #1F5F7A}
    .node-number{display:block;color:#9C402E;font-size:20px;margin-bottom:12px}
    .diagram-node strong{font-size:28px;line-height:1.4;display:block}.diagram-node p{font-size:23px;line-height:1.6;margin-top:12px}
    .caption{font-size:21px;line-height:1.55;color:#6A645B;flex:none;overflow-wrap:anywhere}
    .caption .source{font-size:18px;color:#8A8378}
    .body{flex:1;min-height:0;overflow:hidden;column-count:2;column-gap:42px;column-fill:balance;font-size:30px;line-height:1.66}
    .body p{break-inside:auto}.body p+p{margin-top:22px}
    .footer{position:absolute;left:76px;right:76px;bottom:40px;display:flex;justify-content:space-between;
      padding-top:16px;border-top:1px solid #DAD3C8;font-size:22px;color:#8A8378}
  </style></head><body data-layout="evidence-${esc(kind)}" class="${isCover ? 'cover' : ''}">
    <div class="topline"></div>
    <div class="masthead"><span>${esc(report.series)}</span><span>${esc(mastheadTitle(report.cover.kicker))}</span></div>
    <main><header><div class="kicker">${esc(card.tag)}${isCover ? `<br>${esc(issueDateLabel(report.date))}` : ''}</div><h1 class="title">${title}</h1></header>
      <figure class="visual ${esc(kind)}" data-evidence-visual>${figure}</figure>
      <div class="caption">${esc(visual.caption)}<br><span class="source">来源：${esc(visual.source_url)}</span></div>
      <div class="body fitbody" data-fit-max="42" style="font-size:30px">${card.points.map((p,i) => `<p data-source-paragraph="${i}">${esc(p)}</p>`).join('')}</div>
    </main><div class="footer"><span>${esc(card.title)}</span><span>${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span></div>
  </body></html>`;
}

module.exports = { evidenceHTML };
