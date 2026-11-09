/* Page roles, not one repeated column template. All copy stays in the report. */
const { diagram,bars } = require('./editorial_figures');
const { publicationTitle } = require('./publication');
const esc = value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const layouts=new Set(['cover','atlas','plate','maps','process','data','source','essay','closing']);
const paragraph=(text,index,cls='')=>`<p class="source-copy ${cls}" data-source-paragraph="${index}">${esc(text)}</p>`;
function copy(card,{start=0,end=card.points.length,cls='',max=35,min=30}={}) {
  return `<div class="body fitbody ${cls}" data-fit-min="${min}" data-fit-max="${max}" style="font-size:${max}px">${card.points.slice(start,end).map((p,i)=>paragraph(p,i+start)).join('')}</div>`;
}
function heading(card,cls='') {
  const lines=card.design?.title_lines;
  if(lines && lines.join('')!==card.title) throw new Error(`Design title differs from copy: ${card.title}`);
  return `<header class="${cls}"><div class="kicker">${esc(card.tag)}</div><h1 class="title">${lines?lines.map(s=>`<span>${esc(s)}</span>`).join(''):esc(card.title)}</h1></header>`;
}
function figure(card,cls='') {
  const v=card.visual;
  if(!v) return '';
  let inner;
  if(v.kind==='bars') inner=bars(v);
  else if(v.kind==='diagram') inner=diagram(v);
  else inner=`<img src="${esc(card.design?.figure||card.image)}" alt="${esc(v.caption)}">`;
  return `<figure class="editorial-figure ${esc(v.kind)} ${cls}" ${v.kind==='illustration'?'data-editorial-art':'data-evidence-visual'}><div class="figure-content">${inner}</div><figcaption class="caption">${esc(v.caption)}</figcaption></figure>`;
}

function content(card,layout) {
  if(layout==='cover') return `<figure class="cover-art" data-editorial-art><img data-art-background="true" src="${esc(card.design?.figure||card.image)}" alt="${esc(card.visual.caption)}"></figure><div class="cover-gradient"></div>
    <main class="cover-main">${heading(card)}${card.design?.subject ? `<div class="cover-subject" data-audit-copy>${esc(card.design.subject)}</div>` : ''}</main>
    <section class="cover-copy">${copy(card,{max:31,min:29})}<div class="caption">${esc(card.visual.caption)}</div></section>`;
  if(layout==='closing') return `<main class="closing-main">${heading(card)}${copy(card,{max:37,min:33})}${figure(card)}</main>`;
  if(layout==='plate') return `<main class="spread-main plate-main">${heading(card)}${figure(card)}${copy(card,{max:35,min:32})}</main>`;
  if(layout==='data') {
    const feature = card.design?.feature?.value != null && String(card.design.feature.value).trim();
    return `<main class="spread-main data-main ${feature?'with-feature':'without-feature'}">${heading(card)}${feature ? `<div class="data-display" data-audit-copy><strong>${esc(card.design.feature.value)}</strong><span>${esc(card.design.feature.label||'')}</span></div>` : ''}${figure(card)}${copy(card,{max:33,min:30})}</main>`;
  }
  if(layout==='source') return `<main class="spread-main source-main">${heading(card)}${figure(card)}${copy(card,{max:33,min:30})}</main>`;
  if(layout==='essay') return `<main class="spread-main essay-main">${heading(card)}${copy(card,{end:1,cls:'essay-lead',max:44,min:40})}<div class="essay-rule"></div>${copy(card,{start:1,cls:'essay-rest',max:36,min:32})}</main>`;
  if(layout==='maps') return `<main class="spread-main maps-main">${heading(card)}${copy(card,{end:1,cls:'standfirst',max:36,min:33})}${figure(card)}${copy(card,{start:1,max:34,min:31})}</main>`;
  if(layout==='process') return `<main class="spread-main process-main">${heading(card)}${figure(card)}${copy(card,{max:35,min:32})}</main>`;
  return `<main class="spread-main atlas-main">${heading(card)}${figure(card)}${copy(card,{max:35,min:32})}</main>`;
}

