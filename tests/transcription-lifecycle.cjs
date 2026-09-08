const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
 try {
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   window.grantedTracks=[];
   navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.grant=()=>{const track={stop(){window.grantedTracks.push('stopped');}};resolve({getTracks:()=>[track]});};});
  });
  await page.goto(base+'/poc/m9-audio-tabs/');
  await page.locator('#record').click(); await page.locator('#stop-record').click();
  await page.evaluate(()=>window.grant());
  assert.deepEqual(await page.evaluate(()=>window.grantedTracks),['stopped']);
  assert.equal(await page.locator('#record').isEnabled(),true);
  await page.locator('#demo').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Áudio pronto'));
  await page.locator('#clip-start').fill('4'); await page.locator('#clip-duration').fill('5');
  await page.locator('#transcribe').click(); assert.match(await page.locator('#status').textContent(),/caiba no áudio/);
  await page.locator('#clip-start').fill('0');
  await page.route('**/engine.js',route=>route.abort());
  await page.locator('#transcribe').click(); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Não foi possível carregar'));
  assert.equal(await page.locator('#transcribe').isEnabled(),true);
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.unroute('**/engine.js');
  // Locally generated silent WAV exercises file decoding and silence rejection.
  const bytes=Buffer.alloc(44+22050*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(22050,24);bytes.writeUInt32LE(44100,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  await page.locator('#audio-file').setInputFiles({name:'silence.wav',mimeType:'audio/wav',buffer:bytes});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Áudio pronto'));
  await page.locator('#transcribe').click(); assert.match(await page.locator('#status').textContent(),/silencioso/);
  console.log('PASS: late microphone permission releases tracks, invalid crop, worker failure recovery and silent file.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
