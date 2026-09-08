const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const url = (process.env.TEST_BASE_URL || 'http://127.0.0.1:4173') + '/poc/m3-chordpro-player/';
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.testClicks = [];
      window.AudioContext = class {
        constructor() { this.origin = performance.now(); this.destination = {}; }
        get currentTime() { return (performance.now() - this.origin) / 1000; }
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
        createOscillator() {
          const oscillator = { frequency: {}, connect() {}, disconnect() {},
            start: time => window.testClicks.push({ time, frequency: oscillator.frequency.value }),
            stop() { setTimeout(() => oscillator.onended?.(), 50); } };
          return oscillator;
        }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      };
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-06T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-06T12:00:01Z'));
    await page.goto(url);
    const text = id => page.locator('#' + id).textContent();
    const advance = ms => page.clock.runFor(ms);
    const start = () => page.locator('#play-btn').click();
    const reset = () => page.locator('#restart-btn').click();
    const clicks = () => page.evaluate(() => window.testClicks.length);
    await start(); await advance(3100);
    assert.equal(await clicks(), 4);
    assert.match(await text('beat-instruction'), /Preparação: 4 de 4/);
    assert.equal(await page.locator('#song-select').isDisabled(), true);
    await advance(1000);
    assert.match(await text('beat-instruction'), /Conte: 1/);
    await advance(8000);
    assert.match(await text('playback-status'), /Exercício concluído/);
    assert.equal(await clicks(), 12, 'four preparation and eight exercise clicks');
    assert.equal(await page.locator('#pause-btn').isDisabled(), true);

    await page.locator('#song-select').selectOption('2');
    await start(); await advance(4100);
    assert.equal(await text('current-chord'), 'Em');
    assert.equal(await text('next-chord'), 'Am');
    await advance(3900);
    assert.equal(await text('current-chord'), 'Em', 'last Em beat lasts a full interval');
    await advance(100);
    assert.equal(await text('current-chord'), 'Am', 'change after exactly four Em clicks');
    await advance(1000);
    await page.locator('#pause-btn').click();
    const pausedClicks = await clicks();
    await advance(5000);
    assert.equal(await clicks(), pausedClicks);
    assert.equal(await text('play-btn'), 'Continuar');
    await start(); await advance(3100);
    assert.match(await text('beat-instruction'), /Preparação: 4 de 4/);
    await page.locator('#pause-btn').click();
    assert.equal(await text('current-chord'), 'Am', 'pausing again during preparation preserves the interrupted chord');
    await start(); await advance(3100);
    assert.match(await text('beat-instruction'), /Preparação: 4 de 4/);
    await advance(1000);
    assert.equal(await text('current-chord'), 'Am');
    assert.match(await text('beat-instruction'), /Clique 1 de 4/);
    await reset();
    assert.equal(await text('current-chord'), 'Em');
    assert.match(await text('playback-status'), /Pronto/);
    const resetClicks = await clicks(); await advance(5000);
    assert.equal(await clicks(), resetClicks);

    await page.locator('#practice-options summary').click();
    await page.locator('#repeat').check();
    await start(); await advance(20100);
    assert.equal(await text('current-chord'), 'Em');
    assert.equal(await page.locator('#pause-btn').isEnabled(), true);
    assert.equal(await clicks() - resetClicks, 21, 'repeat has one count-in then continuous sequences');
    await reset(); await page.locator('#repeat').uncheck();
    await start(); await advance(100);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.match(await text('playback-status'), /Pausado ao sair da página/);
    const hiddenClicks = await clicks(); await advance(2000);
    assert.equal(await clicks(), hiddenClicks);
    assert.equal(await text('play-btn'), 'Continuar');
    await reset();

    await page.locator('#custom-editor > summary').click();
    await page.locator('#custom-song').fill('{title: Meu compasso}\n{bpm: 60}\n{time_signature: 3/4}\n[Em]um [Am]dois');
    await page.locator('#load-custom').click();
    assert.equal(await page.locator('.beat-dot').count(), 3);
    assert.match(await text('exercise-help'), /3 cliques de preparação/);
    await start(); await advance(3100);
    assert.equal(await text('current-chord'), 'Em');
    await advance(3000); assert.equal(await text('current-chord'), 'Am');
    await advance(3000); assert.match(await text('playback-status'), /Exercício concluído/);

    await page.locator('#custom-song').fill('texto sem cifra');
    await page.locator('#load-custom').click();
    assert.match(await text('custom-status'), /exercício anterior foi mantido/);
    assert.equal(await text('song-title'), 'Meu compasso');
    await page.locator('#custom-song').fill('{title: <img src=x onerror="window.injected=true">}\n[<svg onload="window.injected=true">]texto');
    await page.locator('#load-custom').click();
    assert.equal(await page.locator('#bpm').inputValue(), '60', 'a custom sequence keeps the beginner default without a BPM directive');
    assert.equal(await page.locator('#song-area svg, #song-title img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    await page.locator('#custom-song').fill('{bpm: inválido}\n[Em]Mi menor');
    await page.locator('#load-custom').click();
    assert.equal(await page.locator('#bpm').inputValue(), '60', 'an invalid BPM directive uses the beginner default');
    await page.locator('#song-select').selectOption('0');
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow at ' + width);
    }
    assert.deepEqual(errors, []);
    await context.close();

    const unavailable = await browser.newContext();
    await unavailable.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const fallback = await unavailable.newPage(); await fallback.goto(url);
    await fallback.locator('#play-btn').click();
    assert.match(await fallback.locator('#playback-status').textContent(), /Não foi possível iniciar o áudio/);
    assert.equal(await fallback.locator('#play-btn').isEnabled(), true);
    assert.equal(await fallback.locator('#song-select').isEnabled(), true);
    await unavailable.close();
    console.log('PASS: rhythm count-in, exact chord timing, pause/restart, repeat, 3/4, invalid custom input, XSS, four widths and audio failure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
