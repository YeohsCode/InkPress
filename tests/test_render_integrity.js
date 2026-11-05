const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('/Users/andrewyeoh/Werk/HermesAgent/code/node_modules/playwright');
const { textHTML, fitCopy } = require('../pipeline/core/text_layout');
const { auditCopy, auditFigures } = require('../pipeline/core/render_audit');

test('text-only pages use both columns and retain every paragraph', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width:1242, height:1656 } });
    const card = { title:'没有配图的页面也应该完整平衡', tag:'事实', points: Array.from({length:4}, (_,i) =>
      `${i+1}：` + '这是已经核实的事件事实，完整段落应该按阅读顺序进入两栏。'.repeat(5)) };
    const report = { date:'2026-11-04', series:'Daily', cover:{ kicker:'Daily', title_lines:['封面标题'] } };
    for (const index of [1, 3, 8, 9]) {
      await page.setContent(textHTML(report, card, index, 9));
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(fitCopy);
      assert.deepEqual(await page.evaluate(auditCopy), []);
      assert.deepEqual(await page.locator('[data-source-paragraph]').allTextContents(), card.points);
      const columns = await page.evaluate(() => {
        const body = document.querySelector('.body'), box = body.getBoundingClientRect();
        const bottoms = [box.top,box.top];
        for (const p of body.children) {
          const range = document.createRange(); range.selectNodeContents(p);
          for (const rect of range.getClientRects()) {
            const column = rect.left < box.left + box.width/2 ? 0 : 1;
            bottoms[column] = Math.max(bottoms[column],rect.bottom);
          }
        }
        return { bottoms, top:box.top, height:box.height, font:parseFloat(getComputedStyle(body).fontSize) };
      });
      assert(Math.abs(columns.bottoms[0] - columns.bottoms[1]) < 80);
      assert(columns.bottoms.every(bottom => bottom - columns.top > columns.height * .8));
      assert(columns.font > 30);
    }
    await page.setContent('<div class="footer" style="position:absolute;top:1500px"></div>');
    assert((await page.evaluate(auditFigures,{ images:1 })).some(issue => issue.includes('expected 1')));
    await page.setContent('<div style="height:0;overflow:hidden"><img style="width:200px;height:200px"></div>' +
      '<div class="footer" style="position:absolute;top:1500px"></div>');
    assert((await page.evaluate(auditFigures,{ images:1 })).some(issue => issue.includes('ancestor')));
  } finally { await browser.close(); }
});

test('failed rendering preserves the complete previous issue; successful shorter issues remove stale pages', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'daily-render-'));
  const output = path.join(directory,'images'), reportPath = path.join(directory,'report.json');
  const report = { date:'2026-11-04', series:'Daily', cover:{ kicker:'Daily',title_lines:['原文事实'] },
    cards:[{ title:'原文事实',tag:'事件',points:['原文事实。'.repeat(50)] },
      { title:'原文事实',tag:'证据',points:['原文事实。'.repeat(30)],image:'figure.svg',
        visual:{kind:'photo',source_url:'https://example.com/source',caption:'机制示意',evidence:'原文事实。'} }],
    references:[{url:'https://example.com/source'}] };
  const render = () => {
    fs.writeFileSync(reportPath,JSON.stringify(report));
    return spawnSync(process.execPath,['pipeline/core/render_html.js',reportPath,'--out-dir',output],
      {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:60000});
  };
  try {
    fs.writeFileSync(path.join(directory,'figure.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="red"/></svg>');
    let result = render();
    assert.equal(result.status,0,result.stdout + result.stderr);
    const previous = Object.fromEntries(fs.readdirSync(output).map(name => [name,fs.readFileSync(path.join(output,name))]));
    fs.writeFileSync(path.join(directory,'figure.svg'),'broken image');
    result = render();
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/broken image/);
    for (const [name,bytes] of Object.entries(previous)) assert.deepEqual(fs.readFileSync(path.join(output,name)),bytes);
    assert(!fs.existsSync(output+'.lock'));
    assert(!fs.readdirSync(directory).some(name => name.includes('.staging-')));
    report.cards.pop();
    result = render();
    assert.equal(result.status,0,result.stdout + result.stderr);
    assert.deepEqual(fs.readdirSync(output).sort(),['cover.html','cover.png','manifest.json']);
    const manifest = JSON.parse(fs.readFileSync(path.join(output,'manifest.json')));
    assert.equal(manifest.images.length,1);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
