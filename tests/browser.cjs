const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require('playwright');
const modules = ['m1-theory-foundation','m2-chords-diagram','m3-chordpro-player','m4-pitch-detect','m5-mediapipe-mirror','m6-fretdetection-marks','m7-onset-rhythm','m8-lesson-curator'];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  mkdirSync('test-results', { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failures.push(response.url()); });
    for (const path of ['', ...modules.map(m => `poc/${m}/`)]) {
      await page.goto(`${base}/${path}`);
      await page.waitForSelector('nav.study-shell');
      assert.equal(await page.locator('h1').count(), 1, `page title: ${path}`);
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `horizontal overflow: ${path} at ${width}`);
      }
      await page.screenshot({ path: `test-results/${path.split('/')[1] || 'home'}.png`, fullPage: true });
    }
    await page.goto(`${base}/poc/m2-chords-diagram/`);
    await page.getByText('Registrar minha prática', {exact:true}).click();
    await page.getByLabel('Minutos praticados').fill('7');
    await page.getByLabel('O que melhorar no próximo treino?').fill('Trocar Em para Am com som limpo');
    await page.getByRole('button', {name:'Salvar prática',exact:true}).click();
    assert.match(await page.locator('.study-save-status').textContent(), /Prática salva/);
    await page.getByRole('link', {name:'Violão / Meu estudo'}).click();
    assert.match(await page.locator('#today-total').textContent(), /7 de 15/);
    assert.match(await page.locator('#session-list').textContent(), /Trocar Em para Am/);
    await page.getByLabel('Meta diária em minutos').fill('20');
    await page.getByRole('button', {name:'Salvar meta'}).click();
    await page.reload();
    assert.equal(await page.getByLabel('Meta diária em minutos').inputValue(), '20');
    assert.match(await page.locator('#today-total').textContent(), /7 de 20/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', {name:'Exportar meus registros'}).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'meu-estudo-de-violao.json');
    await page.getByRole('button', {name:/Excluir registro/}).click();
    assert.match(await page.locator('#today-total').textContent(), /0 de 20/);
    assert.deepEqual(errors, [], 'uncaught JavaScript errors');
    assert.deepEqual(failures, [], 'failed local resources');
    console.log('PASS: all 9 pages, four viewport widths, navigation, diary, goal persistence, export and delete; no JS errors or failed local resources.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
