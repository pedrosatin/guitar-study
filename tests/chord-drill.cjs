const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.env.TEST_BASE_URL || 'http://127.0.0.1:4173') + '/');
    await page.evaluate(() => localStorage.clear());
    await page.setContent(`<select id="chord-a"></select><select id="chord-b"></select>
      <button id="start-drill">Iniciar</button><button id="stop-drill">Cancelar</button>
      <p id="drill-time"></p><p id="drill-status"></p>
      <form id="drill-result" hidden><input id="drill-count" type="number" required min="0" max="300"><button type="submit">Salvar</button></form>
      <p id="drill-best"></p>`);
    await page.addScriptTag({ path: path.join(__dirname, '../poc/m2-chords-diagram/drill.js') });
    await page.evaluate(() => {
      window.diaryCalls = [];
      window.GuitarStudy = { recordPractice: (...args) => { window.diaryCalls.push(args); return true; } };
      window.initChordDrill([{name:'Em'}, {name:'Am'}, {name:'C'}]);
    });
    await page.clock.install();
    const start = () => page.locator('#start-drill').click();
    const cancel = () => page.locator('#stop-drill').click();
    const finish = async () => { await start(); await page.clock.fastForward(65000); };
    await start();
    assert.match(await page.locator('#drill-time').textContent(), /Começa em 5/);
    await page.clock.fastForward(4000);
    assert.equal(await page.locator('#drill-result').isVisible(), false);
    await cancel();
    assert.equal(await page.locator('#drill-time').textContent(), '60 segundos');
    await start(); await page.clock.fastForward(5000);
    assert.equal(await page.locator('#drill-time').textContent(), '60 segundos');
    await page.clock.fastForward(59000);
    assert.equal(await page.locator('#drill-result').isVisible(), false);
    await cancel();
    assert.equal(await page.evaluate(() => diaryCalls.length), 0);
    await finish();
    assert.equal(await page.locator('#drill-count').inputValue(), '');
    assert.equal(await page.locator('#chord-a').isDisabled(), true);
    assert.equal(await page.locator('#start-drill').isDisabled(), true);
    await page.locator('#drill-result').evaluate(form => form.dispatchEvent(new Event('submit', {cancelable:true})));
    assert.equal(await page.evaluate(() => diaryCalls.length), 0);
    // Even a programmatic selector change cannot relabel a completed attempt.
    await page.locator('#chord-b').evaluate(select => { select.value = 'C'; });
    await page.locator('#drill-count').fill('0');
    await page.locator('#drill-result button[type=submit]').click();
    await page.locator('#drill-result').evaluate(form => form.dispatchEvent(new Event('submit', {cancelable:true})));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('guitar-study-chord-drills')));
    assert.equal(saved.length, 1); assert.equal(saved[0].count, 0); assert.equal(saved[0].pair, 'Am/Em');
    assert.equal(await page.evaluate(() => diaryCalls.length), 1);
    await page.locator('#chord-b').selectOption('Am');
    assert.match(await page.locator('#drill-best').textContent(), /0 trocas/);
    await finish(); await page.locator('#discard-drill').click();
    assert.equal(await page.evaluate(() => diaryCalls.length), 1);
    assert.equal(await page.locator('#start-drill').isEnabled(), true);
    for (let count = 1; count <= 5; count++) {
      await finish(); await page.locator('#drill-count').fill(String(count));
      await page.locator('#drill-result button[type=submit]').click();
    }
    assert.equal(await page.locator('#drill-history li').count(), 5);
    assert.match(await page.locator('#drill-best').textContent(), /5 trocas/);
    await start(); await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('#start-drill').isEnabled(), true);
    await start(); await page.clock.fastForward(5000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable:true, value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('#start-drill').isEnabled(), true);
    assert.equal(await page.locator('#drill-time').textContent(), '60 segundos');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable:true, value:false});
      Storage.prototype.setItem = () => { throw new Error('blocked'); };
      window.GuitarStudy.recordPractice = () => false;
    });
    await finish(); await page.locator('#drill-count').fill('2');
    await page.locator('#drill-result button[type=submit]').click();
    assert.match(await page.locator('#drill-storage').textContent(), /apenas nesta página/);
    assert.match(await page.locator('#drill-status').textContent(), /bloqueou a gravação do diário/);
    assert.deepEqual(errors, []);
    console.log('Chord drill passed: preparation, timing, cancellation, captured pair, zero, duplicate submit, discard, history, blocked storage.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
