const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
    await page.goto(base + '/poc/m1-theory-foundation/');
    for (const answer of ['A mais fina', 'Tocar sem pressionar uma casa', 'Entre a pestana e o primeiro traste', 'Perto do traste do lado do corpo', 'Fica mais aguda']) {
      await page.getByRole('button', { name: answer, exact: true }).click();
      await page.locator('#quiz-next').click();
    }
    assert.match(await page.locator('#quiz-question').textContent(), /5 de 5/);
    await page.goto(base + '/poc/m2-chords-diagram/');
    await page.clock.install();
    await page.locator('#start-drill').click();
    assert.equal(await page.locator('#chord-a').isDisabled(), true);
    await page.clock.fastForward(66000);
    await page.locator('#drill-count').fill('12');
    await page.getByRole('button', { name: 'Salvar resultado', exact: true }).click();
    assert.match(await page.locator('#drill-best').textContent(), /12 trocas/);
    await page.reload();
    assert.match(await page.locator('#drill-best').textContent(), /12 trocas/);
    await page.clock.resume();
    await page.goto(base + '/poc/m8-lesson-curator/');
    await page.locator('#continue-lesson').click();
    assert.equal(await page.locator('#m-complete').isDisabled(), true);
    for (const checkbox of await page.locator('.goal-check input').all()) await checkbox.check();
    await page.locator('#m-complete').click();
    await page.locator('#m-close').click();
    await page.reload();
    assert.match(await page.locator('#progress-label').textContent(), /1 de 5/);
    await page.locator('#continue-lesson').click();
    await page.locator('.count-in').click();
    await page.locator('.stop').click();
    await page.waitForTimeout(4500);
    assert.equal(await page.locator('.start').isEnabled(), true);
    assert.match(await page.locator('.practice-status').textContent(), /interrompida/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modal').getAttribute('aria-hidden'), 'true');
    assert.deepEqual(errors, []);
    console.log('Learning flows passed: quiz, timed drill, saved result, lesson goals, progress, count-in cancellation, Escape.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
