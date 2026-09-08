const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/mic-test', route => route.fulfill({contentType:'text/html', body:'<p>Microphone lifecycle test</p>'}));
    async function setup() {
      await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4173'}/mic-test`);
      await page.evaluate(async () => {
        const {createMicrophone} = await import('/poc/m7-onset-rhythm/microphone.js');
        const requests = [], contexts = [], streams = [], states = [], onsets = [], ready = [];
        let amplitude = 0, broken = false, now = 0, nextFrame = 0;
        const frames = new Map();
        performance.now = () => now;
        window.requestAnimationFrame = callback => {frames.set(++nextFrame, callback); return nextFrame;};
        window.cancelAnimationFrame = id => frames.delete(id);
        Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:{getUserMedia() {return new Promise((resolve,reject) => requests.push({resolve,reject}));}}});
        window.AudioContext = class {
          constructor() {this.closed = 0; this.reads = 0; this.sampleRate = 48000; contexts.push(this);}
          get currentTime() {return now / 1000;}
          resume() {return new Promise((resolve,reject) => {this.finish = resolve; this.fail = reject;});}
          close() {this.closed++; return Promise.resolve();}
          createMediaStreamSource() {return {connect(){}, disconnect(){}};}
          createAnalyser() {return {disconnect(){}, getFloatTimeDomainData: data => {this.reads++; if (broken) throw Error('DEVICE RAW ERROR'); data.fill(amplitude);}};}
        };
        const mic = createMicrophone({onState:(...args) => states.push(args),onOnset:(...args) => onsets.push(args),onReady:info => ready.push(info)});
        window.harness = {mic,
          grant(index) {const track = new EventTarget(); track.stops=0; track.stop=() => track.stops++; const stream={track,getTracks:()=>[track],getAudioTracks:()=>[track]}; streams[index]=stream; requests[index].resolve(stream);},
          resume(index) {contexts[index].finish();},
          rejectResume(index) {contexts[index].fail(new Error('RAW RESUME ERROR'));},
          reject(index,name) {requests[index].reject({name,message:'RAW ERROR'});},
          end(index) {streams[index].track.dispatchEvent(new Event('ended'));},
          frame(time,value=0) {now=time; amplitude=value; const pending=[...frames.values()];frames.clear(); pending.forEach(callback=>callback(now));},
          break() {broken=true;},
          state() {return {state:mic.state,states,onsets,ready,requests:requests.length,closed:contexts.map(c=>c.closed),reads:contexts.map(c=>c.reads),stops:streams.map(s=>s.track.stops),frames:frames.size};}
        };
      });
    }
    const state = () => page.evaluate(() => harness.state());
    const start = () => page.evaluate(() => {harness.mic.start();});
    const stop = () => page.evaluate(() => harness.mic.stop());
    async function grant(index=0,context=index) {
      await page.evaluate(index => harness.grant(index),index);
      await page.evaluate(context => harness.resume(context),context);
    }
    await setup();
    assert.equal((await state()).requests,0);
    await start(); await stop(); await start(); await grant(1,0);
    await page.evaluate(() => harness.grant(0));
    assert.deepEqual((await state()).stops,[1,0]);
    assert.equal((await state()).state,'calibrating');
    await stop();
    assert.deepEqual((await state()).closed,[1]);

    await setup(); await start();
    await page.evaluate(() => harness.grant(0));
    await stop(); await start(); await grant(1);
    await page.evaluate(() => {harness.resume(0);harness.end(0);});
    assert.equal((await state()).state,'calibrating');
    assert.deepEqual((await state()).closed,[1,0]);
    await page.evaluate(() => {harness.frame(0);harness.frame(999);});
    assert.equal((await state()).ready.length,0);
    assert.equal((await state()).onsets.length,0);
    await page.evaluate(() => harness.frame(1000));
    assert.equal((await state()).state,'listening');
    assert.deepEqual((await state()).ready,[{sampleRate:48000,fftSize:2048}]);
    await page.evaluate(() => harness.frame(1010,0.5));
    assert.equal((await state()).onsets.length,1);
    assert.equal((await state()).onsets[0][0],1.01);
    await page.evaluate(() => harness.end(1));
    assert.equal((await state()).state,'error');
    assert.equal((await state()).frames,0);
    assert.deepEqual((await state()).stops,[1,1]);

    await setup(); await start();
    await page.evaluate(() => harness.grant(0));
    await page.evaluate(() => harness.rejectResume(0));
    assert.equal((await state()).state,'error');
    assert.deepEqual((await state()).stops,[1]);
    assert.deepEqual((await state()).closed,[1]);
    assert.doesNotMatch((await state()).states.at(-1)[1],/RAW RESUME ERROR/);

    await setup(); await start(); await grant();
    await page.evaluate(() => {harness.frame(0);harness.frame(1000);harness.break();harness.frame(1010);});
    assert.equal((await state()).state,'error');
    assert.deepEqual((await state()).closed,[1]);
    assert.deepEqual((await state()).stops,[1]);
    assert.doesNotMatch((await state()).states.at(-1)[1],/RAW ERROR/);

    for (const event of ['visibilitychange','pagehide']) {
      await setup(); await start();
      await page.evaluate(event => {
        if(event==='visibilitychange') {Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event(event));}
        else window.dispatchEvent(new Event(event));
      },event);
      await page.evaluate(() => harness.grant(0));
      assert.equal((await state()).state,'idle');
      assert.deepEqual((await state()).stops,[1]);
    }
    for (const [name,expected] of [['NotAllowedError',/negada/],['NotFoundError',/Nenhum/],['NotReadableError',/ocupado/],['Error',/Não foi possível/]]) {
      await setup(); await start(); await page.evaluate(name => harness.reject(0,name),name);
      assert.equal((await state()).state,'error');
      assert.match((await state()).states.at(-1)[1],expected);
      assert.doesNotMatch((await state()).states.at(-1)[1],/RAW ERROR/);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS rhythm microphone: cancellation, stale permission/resume/ended, one-second calibration, real onset detector, cleanup and errors.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
