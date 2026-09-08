const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox']});
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/camera-test', route => route.fulfill({contentType:'text/html; charset=utf-8', body:'<button id="start">Ligar câmera</button><button id="stop" disabled>Desligar câmera</button><p id="status"></p>'}));
    async function setup({unavailable = false} = {}) {
      await page.goto(`${base}/camera-test`);
      await page.evaluate(async ({unavailable}) => {
        const {createCamera} = await import('/shared/camera.js');
        const requests = [], plays = [], streams = [];
        let starts = 0, stops = 0, pauses = 0;
        const video = {srcObject:null, readyState:0, currentTime:0,
          pause() { pauses++; },
          play() { return new Promise((resolve, reject) => plays.push({resolve, reject})); }
        };
        Object.defineProperty(navigator, 'mediaDevices', {configurable:true, value:unavailable ? undefined : {
          getUserMedia() { return new Promise((resolve, reject) => requests.push({resolve, reject})); }
        }});
        const camera = createCamera({video,
          startButton:document.querySelector('#start'), stopButton:document.querySelector('#stop'), status:document.querySelector('#status'),
          onStart() { starts++; }, onStop() { stops++; }, onFrame() {}
        });
        window.harness = {
          grant(index) {
            const track = new EventTarget(); track.stopCount = 0; track.stop = () => track.stopCount++;
            const stream = {track, getTracks:() => [track], getVideoTracks:() => [track]};
            streams[index] = stream; requests[index].resolve(stream);
          },
          reject(index, name, message = 'RAW INTERNAL ERROR') { requests[index].reject({name, message}); },
          finishPlay(index) { plays[index].resolve(); },
          rejectPlay(index) { plays[index].reject(new Error('RAW PLAY ERROR')); },
          end(index) { streams[index].track.dispatchEvent(new Event('ended')); },
          state() { return {active:camera.active, starts, stops, pauses, requests:requests.length, plays:plays.length,
            source:streams.indexOf(video.srcObject), trackStops:streams.map(stream => stream?.track.stopCount)}; }
        };
      }, {unavailable});
    }
    const state = () => page.evaluate(() => harness.state());
    async function startRunning(index = 0, playIndex = index) {
      await page.locator('#start').click();
      await page.evaluate(index => harness.grant(index), index);
      await page.waitForFunction(count => harness.state().plays >= count, playIndex + 1);
      await page.evaluate(index => harness.finishPlay(index), playIndex);
      await page.waitForFunction(() => harness.state().active);
    }

    // A late permission grant is discarded, even after another activation begins.
    await setup();
    assert.equal((await state()).requests, 0);
    await page.locator('#start').click();
    assert.equal(await page.locator('#stop').textContent(), 'Cancelar ativação');
    await page.locator('#stop').click();
    assert.match(await page.locator('#status').textContent(), /Ativação cancelada/);
    assert.equal(await page.locator('#stop').textContent(), 'Desligar câmera');
    await startRunning(1, 0);
    await page.evaluate(() => harness.grant(0));
    await page.waitForFunction(() => harness.state().trackStops[0] === 1);
    assert.equal((await state()).source, 1);
    assert.equal((await state()).active, true);
    await page.locator('#stop').click();
    assert.deepEqual((await state()).trackStops, [1, 1]);

    // An old pending play or ended event cannot stop or reactivate a newer stream.
    await setup();
    await page.locator('#start').click();
    await page.evaluate(() => harness.grant(0));
    await page.waitForFunction(() => harness.state().plays === 1);
    assert.equal(await page.locator('#stop').textContent(), 'Cancelar ativação');
    await page.locator('#stop').click();
    await startRunning(1);
    await page.evaluate(() => { harness.finishPlay(0); harness.end(0); });
    assert.equal((await state()).active, true);
    assert.equal((await state()).source, 1);
    assert.equal((await state()).starts, 1);
    assert.equal(await page.locator('#stop').textContent(), 'Desligar câmera');
    await page.evaluate(() => harness.end(1));
    assert.equal((await state()).active, false);
    assert.match(await page.locator('#status').textContent(), /desconectada/);
    assert.deepEqual((await state()).trackStops, [1, 1]);

    // Failure to start playback releases acquired tracks and allows a retry.
    await setup();
    await page.locator('#start').click();
    await page.evaluate(() => harness.grant(0));
    await page.waitForFunction(() => harness.state().plays === 1);
    await page.evaluate(() => harness.rejectPlay(0));
    await page.waitForFunction(() => !document.querySelector('#start').disabled);
    assert.deepEqual((await state()).trackStops, [1]);
    assert.equal((await state()).source, -1);
    assert.match(await page.locator('#status').textContent(), /Não foi possível ligar/);
    assert.doesNotMatch(await page.locator('#status').textContent(), /RAW PLAY ERROR/);
    await startRunning(1);
    assert.equal((await state()).active, true);
    await page.locator('#stop').click();

    for (const event of ['visibilitychange', 'pagehide']) {
      for (const pending of [false, true]) {
        await setup();
        if (pending) await page.locator('#start').click();
        else await startRunning();
        await page.evaluate(event => {
          if (event === 'visibilitychange') {
            Object.defineProperty(document, 'hidden', {configurable:true, value:true});
            document.dispatchEvent(new Event(event));
          } else window.dispatchEvent(new Event(event));
        }, event);
        if (pending) await page.evaluate(() => harness.grant(0));
        await page.waitForFunction(() => harness.state().trackStops[0] === 1);
        assert.equal((await state()).active, false);
        assert.equal((await state()).source, -1);
        assert.equal(await page.locator('#start').isEnabled(), true);
        assert.equal(await page.locator('#stop').isEnabled(), false);
        assert.equal(await page.locator('#stop').textContent(), 'Desligar câmera');
      }
    }

    for (const [name, expected] of [['NotAllowedError', /negada/], ['NotFoundError', /Nenhuma câmera/], ['NotReadableError', /ocupada/], ['OtherError', /Não foi possível ligar/]]) {
      await setup();
      await page.locator('#start').click();
      await page.evaluate(name => harness.reject(0, name), name);
      await page.waitForFunction(() => !document.querySelector('#start').disabled);
      assert.match(await page.locator('#status').textContent(), expected);
      assert.doesNotMatch(await page.locator('#status').textContent(), /RAW INTERNAL ERROR/);
      assert.equal(await page.locator('#stop').textContent(), 'Desligar câmera');
      assert.equal((await state()).source, -1);
    }
    await setup({unavailable:true});
    await page.locator('#start').click();
    assert.match(await page.locator('#status').textContent(), /localhost ou HTTPS/);
    assert.equal(await page.locator('#start').isEnabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS camera lifecycle: pending cancellation, late permission/play, stale ended events, page exit, Portuguese errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