function editorialHTML(report,card,index,total) {
  const layout=card.design?.layout || (card.visual?.kind==='bars'?'data':card.visual?.kind==='diagram'?'atlas':card.image?'plate':'essay');
  if(!layouts.has(layout)) throw new Error(`Unknown editorial layout: ${layout}`);
  if(['cover','closing','plate'].includes(layout) && (!card.image&&!card.design?.figure)) throw new Error(`${layout} requires an image`);
  if(layout==='cover' && !['illustration','photo'].includes(card.visual?.kind)) throw new Error('cover requires an illustration or photo; use source layout for evidence charts');
  const dark=['cover','closing'].includes(layout);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}html,body{width:1242px;height:1656px}
    body{position:relative;overflow:hidden;background:#F0EEE5;color:#193A41;font-family:"PingFang SC","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
    body.dark{background:#102D35;color:#F4EDDC}.masthead{position:absolute;top:42px;left:78px;right:78px;height:54px;display:flex;justify-content:space-between;align-items:start;border-bottom:1px solid #B6BEB6;font-size:22px;letter-spacing:1px;z-index:3}
    .masthead .brand{font-family:"Avenir Next",sans-serif;font-weight:750;letter-spacing:3px}.dark .masthead{border-color:#F4EDDC66}
    .footer{position:absolute;bottom:36px;left:78px;right:78px;display:flex;justify-content:space-between;align-items:center;font-size:21px;letter-spacing:1px;z-index:3;min-height:32px}
    .folio{font-family:"Avenir Next",sans-serif;font-size:25px}.footer .section-name{color:#7B8C89}.dark .footer .section-name{color:#CED3C6}
    .kicker{font-size:24px;letter-spacing:3px;margin-bottom:24px;color:#BB563B;font-weight:600}.dark .kicker{color:#E2B779}
    .title{font-family:"Songti SC","Noto Serif CJK SC",serif;font-size:88px;line-height:1.16;font-weight:800;letter-spacing:-1px;text-wrap:balance;word-break:normal}.title span{display:block}
    .body{line-height:1.64;min-height:0;overflow:hidden;flex:1;word-break:normal;overflow-wrap:break-word;line-break:strict;text-wrap:pretty}.body p+p{margin-top:23px}.source-copy{widows:2;orphans:2}
    .spread-main{position:absolute;inset:146px 78px 122px;display:flex;flex-direction:column;gap:30px}
    .spread-main header{flex:none}.caption{font-size:22px;line-height:1.45;color:#687D7D}.dark .caption{color:#BFCBC2}.editorial-figure{flex:none;display:flex;flex-direction:column;gap:14px;margin:0;min-height:0}
    .figure-content{height:100%;min-height:0;overflow:hidden}.editorial-figure img{display:block;width:100%;height:100%;object-fit:contain}.editorial-figure.illustration img{object-fit:cover}
    .atlas-main{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto minmax(0,1fr);gap:50px 42px}.atlas-main header{grid-column:1/-1}.atlas-main .editorial-figure{height:auto;min-height:0;margin:0 -20px;align-self:stretch}.atlas-main .figure-content{flex:1}.atlas-main .body{padding-top:45px}
    .maps-main .editorial-figure{height:430px}.maps-main .standfirst{flex:none;max-height:190px;color:#4F686C}
    .process-main .editorial-figure{height:510px;margin:0 -20px}.process-main .body{max-width:1010px}
    .plate-main{gap:28px}.plate-main .editorial-figure{height:auto;flex:1;min-height:430px;max-height:660px;margin:0 -78px}.plate-main .caption{padding:0 78px}.plate-main .body{max-width:1005px;flex:none}.plate-main .illustration img{object-position:center 62%}
    .source-main{gap:25px}.source-main .title{font-size:79px}.source-main .editorial-figure{height:710px;background:#FFF;padding:26px 24px 0}.source-main .figure-content{flex:1}.source-main .caption{padding:12px 0 15px;border-top:1px solid #DDD}
    .data-main{gap:22px}.data-main .title{font-size:79px}.data-display{height:310px;flex:none;display:flex;align-items:center;gap:44px;color:#DD623E}.data-display strong{font-family:"Avenir Next",sans-serif;font-weight:750;font-size:225px;line-height:1;letter-spacing:-12px}.data-display span{font-size:26px;max-width:340px;line-height:1.6;color:#4D6669}
    .data-main .editorial-figure{height:auto;margin:0 0 8px}.chart-heading{font-size:23px;display:flex;justify-content:space-between;margin-bottom:24px}.chart-heading span{color:#7E8C89;font-size:20px}.editorial-row{margin-bottom:27px}.row-heading{display:flex;justify-content:space-between;align-items:baseline;font-size:25px;margin-bottom:12px}.row-heading strong{font-family:"Avenir Next","PingFang SC",sans-serif;font-size:41px}.track{height:30px;background:#D9DDD2;position:relative}.bar{height:100%;background:#193E46}.bar.first{background:#DD623E}.range{position:absolute;top:0;height:100%;background:repeating-linear-gradient(90deg,#DD623E 0 3px,transparent 3px 6px)}.axis{display:flex;justify-content:space-between;font-size:18px;color:#798B85;margin-top:-10px;margin-bottom:22px}.axis span{font-size:19px}
    .data-main.without-feature .editorial-figure{flex:1;min-height:400px;max-height:900px}.data-main.without-feature .figure-content{flex:1;display:flex;flex-direction:column;gap:24px}.data-main.without-feature .editorial-chart{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0}.data-main.without-feature .body{flex:none;margin-top:auto}.data-main.without-feature .track{height:44px}.data-main.without-feature .editorial-row{margin-bottom:12px}
    .essay-main{gap:40px}.essay-main header{padding-top:30px}.essay-main .title{font-size:108px}.essay-lead{flex:none;margin-top:45px;font-family:"Songti SC",serif;line-height:1.55;max-height:450px}.essay-rule{width:90px;height:5px;background:#DD623E;flex:none}.essay-rest{max-width:990px}
    .cover-art{position:absolute;inset:0}.cover-art img{width:100%;height:100%;display:block;object-fit:cover}.cover-gradient{position:absolute;inset:0;background:linear-gradient(180deg,#0D2635B8 0%,#0D2635A6 28%,transparent 49%,transparent 67%,#0C2635F0 90%)}
    .cover-main{position:absolute;top:150px;left:78px;right:78px}.cover-main .title{font-size:116px;line-height:1.08;letter-spacing:-3px}.cover-main .kicker{font-size:25px;margin-bottom:27px}.cover-subject{margin-top:22px;font-size:20px;letter-spacing:2px;color:#DDD5BC}
    .cover-copy{position:absolute;left:78px;right:78px;bottom:124px;display:flex;flex-direction:column;gap:20px;max-height:300px}.cover-copy .body{flex:none}.cover-copy .caption{font-size:19px;line-height:1.3}.cover-copy .body p+p{margin-top:15px}
    .closing-main{position:absolute;inset:150px 78px 122px;display:flex;flex-direction:column;gap:34px}.closing-main .title{font-size:100px}.closing-main .body{flex:1;max-width:1010px}.closing-main .editorial-figure{height:430px;margin:0 -78px -5px}.closing-main .figure-content{object-position:center 75%}.closing-main .caption{padding:0 78px}.closing-main .illustration img{object-position:center 65%}
  </style></head><body data-layout="editorial-${layout}" class="${dark?'dark':''}">
    <div class="masthead"><span class="brand">${esc(publicationTitle(report))}</span><span>${esc(report.date.replaceAll('-','.'))} / ${esc(report.design?.section || (publicationTitle(report).includes('Weekly') ? 'WEEKLY' : 'DAILY'))}</span></div>
    ${content(card,layout)}<div class="footer"><span class="section-name">${esc(card.tag)}</span><span class="folio">${String(index).padStart(2,'0')} <span style="font-size:18px;opacity:.6">/ ${String(total).padStart(2,'0')}</span></span></div>
  </body></html>`;
}

module.exports={ editorialHTML,layouts };
