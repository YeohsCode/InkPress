const assert=require('node:assert/strict');
const { test }=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const { spawnSync }=require('node:child_process');
const { chromium }=require('/Users/andrewyeoh/Werk/HermesAgent/code/node_modules/playwright');
const { editorialHTML }=require('../pipeline/core/editorial_layouts');
const { auditCopy,auditFigures }=require('../pipeline/core/render_audit');
const { fitCopy }=require('../pipeline/core/text_layout');

test('editorial cover art and evidence charts have separate overlay rules',async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1242,height:1656}});
    const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="1656"><rect width="1242" height="1656" fill="#12343c"/></svg>');
    const report={date:'2026-11-04'};
    const cover={tag:'封面',title:'两种入口，同一个世界',design:{layout:'cover'},image,
      points:['模型在不同观察中学习共同关系。'],visual:{kind:'illustration',caption:'AI 概念插画'}};
    await page.setContent(editorialHTML(report,cover,1,2));
    await page.evaluate(()=>document.fonts.ready);await page.evaluate(fitCopy);
    assert.deepEqual(await page.evaluate(auditCopy,{checkImages:false}),[]);
    assert.deepEqual(await page.evaluate(auditFigures,{images:1,visuals:0}),[]);
    assert.deepEqual(await page.locator('[data-source-paragraph]').allTextContents(),cover.points);
    const photoCover={...cover,title:'新一代芯片发布',visual:{kind:'photo',caption:'芯片示意照片'},
      design:{layout:'cover',subject:'硬件观察'}};
    await page.setContent(editorialHTML({...report,design:{section:'HARDWARE'}},photoCover,1,2));
    await page.evaluate(()=>document.fonts.ready);await page.evaluate(fitCopy);
    assert.deepEqual(await page.evaluate(auditCopy,{checkImages:false}),[]);
    assert.deepEqual(await page.evaluate(auditFigures,{images:1,visuals:0}),[]);
    assert.doesNotMatch(await page.locator('body').innerText(),/柏拉图|SCIENCE/);
    assert.match(await page.locator('body').innerText(),/硬件观察/);
    assert.throws(()=>editorialHTML(report,{...cover,visual:{kind:'source_chart'}},1,2),/use source layout/);
    const card={tag:'样本比较',title:'样本数量的差别',design:{layout:'data',feature:{value:'42×',label:'样本数之比'}},
      points:['新方法用2160万次训练样本，另一方法用9亿次样本。'],visual:{kind:'bars',caption:'按已核实数据重绘。',
        panels:[{title:'训练样本数',unit:'百万次训练样本',rows:[{label:'新方法',value:21.6},{label:'另一方法',value:900}]}]}};
    await page.setContent(editorialHTML(report,card,2,2));
    await page.evaluate(()=>document.fonts.ready);await page.evaluate(fitCopy);
    assert.deepEqual(await page.evaluate(auditCopy),[]);
    assert.deepEqual(await page.evaluate(auditFigures,{visuals:1}),[]);
    assert.deepEqual(await page.locator('.row-heading strong').allTextContents(),['2160 万','9 亿']);
    const widths=await page.locator('.bar').evaluateAll(nodes=>nodes.map(n=>parseFloat(n.style.width)));
    assert(Math.abs(widths[0]/widths[1]-21.6/900)<1e-8);
    await page.evaluate(()=>{
      const chart=document.querySelector('[data-evidence-visual]').getBoundingClientRect();
      const title=document.querySelector('.title');title.style.position='fixed';title.style.top=chart.top+'px';
    });
    assert((await page.evaluate(auditCopy,{checkImages:false})).some(i=>i.reason==='overlaps image'));
  } finally {await browser.close();}
});

