const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const url = (process.env.TEST_BASE_URL || 'http://127.0.0.1:4173') + '/poc/m4-pitch-detect/';
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.mic = { frequency: 82.40688922821741, amplitude: .15, mode: 'tone', stopped: 0, closed: 0, disconnected: 0, permission: 'allow', resume: 'allow', pending: [], resumes: [], tracks: [] };
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => {
        const acquire = () => {
          const track = new EventTarget();
          track.stop = () => mic.stopped++;
          mic.tracks.push(track);
          return { getTracks: () => [track], getAudioTracks: () => [track] };
        };
        if (mic.permission === 'pending') return new Promise(resolve => mic.pending.push(() => resolve(acquire())));
        if (mic.permission !== 'allow') return Promise.reject(Object.assign(new Error('untranslated'), { name: mic.permission }));
        return Promise.resolve(acquire());
      }});
      window.AudioContext = class {
        sampleRate = 48000;
        resume() { return mic.resume === 'pending' ? new Promise(resolve => mic.resumes.push(resolve)) : Promise.resolve(); }
        close() { mic.closed++; return Promise.resolve(); }
        createMediaStreamSource() { return { connect() {}, disconnect() { mic.disconnected++; } }; }
        createAnalyser() { return { disconnect() { mic.disconnected++; }, getFloatTimeDomainData(buffer) {
          let seed = 1234567;
          for (let i = 0; i < buffer.length; i++) {
            seed = (seed * 16807) % 2147483647;
            buffer[i] = mic.mode === 'noise' ? (seed / 2147483647 * 2 - 1) * mic.amplitude : Math.sin(2 * Math.PI * mic.frequency * i / 48000) * mic.amplitude;
          }
        }}; }
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-06T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-06T12:00:01Z'));
    await page.goto(url);
    const text = id => page.locator('#' + id).textContent();
    const advance = ms => page.clock.runFor(ms);
    const click = id => page.locator('#' + id).click();
    const signal = values => page.evaluate(values => Object.assign(mic, values), values);
    assert.equal(await page.locator('#target').inputValue(), 'E2');
    assert.equal(await page.locator('#needle').isHidden(), true);
    await click('start'); await advance(900);
    assert.match(await text('guidance'), /Som no alvo/);
    assert.match(await text('progress'), /^0 de 6/);
    assert.notEqual(await text('verdict'), '✓');
    await advance(300);
    assert.match(await text('progress'), /^1 de 6/);
    assert.equal(await text('verdict'), '✓');
    assert.match(await text('note'), /Mi \(E2\)/);
    await signal({ amplitude: 0 }); await advance(100);
    assert.match(await text('guidance'), /Sem som suficiente/);
    assert.equal(await page.locator('#needle').isHidden(), true);
    assert.match(await text('progress'), /^1 de 6/, 'history remains after sound ends');
    await signal({ amplitude: .15, mode: 'noise' }); await advance(100);
    assert.match(await text('guidance'), /Som sem uma nota clara/);
    await signal({ mode: 'tone', frequency: 110 }); await advance(100);
    assert.match(await text('guidance'), /Nota distante/);
    assert.equal(await text('verdict'), '?');
    assert.equal(await page.locator('#needle').isHidden(), true);
    await signal({ frequency: 82.40688922821741 * Math.pow(2, -30 / 1200) }); await advance(100);
    assert.match(await text('guidance'), /Aumente a tensão/);
    await signal({ frequency: 82.40688922821741 * Math.pow(2, 30 / 1200) }); await advance(100);
    assert.match(await text('guidance'), /Diminua a tensão/);
    await click('next-string');
    assert.equal(await page.locator('#target').inputValue(), 'A2');
    assert.equal(await page.locator('#needle').isHidden(), true);
    await signal({ frequency: 110 }); await advance(700);
    await signal({ amplitude: 0 }); await advance(100);
    await signal({ amplitude: .15 }); await advance(700);
    assert.match(await text('progress'), /^1 de 6/, 'interrupted stability must start again');
    await advance(500); assert.match(await text('progress'), /^2 de 6/);
    await click('reset-check');
    assert.match(await text('progress'), /^0 de 6/);
    assert.equal(await page.locator('#needle').isHidden(), true);
    await advance(900); assert.match(await text('progress'), /^0 de 6/);
    await page.locator('#target').selectOption('E4');
    assert.equal(await page.locator('#next-string').isDisabled(), true);
    // Finish out of order to ensure completion does not depend on the selected string.
    for (const [key, frequency] of [['E4',329.62755691286977],['E2',82.40688922821741],['D3',146.83238395883756],['G3',195.99771799009934],['B3',246.94165062806205],['A2',110]]) {
      await page.locator('#target').selectOption(key);
      await signal({ frequency }); await advance(1200);
    }
    assert.match(await text('progress'), /^6 de 6/);
    assert.match(await text('guidance'), /As seis cordas/);
    await page.evaluate(() => {
      window.guidanceChanges = 0;
      new MutationObserver(records => window.guidanceChanges += records.length).observe(document.getElementById('guidance'), { childList: true });
    });
    await advance(300);
    assert.equal(await page.evaluate(() => window.guidanceChanges), 0, 'stable completion is not announced every frame');
    await click('start');
    assert.equal(await page.evaluate(() => mic.stopped), 1);
    assert.equal(await page.evaluate(() => mic.closed), 1);
    assert.equal(await page.evaluate(() => mic.disconnected), 2);

    await signal({ permission: 'pending' }); await click('start');
    assert.equal(await text('start'), 'Cancelar ativação');
    await click('start');
    assert.match(await text('status'), /cancelada/);
    await page.evaluate(() => mic.pending.shift()());
    assert.equal(await page.evaluate(() => mic.stopped), 2, 'late permission stream immediately stopped');
    assert.equal(await text('start'), 'Ligar microfone');
    await signal({ permission: 'allow', resume: 'pending' }); await click('start');
    await click('start');
    await page.evaluate(() => mic.resumes.shift()());
    assert.equal(await text('start'), 'Ligar microfone');
    assert.equal(await page.evaluate(() => mic.stopped), 3);
    assert.equal(await page.evaluate(() => mic.closed), 2);
    await signal({ resume: 'allow' }); await click('start');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.match(await text('status'), /ao sair/);
    assert.equal(await page.evaluate(() => mic.stopped), 4);
    await click('start');
    await page.evaluate(() => mic.tracks.at(-1).dispatchEvent(new Event('ended')));
    assert.match(await text('status'), /desconectado/);
    await click('start');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal(await text('start'), 'Ligar microfone');
    assert.equal(await page.evaluate(() => mic.stopped), 6);
    for (const [permission, expected] of [['NotAllowedError', /Permissão negada/], ['NotFoundError', /Nenhum microfone/], ['NotReadableError', /Não foi possível acessar/], ['OtherError', /Não foi possível iniciar/]]) {
      await signal({ permission }); await click('start');
      assert.match(await text('status'), expected);
      assert.equal(await text('start'), 'Ligar microfone');
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: tuner actual-waveform detection, one-second uninterrupted confirmation, silence/noise/far-note guidance, history, next/reset, permission cancellation, audio cleanup and Portuguese errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
