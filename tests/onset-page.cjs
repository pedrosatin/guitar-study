const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-07T12:00:00Z')});
 await page.clock.pauseAt(new Date('2026-09-07T12:00:01Z'));
 await page.goto('http://127.0.0.1:4173/poc/m7-onset-rhythm/');

 const text=id=>page.locator('#'+id).textContent();
 const click=id=>page.locator('#'+id).click();
 for(let i=0;i<3;i++){await click('tap');await page.clock.runFor(1000);}
 assert.equal(await text('bpm'),'60');
 await click('visual-toggle');
 assert.equal(await page.locator('#tap').isDisabled(),true);
 assert.equal(await text('onsetCount'),'0');
 await page.clock.runFor(3999); assert.match(await text('round-status'),/Preparação/);
 await page.clock.runFor(1); assert.match(await text('round-status'),/Valendo/);
 assert.equal(await page.locator('#mode').isDisabled(),true);
 for(let i=0;i<30;i++){await click('tap');await page.clock.runFor(1000);}
 assert.match(await text('round-status'),/concluída/);
 assert.equal(await text('bpm'),'60'); assert.equal(await text('onsetCount'),'30');
 assert.equal(await page.locator('#review').isVisible(),true);
 assert.equal(await page.locator('#tap').isDisabled(),true);
 await page.clock.runFor(4000); assert.equal(await text('bpm'),'60');
 await click('reset');
 // Alternating intervals can have target median while remaining irregular.
 await click('tap');
 for(const ms of [500,1500,500,1500]){await page.clock.runFor(ms);await click('tap');}
 assert.equal(await text('bpm'),'60'); assert.match(await text('practice-result'),/variaram/);
 await page.clock.runFor(4000); assert.equal(await text('bpm'),'—'); assert.match(await text('practice-result'),/Sem batidas recentes/); await click('tap');assert.equal(await text('onsetCount'),'1');assert.equal(await text('bpm'),'—');
 await page.selectOption('#mode','guitar'); assert.equal(await page.locator('#tap').isHidden(),true);
 await click('visual-toggle'); await page.clock.runFor(34000);
 assert.match(await text('practice-result'),/Sem medição/);
 await page.selectOption('#mode','mic');assert.equal(await page.locator('#visual-toggle').isDisabled(),true);
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('denied','NotAllowedError'));});
 await click('toggle');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Permissão negada'));
 assert.equal(await page.locator('#visual-toggle').isDisabled(),true);
 await page.selectOption('#mode','tap');await click('visual-toggle');
 await page.clock.fastForward(5000);assert.match(await text('round-status'),/sem atualizar/);
 await click('visual-toggle'); await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.match(await text('round-status'),/interrompida/);
 for(const width of [320,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.setViewportSize({width:320,height:850});await page.locator('#exercise').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/rhythm-exercise-mobile.png'});
 await page.setViewportSize({width:1024,height:900});await page.locator('#exercise').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/rhythm-exercise-desktop.png'});
 // Isolate UI transitions from device lifecycle (covered by rhythm-microphone.cjs).
 await page.route('**/microphone.js', route=>route.fulfill({contentType:'text/javascript',body:`
 export function createMicrophone({onState,onOnset}) {
   window.micEmit = onOnset;
   window.micFail = () => onState('error','Microfone desconectado.');
   return {start(){onState('listening','Microfone pronto.');},stop(){onState('idle','Microfone desligado.');},setSensitivity(){},setNoiseGate(){}};
 }`}));
 await page.reload(); await page.selectOption('#mode','mic'); await click('toggle');
 await click('visual-toggle'); await page.clock.runFor(34000);
 assert.equal(await page.locator('#review').isVisible(),true);
 await click('toggle');
 assert.equal(await page.locator('#review').isHidden(),true);
 assert.match(await text('round-status'),/Pronto/);
 assert.equal(await text('onsetCount'),'0');
 await click('visual-toggle'); await page.evaluate(()=>window.micFail());
 assert.match(await text('status'),/desconectado/);
 assert.match(await text('round-status'),/interrompida/);
 assert.equal(await page.locator('#mode').isDisabled(),false);
 assert.deepEqual(errors,[]);console.log('PASS M7 page: timed preparation/round, manual beats, irregularity, reset, mode isolation, errors, stall, hidden, responsive.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
