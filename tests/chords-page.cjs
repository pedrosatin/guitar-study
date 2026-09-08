const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const url = (process.env.TEST_BASE_URL || 'http://127.0.0.1:4173') + '/poc/m2-chords-diagram/';
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    assert.match(await page.locator('#first-chord svg').getAttribute('aria-label'), /5ª corda: casa 2, dedo 2 médio/);
    assert.match(await page.locator('#second-chord svg').getAttribute('aria-label'), /6ª corda: não tocar/);
    assert.match(await page.locator('#first-chord .audio-status').textContent(), /não escuta sua execução/);
    await page.getByRole('button', { name: 'Ouvir Em corda por corda', exact: true }).click();
    assert.match(await page.locator('#first-chord .audio-status').textContent(), /uma corda por vez/);
    await page.locator('#first-chord').getByRole('button', { name: 'Parar som' }).click();
    assert.match(await page.locator('#first-chord .audio-status').textContent(), /encerrada/);
    await page.getByRole('link', { name: 'ajuda para conferir o som' }).click();
    assert.equal(await page.locator('#sound-help').getAttribute('open'), '');
    await page.locator('#chord-b').selectOption('D');
    assert.match(await page.locator('#drill-preview').textContent(), /Ré maior/);
    await page.locator('#chord-b').selectOption('Am');
    await page.clock.install();
    await page.locator('#start-drill').click();
    assert.match(await page.locator('#drill-time').textContent(), /Começa em 5/);
    await page.clock.fastForward(66000);
    await page.locator('#drill-count').fill('0');
    await page.getByRole('button', { name: 'Salvar resultado', exact: true }).click();
    assert.match(await page.locator('#drill-status').textContent(), /1 minuto registrado no diário/);
    assert.equal(await page.evaluate(() => window.GuitarStudy.getState().sessions.filter(s => s.moduleId === 'm2').length), 1);
    await page.reload();
    assert.match(await page.locator('#drill-history').textContent(), /0 trocas em 1 minuto/);
    assert.deepEqual(errors, []);
    const unavailable = await browser.newContext();
    await unavailable.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
    const fallback = await unavailable.newPage();
    await fallback.goto(url);
    await fallback.getByRole('button', { name: 'Ouvir Em', exact: true }).click();
    assert.match(await fallback.locator('#first-chord .audio-status').textContent(), /Não foi possível reproduzir áudio/);
    assert.equal(await fallback.locator('#start-drill').isEnabled(), true);
    await unavailable.close();
    console.log('PASS: chord lesson diagrams, local sound feedback/stop/failure, help, pair preview, timer integration, zero result and one diary entry.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
