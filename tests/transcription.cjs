const assert = require('node:assert/strict');
const {mkdirSync} = require('node:fs');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
 const errors=[],failures=[];
 mkdirSync('test-results/transcription',{recursive:true});
 try {
  const page = await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400) failures.push(r.url());});
  await page.goto(base+'/poc/m9-audio-tabs/');
  assert.equal(await page.locator('[aria-current=page]').textContent(),'Áudio para tablatura');
  for(const width of [320,768,1024,1440]) {await page.setViewportSize({width,height:960}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.locator('#demo').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Áudio pronto'));
  const started = Date.now();
  await page.locator('#transcribe').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('concluída') || document.querySelector('#cancel').hidden,{},{timeout:180000});
  console.log('Inference seconds:',(Date.now()-started)/1000,'status:',await page.locator('#status').textContent());
  assert.equal(await page.locator('#result').isVisible(),true);
  const pitches=await page.locator('#notes tr td:nth-child(2)').allTextContents();
  console.log('Recognized:',pitches);
  for(const expected of ['Mi4','Fá♯4','Sol4','Lá4']) assert.ok(pitches.includes(expected),`missing ${expected}`);
  await page.locator('summary').filter({hasText:'Revisar notas'}).click();
  await page.locator('#notes select').first().selectOption('2:5');
  assert.match(await page.locator('#tab').textContent(),/5/);
  const count=await page.locator('#notes tr').count();
  await page.locator('#notes button').first().click(); assert.equal(await page.locator('#notes tr').count(),count-1);
  for(const id of ['export-tab','export-midi']) {const downloaded=page.waitForEvent('download'); await page.locator('#'+id).click(); assert.ok(await (await downloaded).path());}
  for(const width of [320,1440]) {await page.setViewportSize({width,height:960}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); await page.screenshot({path:`test-results/transcription/result-${width}.png`,fullPage:true});}
  await page.locator('#transcribe').click(); await page.locator('#cancel').click(); assert.match(await page.locator('#status').textContent(),/cancelada/);
  await page.locator('#audio-file').setInputFiles({name:'broken.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('not audio')});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Não foi possível ler'));
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#record').click(); await page.waitForFunction(()=>document.querySelector('#record-status').textContent.startsWith('Gravando'));
  await page.waitForTimeout(1200); await page.locator('#stop-record').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Áudio pronto'));
  assert.match(await page.locator('#source-name').textContent(),/Minha gravação/);
  assert.deepEqual(errors,[]); assert.deepEqual(failures,[]);
  console.log('PASS: real model, editable positions, removal, exports, cancellation, invalid audio, microphone and responsive layout.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
