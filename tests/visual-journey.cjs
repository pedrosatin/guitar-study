// Visual study flow in isolated desktop and touch contexts. No instrument performance is asserted.
const assert = require('node:assert/strict');
const {mkdirSync, writeFileSync} = require('node:fs');
const {chromium} = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const output = 'test-results/visual-step1';
const routes = ['', 'm1-theory-foundation', 'm2-chords-diagram', 'm3-chordpro-player', 'm4-pitch-detect', 'm5-mediapipe-mirror', 'm6-fretdetection-marks', 'm7-onset-rhythm', 'm8-lesson-curator'];
(async () => {
  mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  const report = {browser: browser.version(), pages: [], flows: []};
  try {
    for (const [device, width, height, touch] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true], ['small-mobile', 320, 568, true]]) {
      const context = await browser.newContext({viewport: {width, height}, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      const activate = async locator => touch ? locator.tap() : locator.click();
      async function navigate(name) {
        if (touch) await activate(page.getByRole('button', {name: 'Menu', exact: true}));
        await activate(page.locator('#study-navigation-links').getByRole('link', {name, exact: true}));
      }
      for (const [index, route] of routes.entries()) {
        await page.goto(`${base}/${route ? `poc/${route}/` : ''}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({path: `${output}/${device}-${index}-after.png`, fullPage: true});
        const sections = page.locator('main > section, main > .plan-lessons');
        const count = await sections.count();
        if (count) {
          await sections.nth(Math.floor(count / 2)).scrollIntoViewIfNeeded();
          await page.screenshot({path: `${output}/${device}-${index}-middle.png`});
        }
        await page.locator('main').press('End');
        await page.locator(touch ? '.study-menu-toggle' : '.study-brand').evaluate(el => {
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > innerHeight) throw Error('Navigation out of view');
        });
        report.pages.push({device, route, ...await page.evaluate(() => ({width: innerWidth, height: document.documentElement.scrollHeight}))});
      }
      await navigate('Meu estudo');
      await activate(page.getByRole('link', {name: 'Abrir meu plano de estudo'}));
      await activate(page.locator('#continue-lesson'));
      await activate(page.getByRole('link', {name: 'Afinar violão', exact: true}));
      await activate(page.getByRole('link', {name: 'Ir para o afinador', exact: true}));
      if (touch) assert.ok(await page.locator('#tuner').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('nav').getBoundingClientRect().bottom), 'Anchor stays below the sticky menu');
      await page.locator('#target').selectOption({index: 5});
      assert.match(await page.locator('#string-help').innerText(), /1ª/);
      await page.screenshot({path: `${output}/${device}-tuner.png`});
      await navigate('Plano de estudo');
      await activate(page.locator('#continue-lesson'));
      const note = 'Validação da interface: retomar a primeira aula.';
      await page.locator('#m-body textarea').fill(note);
      await page.locator('#m-body textarea').blur();
      await page.locator('#m-back').scrollIntoViewIfNeeded();
      // Let Chromium's transient touch highlight disappear before capturing the controls.
      if (touch) await page.waitForTimeout(400);
      await page.screenshot({path: `${output}/${device}-lesson-end-after.png`});
      await activate(page.locator('#m-back'));
      assert.equal(await page.locator('#modal').getAttribute('aria-hidden'), 'true');
      await activate(page.locator('#continue-lesson'));
      assert.equal(await page.locator('#m-body textarea').inputValue(), note);
      await activate(page.locator('#m-back'));
      await activate(page.getByText('Registrar minha prática', {exact: true}));
      await page.locator('.study-log input').fill('5');
      await page.locator('.study-log textarea').fill('Registro de teste visual; sem execução no instrumento.');
      await activate(page.getByRole('button', {name: 'Salvar prática', exact: true}));
      assert.match(await page.locator('.study-save-status').innerText(), /Prática salva/);
      await page.screenshot({path: `${output}/${device}-saved.png`});
      await navigate('Diário de prática');
      assert.match(await page.locator('#session-list').innerText(), /Registro de teste visual/);
      assert.equal(await page.locator('#export').isEnabled(), true);
      await page.screenshot({path: `${output}/${device}-history.png`});
      await page.reload();
      assert.match(await page.locator('#session-list').innerText(), /Registro de teste visual/);
      assert.deepEqual(errors, []);
      report.flows.push({device, result: 'PASS', scope: 'Plan → tuner controls → lesson note → return → diary → reload. No real tuning or playing.'});
      await context.close();
    }
    writeFileSync(`${output}/journey.json`, JSON.stringify(report, null, 2));
    console.log('PASS: nine pages, desktop and two touch sizes, navigation while scrolling, lesson return and persisted study diary.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
