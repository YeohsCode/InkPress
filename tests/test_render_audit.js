const assert = require('node:assert/strict');
const { test } = require('node:test');
const { chromium } = require('/Users/andrewyeoh/Werk/HermesAgent/code/node_modules/playwright');
const { auditCopy } = require('../pipeline/core/render_audit');
const { evidenceHTML } = require('../pipeline/core/evidence_visuals');
const { issueDateLabel } = require('../pipeline/core/publication');

test('copy visibility audit catches overflow and image collisions', async t => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1242, height: 1656 } });
    const inspect = async (markup, options) => {
      await page.setContent(`<style>
        * { margin:0;box-sizing:border-box; }
        body { width:1242px;height:1656px;overflow:hidden;font:30px/1.6 sans-serif; }
        .footer { position:absolute;top:1560px; }
      </style>${markup}<div class="footer">01 / 09</div>`);
      return page.evaluate(auditCopy, options);
    };

    await t.test('content can leave the page without overflowing its own box', async () => {
      const issues = await inspect('<div class="body" style="position:absolute;top:1500px;width:400px">' +
        '正文必须完整保留。'.repeat(20) + '</div>');
      assert(issues.some(issue => issue.reason === 'outside copy area'));
    });

    await t.test('hidden ancestors cannot silently cut off copy', async () => {
      const issues = await inspect('<section style="height:60px;overflow:hidden"><div class="body" style="width:400px">' +
        '正文必须完整保留。'.repeat(20) + '</div></section>');
      assert(issues.some(issue => issue.reason === 'clipped by container'));
    });

    await t.test('text painted on a photograph fails', async () => {
      const markup = '<img style="position:absolute;top:300px;width:800px;height:400px">' +
        '<div class="body" style="position:absolute;top:320px">不可叠在图片上的正文</div>';
      const issues = await inspect(markup);
      assert(issues.some(issue => issue.reason === 'overlaps image'));
      assert.deepEqual(await inspect(markup, { checkImages: false }), []);
    });

    await t.test('extra multicolumn fragments cannot escape sideways', async () => {
      const issues = await inspect('<div class="body" style="width:400px;height:90px;column-count:2;overflow:hidden">' +
        '正文必须完整保留。'.repeat(40) + '</div>');
      assert(issues.some(issue => issue.reason === 'clipped by container'));
    });

    await t.test('separate copy and image regions pass', async () => {
      assert.deepEqual(await inspect('<div class="body" style="width:900px">清晰可读的正文。</div>' +
        '<img style="display:block;margin-top:30px;width:900px;height:400px">'), []);
    });

    await t.test('masthead cannot cover a chart', async () => {
      const markup = '<img style="position:absolute;top:0;width:1242px;height:630px">' +
        '<div class="masthead" style="position:absolute;top:46px">刊头水印</div>';
      assert((await inspect(markup)).some(issue => issue.reason === 'overlaps image'));
    });

    await t.test('protected charts reject overlay text even in magazine mode', async () => {
      const markup = '<figure data-evidence-visual style="position:absolute;top:100px;width:900px;height:500px">图表内部图例</figure>' +
        '<div class="masthead" style="position:absolute;top:120px">不应叠在图表上的刊头</div>';
      assert((await inspect(markup, { checkImages: false })).some(issue => issue.reason === 'overlaps image'));
    });

    await t.test('source chart is contained and masthead is outside it', async () => {
      const source = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450"><rect width="900" height="450"/></svg>');
      const card = { title: '七年贡献曲线', tag: '数据', image: source, points: ['原文已核实的说明。'],
        visual: { kind: 'source_chart', caption: '原图标注截至10/26，正文截至10/27。', source_url: 'https://example.com' } };
      const report = { date: '2026-10-28', series: 'Daily', cover: { kicker: '2026.10.28' } };
      await page.setContent(evidenceHTML(report, card, 2, 9));
      assert.deepEqual(await page.evaluate(auditCopy), []);
      const geometry = await page.evaluate(() => ({
        headerBottom: document.querySelector('.masthead').getBoundingClientRect().bottom,
        figureTop: document.querySelector('.visual').getBoundingClientRect().top,
        objectFit: getComputedStyle(document.querySelector('img')).objectFit,
        paragraphs: [...document.querySelectorAll('[data-source-paragraph]')].map(node => node.textContent)
      }));
      assert(geometry.figureTop > geometry.headerBottom);
      assert.equal(geometry.objectFit, 'contain');
      assert.deepEqual(geometry.paragraphs, card.points);
    });

    await t.test('chart bar lengths and range endpoints follow structured values', async () => {
      const card = { title: '贡献数', points: ['有18天与40到46天。'], visual: { kind: 'bars', panels: [{title: '零贡献工作日', unit: '天', rows: [
        { label: '部分年份', value: 18 }, { label: '完整年份', value: 40, max_value: 46 }
      ]}] } };
      await page.setContent(evidenceHTML({ cover: {} }, card, 2, 9));
      const widths = await page.locator('.bar').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.width)));
      assert(Math.abs(widths[0] / widths[1] - 18 / 40) < .0001);
      assert.equal(await page.locator('.chart-row strong').last().textContent(), '40–46');
    });
  } finally {
    await browser.close();
  }
});

test('issue date label is independent of runtime timezone', () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai']) {
      process.env.TZ = timezone;
      assert.equal(issueDateLabel('2026-10-28'), '10月28日');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
