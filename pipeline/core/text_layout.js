/* Text-only pages never reserve space for an absent photograph. */
const { mastheadTitle, issueDateLabel } = require('./publication');
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function textHTML(report, card, index, total) {
  const title = index === 1 ? report.cover.title_lines.map(s => `<span>${esc(s)}</span>`).join('') : esc(card.title);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{width:1242px;height:1656px;overflow:hidden;background:#F7F4EF;color:#242019;
      font-family:"PingFang SC","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
    .topline{height:10px;background:#C8442A}
    .masthead{position:absolute;left:76px;right:76px;top:44px;display:flex;justify-content:space-between;
      gap:32px;font-size:21px;color:#756F67}.masthead>span:last-child{text-align:right}
    main{position:absolute;inset:126px 76px 132px;display:flex;flex-direction:column;gap:38px}
    header{flex:none;padding-bottom:30px;border-bottom:3px solid #C8442A}
    .kicker{font-size:23px;letter-spacing:3px;color:#9C402E;margin-bottom:20px}
    .title{font-family:"Songti SC",serif;font-size:66px;line-height:1.18;font-weight:800;overflow-wrap:anywhere;text-wrap:balance}
    .title span{display:block}
    .body{flex:1;min-height:0;overflow:hidden;column-count:2;column-gap:46px;column-fill:balance;
      line-height:1.66;overflow-wrap:anywhere;color:#38332C}
    .body p{break-inside:auto}.body p+p{margin-top:26px}
    .footer{position:absolute;left:76px;right:76px;bottom:40px;display:flex;justify-content:space-between;
      gap:28px;padding-top:16px;border-top:1px solid #DAD3C8;font-size:22px;color:#8A8378}
  </style></head><body data-layout="text">
    <div class="topline"></div><div class="masthead"><span>${esc(report.series)}</span><span>${esc(mastheadTitle(report.cover.kicker))}</span></div>
    <main><header><div class="kicker">${esc(card.tag)} · ${esc(issueDateLabel(report.date))}</div><h1 class="title">${title}</h1></header>
      <div class="body fitbody" data-fit-max="42" style="font-size:30px">${card.points.map((p,i) => `<p data-source-paragraph="${i}">${esc(p)}</p>`).join('')}</div>
    </main><div class="footer"><span>${esc(report.series)}</span><span>${String(index).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span></div>
  </body></html>`;
}

// Runs after fonts and images settle. Grow short copy as well as shrinking long copy.
function fitCopy() {
  for (const element of document.querySelectorAll('[data-fit-max]')) {
    let low = Number(element.dataset.fitMin) || 20, high = Number(element.dataset.fitMax);
    for (let pass = 0; pass < 12; pass++) {
      const middle = (low + high) / 2;
      element.style.fontSize = `${middle}px`;
      if (element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) low = middle;
      else high = middle;
    }
    element.style.fontSize = `${Math.floor(low * 10) / 10}px`;
  }
}

module.exports = { textHTML, fitCopy };
