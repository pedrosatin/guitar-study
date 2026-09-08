const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  const url = base + '/poc/m1-theory-foundation/';
  mkdirSync('test-results', { recursive: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('#diagram svg').waitFor();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    }
    const neck = page.locator('.diagram-controls').getByRole('button', { name: 'Braço', exact: true });
    await neck.click();
    assert.equal(await neck.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.part.selected').getAttribute('data-part'), 'Braço');
    const nut = page.locator('.part[data-part="Pestana"]');
    await nut.focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#diagram-tip').textContent(), /início da primeira casa/);
    assert.equal(await neck.getAttribute('aria-pressed'), 'false');

    await page.getByRole('button', { name: 'Ouvir corda Mi agudo', exact: true }).click();
    assert.match(await page.locator('#audio-status').textContent(), /1ª corda, Mi agudo/);
    for (const checkbox of await page.locator('[data-practice]').all()) await checkbox.check();
    assert.match(await page.locator('#practice-status').textContent(), /3 ações como feitas/);
    await page.reload();
    assert.equal(await page.locator('[data-practice]:checked').count(), 3);
    await page.locator('[data-practice="fret"]').uncheck();
    assert.match(await page.locator('#practice-status').textContent(), /2 de 3/);

    await page.getByRole('button', { name: 'A mais grossa', exact: true }).click();
    assert.match(await page.locator('#quiz-status').textContent(), /A 1ª é a mais fina/);
    assert.equal(await page.locator('#quiz-help').getAttribute('href'), '#sec-04');
    await page.locator('#quiz-help').click();
    assert.match(page.url(), /#sec-04$/);
    await page.locator('#quiz-next').click();
    for (const answer of ['Tocar sem pressionar uma casa', 'Entre a pestana e o primeiro traste', 'Perto do traste do lado do corpo', 'Fica mais aguda']) {
      await page.getByRole('button', { name: answer, exact: true }).click();
      await page.locator('#quiz-next').click();
    }
    assert.match(await page.locator('#quiz-question').textContent(), /4 de 5/);
    assert.equal(await page.locator('#quiz-question li a').getAttribute('href'), '#sec-04');
    assert.match(await page.locator('#quiz-question li').textContent(), /A 1ª é a mais fina/);
    await page.locator('#quiz-next').click();
    assert.equal(await page.locator('#quiz-question li').count(), 0);
    assert.equal(await page.locator('#quiz-question > p').evaluate(el => el === document.activeElement), true);
    await page.reload();
    assert.match(await page.locator('#quiz-status').textContent(), /Última revisão: 4 de 5/);
    await page.screenshot({ path: 'test-results/fundamentos-revisado-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.screenshot({ path: 'test-results/fundamentos-revisado-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);

    // A blocked store must not prevent the learner from using the lesson.
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const fallback = await blocked.newPage();
    await fallback.goto(url);
    await fallback.locator('[data-practice="locate"]').check();
    assert.match(await fallback.locator('#practice-status').textContent(), /1 de 3/);
    assert.match(await fallback.locator('#practice-storage').textContent(), /não permitiu/);
    await blocked.close();

    const failed = await browser.newPage();
    await failed.route('**/content/*.json', route => route.abort());
    await failed.route('**/assets/violao-parts.svg', route => route.abort());
    await failed.goto(url);
    await failed.getByText('Este trecho não carregou.', { exact: false }).first().waitFor();
    await failed.getByText('Não foi possível carregar o diagrama.', { exact: false }).waitFor();
    assert.equal(await failed.locator('#first-practice').isVisible(), true);
    assert.equal(await failed.getByRole('button', { name: 'A mais fina', exact: true }).isEnabled(), true);
    await failed.close();
    console.log('PASS: Fundamentos, four widths, diagram keyboard/selection, sound status, practice persistence, quiz correction/persistence, blocked storage and resource failure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
