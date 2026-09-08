const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream']});
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  try {
    const context = await browser.newContext({permissions:['camera']});
    const page = await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const module of ['m5-mediapipe-mirror','m6-fretdetection-marks']) {
      await page.goto(`${base}/poc/${module}/`);
      assert.equal(await page.locator('video').evaluate(video=>video.srcObject),null);
      await page.locator('#start').click();
      await page.waitForFunction(()=>document.querySelector('video').srcObject?.active);
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Câmera ligada'));
      if(module.startsWith('m5')) {
        for(const checkbox of await page.locator('.review').all()) await checkbox.check();
        assert.match(await page.locator('#review-status').textContent(),/concluída/);
        await page.locator('#reset-review').click();
        assert.equal(await page.locator('.review:checked').count(),0);
      } else {
        await page.locator('#found').click();
        assert.match(await page.locator('#practice-status').textContent(),/1 localizações/);
        await page.locator('#calibrate').click();
        const bounds=await page.locator('#overlay').boundingBox();
        for(const x of [.1,.25,.4,.6,.85]) await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*.5);
        assert.match(await page.locator('#map-status').textContent(),/cinco referências/);
        await page.locator('#clear').click();
        assert.match(await page.locator('#map-status').textContent(),/Nenhuma/);
        await page.locator('#calibrate').click();
        await page.keyboard.press('Enter');
        for(let i=0;i<4;i++){for(let step=0;step<5;step++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');}
        assert.match(await page.locator('#map-status').textContent(),/cinco referências/);
      }
      await page.locator('#stop').click();
      assert.equal(await page.locator('video').evaluate(video=>video.srcObject),null);
      assert.equal(await page.locator('#start').isEnabled(),true);
      await page.locator('#start').click();
      await page.waitForFunction(()=>document.querySelector('video').srcObject?.active);
      await page.locator('#stop').click();
    }
    assert.deepEqual(errors,[]);
    await context.close();
    const denied=await browser.newContext();
    const deniedPage=await denied.newPage();
    for(const module of ['m5-mediapipe-mirror','m6-fretdetection-marks']) {
      await deniedPage.goto(`${base}/poc/${module}/`);
      await deniedPage.locator('#start').click();
      await deniedPage.waitForFunction(()=>document.querySelector('#status').textContent.includes('negada'));
      assert.equal(await deniedPage.locator('#start').isEnabled(),true);
      assert.equal(await deniedPage.locator('video').evaluate(video=>video.srcObject),null);
    }
    await denied.close();
    console.log('PASS M5/M6: manual exercises, click and keyboard calibration, camera start/stop/restart, denied permission, clean page errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
