/* Editorial diagrams are explanatory drawings; quantitative bars use validated data. */
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const label = (x,y,text,size=26,fill='#193E46',anchor='middle') =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${esc(text)}</text>`;
const dot = (x,y,color='#DD623E',r=11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const line = (x,y,u,v,color='#B9C6C1',width=3) => `<path d="M${x},${y} L${u},${v}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
const svg = (content,height=460) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 ${height}" role="img" aria-label="关系示意" style="width:100%;height:100%;font-family:'PingFang SC',sans-serif">${content}</svg>`;

function maps(visual) {
  const nodes = visual.nodes;
  const left = [[100,310],[260,170],[415,260],[330,355],[155,110]];
  const right = [[655,125],[845,215],[930,345],[730,360],[990,100]];
  let output = `<path d="M540 60V430" stroke="#C5C8BC" stroke-dasharray="3 9"/>`;
  output += label(255,35,'同一组关系',25) + label(810,35,'另一套坐标',25);
  for (const positions of [left,right]) {
    for (let i=1;i<nodes.length;i++) output += line(...positions[i-1],...positions[i],'#7A9698',5);
    nodes.forEach((node,i) => { const [x,y]=positions[i];
      output += `<circle cx="${x}" cy="${y}" r="34" fill="#F1E4CA"/>` + dot(x,y,i===1?'#DD623E':'#193E46',13);
      output += label(x,y+65,node.label,25);
    });
  }
  return svg(output);
}

function constellation(visual) {
  let output = '';
  for(let x=40;x<600;x+=50) for(let y=30;y<850;y+=50) output += dot(x,y,'#D9D9CC',1.5);
  const positions=[[165,170],[310,290],[230,590],[400,720],[430,520]];
  output += `<ellipse cx="235" cy="235" rx="205" ry="175" fill="#19515A" fill-opacity=".08" transform="rotate(-15 235 235)"/>
    <ellipse cx="330" cy="650" rx="220" ry="185" fill="#DD623E" fill-opacity=".10" transform="rotate(20 330 650)"/>`;
  output += line(165,170,310,290,'#73999A',3) + line(230,590,400,720,'#C69A74',3);
  visual.nodes.forEach((node,i)=>{const [x,y]=positions[i];
    output += `<circle cx="${x}" cy="${y}" r="34" fill="${i<2?'#19515A':'#DD623E'}"/>`;
    output += label(x,y+9,String(i+1).padStart(2,'0'),23,'#FCF5E8');
    output += label(x,y+70,node.label,32);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" role="img" aria-label="近邻关系示意" style="width:100%;height:100%;font-family:'PingFang SC',sans-serif">${output}</svg>`;
}

function views(visual) {
  const [a,b,c] = visual.nodes;
  return svg(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="#DD623E" stroke-width="1.5"/></marker></defs>
    <path d="M110 30H495V155H110ZM585 30H970V155H585Z" fill="#F8F0DE" stroke="#D7D3C5"/>
    ${label(302,75,a.label,22)}${label(302,120,a.detail,29)}${label(777,75,b.label,22)}${label(777,120,b.detail,29)}
    <path d="M300 178Q300 235 465 275M780 178Q780 235 615 275" fill="none" stroke="#DD623E" stroke-width="3" marker-end="url(#arrow)"/>
    <ellipse cx="540" cy="330" rx="170" ry="105" fill="#E2E8DF" stroke="#9AAB8D" stroke-width="3"/>
    <circle cx="475" cy="315" r="16" fill="#193E46"/><circle cx="610" cy="350" r="16" fill="#DD623E"/>
    <path d="M490 320L595 345" fill="none" stroke="#7A9698" stroke-width="5"/>
    ${label(540,470,c.label,26)}`,500);
}

function humanNumber(value,unit) {
  if(unit==='百万次训练样本') return value>=100 ? `${Number((value/100).toFixed(3))} 亿` : `${Number((value*100).toFixed(3))} 万`;
  return `${value}${unit ? ' '+unit : ''}`;
}

function bars(visual) {
  return visual.panels.map(panel=>{
    const max=Math.max(1,...panel.rows.map(r=>r.max_value??r.value));
    return `<section class="editorial-chart"><div class="chart-heading">${esc(panel.title)}<span>${esc(panel.unit)}</span></div>
      ${panel.rows.map((row,i)=>`<div class="editorial-row"><div class="row-heading"><span>${esc(row.label)}</span><strong>${esc(humanNumber(row.value,panel.unit))}${row.max_value===undefined?'':` – ${esc(humanNumber(row.max_value,panel.unit))}`}</strong></div>
        <div class="track"><div class="bar ${i===0?'first':''}" style="width:${100*row.value/max}%"></div>${row.max_value===undefined?'':`<div class="range" style="left:${100*row.value/max}%;width:${100*(row.max_value-row.value)/max}%"></div>`}</div></div>`).join('')}
      <div class="axis">0<span>共用零基线 · 条长对应数值</span></div></section>`;
  }).join('');
}

function flow(visual) {
  const n = visual.nodes.length;
  const H = 90 + n * 108;
  let output = '';
  visual.nodes.forEach((node, i) => {
    const y = 30 + i * 108;
    output += `<path d="M120 ${y}H960V${y + 78}H120Z" fill="#F8F0DE" stroke="#D7D3C5"/>`;
    output += dot(150, y + 39, i === n - 1 ? '#DD623E' : '#193E46', 12);
    output += label(185, y + 33, node.label, 30, '#193E46', 'start');
    output += label(185, y + 66, node.detail || '', 22, '#5C6B67', 'start');
    if (i < n - 1) output += `<path d="M540 ${y + 82}V${y + 100}" stroke="#DD623E" stroke-width="3" marker-end="url(#flow-arrow)"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 ${H}" role="img" aria-label="流程示意" style="width:100%;height:100%;font-family:'PingFang SC',sans-serif"><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="#DD623E" stroke-width="1.5"/></marker></defs>${output}</svg>`;
}

function diagram(visual) {
  if (visual.layout === 'flow') return flow(visual);
  if(visual.layout==='maps') return maps(visual);
  if(visual.layout==='constellation') return constellation(visual);
  if(visual.layout==='views') return views(visual);
  // A connected drawing is the default; never replace a requested figure with label cards.
  return maps(visual);
}

module.exports={ diagram,bars,humanNumber };
