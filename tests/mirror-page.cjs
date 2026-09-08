const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream']});
  try {
    const context = await browser.newContext({permissions:['camera']});
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if (!r.url().startsWith('http://127.0.0.1:')) external.push(r.url());});
    await page.route('https://**/*', route => route.abort());
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4173'}/poc/m5-mediapipe-mirror/`);
    assert.equal(await page.locator('video').evaluate(v => v.srcObject), null);
    for (let i = 0; i < 5; i++) {
      assert.match(await page.locator('#change-title').textContent(), i % 2 ? /Am → Em/ : /Em → Am/);
      await page.locator('#count-change').click();
    }
    assert.equal(await page.locator('#count-change').isDisabled(), true);
    assert.match(await page.locator('#change-status').textContent(), /5 de 5/);
    assert.equal(await page.locator('.review:checked').count(), 0);
    await page.locator('#undo-change').click();
    assert.match(await page.locator('#change-title').textContent(), /Troca 5: Em → Am/);
    for (const input of await page.locator('.review').all()) await input.check();
    assert.match(await page.locator('#review-status').textContent(), /concluída por você/);
    await page.locator('#reset-review').click();
    assert.match(await page.locator('#change-status').textContent(), /0 de 5/);
    assert.equal(await page.locator('.review:checked').count(), 0);
    assert.deepEqual(external, []);
    await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Câmera ligada'));
    await page.locator('#mirror').uncheck();
    for (const selector of ['video','canvas']) assert.equal(await page.locator(selector).evaluate(e => getComputedStyle(e).transform), 'none');
    await page.getByText('Pontos da mão, recurso experimental', {exact:true}).click();
    await page.locator('#tracking').check();
    await page.waitForFunction(() => document.querySelector('#tracking-status').textContent.includes('indisponíveis'));
    assert.equal(await page.locator('#tracking').isChecked(), false);
    assert.equal(await page.locator('video').evaluate(v => v.srcObject.active), true);
    await page.locator('#reset-review').click();
    assert.equal(await page.locator('video').evaluate(v => v.srcObject.active), true);
    for (const width of [320,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    }
    await page.setViewportSize({width:320,height:800});
    await page.locator('#practice').scrollIntoViewIfNeeded();
    await page.screenshot({path:'test-results/mirror-practice-mobile.png'});
    await page.locator('#stop').click();
    assert.equal(await page.locator('video').evaluate(v => v.srcObject), null);
    await page.locator('#count-change').click();
    await page.reload();
    assert.match(await page.locator('#change-status').textContent(), /0 de 5/);
    assert.deepEqual(errors, []);
    console.log('PASS M5: manual sequence, undo, self-review, reset/reload, mirror alignment, model failure fallback, responsive widths.');
  } finally {await browser.close();}
})().catch(e => {console.error(e);process.exitCode = 1;});