test('renderer honors the editorial page plan before selecting evidence or text fallbacks',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'editorial-routing-'));
  try {
    fs.writeFileSync(path.join(root,'art.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="1656"><rect width="1242" height="1656" fill="#12343c"/></svg>');
    const report={date:'2026-11-04',series:'Daily',design:{style:'editorial'},cover:{title_lines:['共同世界'],kicker:'Daily'},
      references:[{url:'https://example.com/source'}],cards:[
        {title:'共同世界',tag:'封面',points:['不同观察可能保留共同关系。'],design:{layout:'cover'},image:'art.svg',
          visual:{kind:'illustration',source_url:'https://example.com/source',caption:'AI 概念插画',evidence:'共同关系'}},
        {title:'两条相同的路线',tag:'机制',points:['车站连着广场，广场连着公园。'],design:{layout:'maps'},
          visual:{kind:'diagram',layout:'maps',source_url:'https://example.com/source',caption:'关系示意。',evidence:'车站连着广场',
            nodes:[{label:'车站',evidence:'车站'},{label:'广场',evidence:'广场'},{label:'公园',evidence:'公园'}]}}
      ]};
    const input=path.join(root,'report.json'),output=path.join(root,'images');
    fs.writeFileSync(input,JSON.stringify(report));
    const result=spawnSync(process.execPath,['pipeline/core/render_html.js',input,'--out-dir',output],
      {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:60000});
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.match(fs.readFileSync(path.join(output,'cover.html'),'utf8'),/data-layout="editorial-cover"/);
    assert.match(fs.readFileSync(path.join(output,'info_02.html'),'utf8'),/data-layout="editorial-maps"/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output,'manifest.json'))).images.length,2);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('editorial figures do not inject a previous story into new topics',()=>{
  const {diagram,bars}=require('../pipeline/core/editorial_figures');
  const rendered=diagram({layout:'views',nodes:[{label:'音频',detail:'声音输入'},{label:'图像',detail:'视觉输入'},{label:'共同特征'}]});
  assert.match(rendered,/共同特征/);
  assert.doesNotMatch(rendered,/C1A678|飞盘|狗/);
  assert.doesNotMatch(bars({panels:[{title:'电量',unit:'千瓦时',rows:[{label:'一月',value:100}]}]}),/样本数量/);
});


test('weekly uses the shared editorial renderer with its own masthead and no empty data callout',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'weekly-editorial-'));
  const browser=await chromium.launch();
  try {
    fs.writeFileSync(path.join(root,'art.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="1656"><rect width="1242" height="1656" fill="#12343c"/></svg>');
    const source='https://example.com/source';
    const report={date:'2026-11-07',edition:'weekly',series:"Yeoh's AI Weekly",design:{style:'editorial'},
      cover:{title_lines:['本周事件'],kicker:'2026-11-07 · AI 周报'},references:[{url:source}],cards:[
        {title:'本周事件',tag:'封面',points:['本周报道的共同线索。'],design:{layout:'cover'},image:'art.svg',
          visual:{kind:'illustration',source_url:source,caption:'概念插画',evidence:'共同线索'}},
        {title:'从扫描到复核',tag:'机制',points:['先扫描候选，再人工复核。'],design:{layout:'process'},
          visual:{kind:'diagram',layout:'flow',source_url:source,caption:'流程示意',evidence:'先扫描候选',
            nodes:[{label:'扫描候选',evidence:'扫描候选'},{label:'人工复核',evidence:'人工复核'}]}},
        {title:'两次观测',tag:'数据',points:['第一次427次，第二次301次。'],design:{layout:'data'},
          visual:{kind:'bars',source_url:source,caption:'按原文数字重绘',evidence:'第一次427次',
            panels:[{title:'观测次数',unit:'次',rows:[{label:'第一次',value:427,evidence:'第一次427次'},
              {label:'第二次',value:301,evidence:'第二次301次'}]}]}}
      ]};
    const input=path.join(root,'report.json'),output=path.join(root,'images');
    fs.writeFileSync(input,JSON.stringify(report));
    const result=spawnSync(process.execPath,['pipeline/core/render_html.js',input,'--out-dir',output],
      {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:60000});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const page=await browser.newPage({viewport:{width:1242,height:1656}});
    for (const [i,name] of ['cover','info_02','info_03'].entries()) {
      await page.goto(require('node:url').pathToFileURL(path.join(output,name+'.html')).href);
      await page.evaluate(()=>document.fonts.ready);await page.evaluate(fitCopy);
      assert.match(await page.locator('.brand').innerText(),/Weekly/);
      assert.deepEqual(await page.locator('[data-source-paragraph]').allTextContents(),report.cards[i].points);
      if (i===1) {
        const positions=await page.locator('.editorial-figure svg text').evaluateAll(nodes=>nodes
          .filter(n=>['扫描候选','人工复核'].includes(n.textContent))
          .map(n=>({x:Number(n.getAttribute('x')),y:Number(n.getAttribute('y'))})));
        assert.equal(positions.length,2);
        assert.equal(positions[0].x,positions[1].x);
        assert(positions[0].y<positions[1].y); // Flow steps progress down one column.
      }
    }
    assert.equal(await page.locator('.data-display').count(),0);
    const gap=await page.evaluate(()=>document.querySelector('figure').getBoundingClientRect().top-document.querySelector('header').getBoundingClientRect().bottom);
    assert(gap<80,`data figure must follow its heading without an empty feature region: ${gap}`);
    const regions=await page.evaluate(()=>({figure:document.querySelector('figure').getBoundingClientRect().height,
      bodyBottom:document.querySelector('.body').getBoundingClientRect().bottom}));
    assert(regions.figure>500,'the chart should use the available page height');
    assert(regions.bodyBottom>1200,'copy and chart should occupy the page together');
    assert.deepEqual(await page.evaluate(auditCopy),[]);
  } finally {await browser.close();fs.rmSync(root,{recursive:true,force:true});}
});
