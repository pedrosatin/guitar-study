const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream']});
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  try {
    const context = await browser.newContext({permissions:['camera']});
    await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:`
      export const FilesetResolver={forVisionTasks:async()=>({})};
      export const HandLandmarker={createFromOptions:async()=>({close(){},detectForVideo(){return {landmarks:[]}}})};
    `}));
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/poc/m6-fretdetection-marks/`);
    assert.equal(await page.locator('#tracking').isDisabled(),true);
    await page.locator('#start').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Câmera ligada'));
    const map=page.locator('#map-status');
    async function mark(x) {
      const bounds=await page.locator('#overlay').boundingBox();
      await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*.5);
    }
    await page.locator('#calibrate').click();
    assert.equal(await page.locator('#suggest').isDisabled(),true);
    await mark(.1);await mark(.3);await mark(.2);
    assert.match(await map.textContent(),/não foi salva.*casa 5.*2 de 5/);
    await mark(.5);await mark(.7);await mark(.9);
    assert.match(await map.textContent(),/cinco referências/);
    await page.setViewportSize({width:320,height:800});
    await page.waitForFunction(()=>{
      const canvas=document.querySelector('#overlay');
      return Math.abs(parseFloat(canvas.getContext('2d').font.split(' ')[1])*canvas.getBoundingClientRect().width/canvas.width-14)<.1;
    });
    await page.locator('#stage').screenshot({path:'test-results/map-camera-mobile.png'});
    await page.setViewportSize({width:1280,height:800});
    await page.locator('#undo-mark').click();
    assert.match(await map.textContent(),/casa 12.*4 de 5/);
    await page.locator('#cancel-mark').click();
    assert.match(await map.textContent(),/anterior com cinco referências restaurado/);
    await page.locator('#calibrate').click();await mark(.8);await mark(.6);
    await page.locator('#cancel-mark').click();
    assert.match(await map.textContent(),/anterior com cinco referências restaurado/);
    await page.locator('details').filter({has:page.locator('#tracking')}).locator('summary').click();
    await page.locator('#tracking').check();
    await page.waitForFunction(()=>document.querySelector('#tracking-status').textContent.includes('Indicador longe'));
    const mapBefore=await map.textContent();
    await page.evaluate(()=>{
      window.trackingMutations=0;
      window.trackingObserver=new MutationObserver(records=>window.trackingMutations+=records.length);
      window.trackingObserver.observe(document.querySelector('#tracking-status'),{childList:true,subtree:true,characterData:true});
      const original=CanvasRenderingContext2D.prototype.getImageData;
      window.restorePixels=()=>CanvasRenderingContext2D.prototype.getImageData=original;
      CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)}};
    });
    await page.locator('details').filter({has:page.locator('#suggest')}).locator('summary').click();
    await page.locator('#suggest').click();
    assert.match(await map.textContent(),/Encontradas 0 manchas.*mapa anterior foi mantido/);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.trackingMutations),0);
    assert.match(await map.textContent(),/Encontradas 0 manchas/);
    assert.match(mapBefore,/cinco referências/);
    await page.evaluate(()=>window.restorePixels());
    await page.locator('#undo-mark').click();
    assert.match(await map.textContent(),/casa 12.*4 de 5/);
    await page.locator('#cancel-mark').click();
    assert.match(await map.textContent(),/cinco referências restaurado/);
    await page.locator('#clear').click();
    await page.locator('#calibrate').click();
    for(const x of [.9,.7,.5,.3,.1])await mark(x);
    assert.match(await map.textContent(),/cinco referências/);
    await page.locator('#stop').click();
    assert.equal(await page.locator('#tracking').isDisabled(),true);
    assert.equal(await page.locator('#tracking').isChecked(),false);
    assert.equal(await page.locator('#undo-mark').isDisabled(),true);
    assert.equal(await page.locator('#cancel-mark').isDisabled(),true);
    assert.match(await map.textContent(),/Nenhuma/);
    await page.locator('#start').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Câmera ligada'));
    await page.locator('#calibrate').click();await mark(.2);await page.locator('#cancel-mark').click();
    assert.match(await map.textContent(),/Nenhuma/);
    assert.equal(await page.locator('#undo-mark').isDisabled(),true);
    await page.locator('#stop').click();
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS M6 camera: ordering retry, both directions, undo, cancel restores map, failed color preserves map, tracking status isolation and deduplication, reset after camera stop.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
