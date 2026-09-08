const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors=[], external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4173'}/poc/m6-fretdetection-marks/`);
    assert.equal(await page.locator('video').evaluate(v=>v.srcObject),null);
    for(const fret of [1,5,3,12,7]) {
      assert.equal(await page.locator('#target').textContent(),`Encontre a casa ${fret}`);
      assert.equal(await page.locator('#practice-hint').isHidden(),true);
      await page.locator('#hint').click();
      assert.match(await page.locator('#hint-text').textContent(),new RegExp(`casa ${fret}`));
      assert.equal(await page.locator('#hint').getAttribute('aria-expanded'),'true');
      await page.locator('#found').click();
    }
    assert.equal(await page.locator('#found').isDisabled(),true);
    assert.equal(await page.locator('#hint').isDisabled(),true);
    assert.equal(await page.locator('#practice-done').isVisible(),true);
    assert.match(await page.locator('#practice-status').textContent(),/5 de 5/);
    await page.locator('#undo-found').click();
    assert.equal(await page.locator('#target').textContent(),'Encontre a casa 7');
    assert.equal(await page.locator('#practice-done').isHidden(),true);
    await page.locator('#restart').click();
    assert.match(await page.locator('#practice-status').textContent(),/0 de 5/);
    assert.equal(await page.locator('#undo-found').isDisabled(),true);
    for(const width of [320,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
    }
    await page.setViewportSize({width:320,height:850});
    await page.locator('#practice').scrollIntoViewIfNeeded();
    await page.screenshot({path:'test-results/map-practice-mobile.png'});
    await page.setViewportSize({width:1024,height:900});
    await page.locator('#learn-title').scrollIntoViewIfNeeded();
    await page.screenshot({path:'test-results/map-board-desktop.png'});
    await page.locator('#found').click();
    await page.reload();
    assert.match(await page.locator('#practice-status').textContent(),/0 de 5/);
    assert.deepEqual(external,[]);
    assert.deepEqual(errors,[]);
    console.log('PASS M6 practice: five positions, help, completion, undo, reset/reload, no camera/network, responsive layout.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
