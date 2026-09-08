const assert = require('node:assert/strict');
const {mkdirSync, writeFileSync} = require('node:fs');
const {chromium} = require('playwright');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const output = 'test-results/technical-validation';
const routes = ['', 'm1-theory-foundation', 'm2-chords-diagram', 'm3-chordpro-player', 'm4-pitch-detect', 'm5-mediapipe-mirror', 'm6-fretdetection-marks', 'm7-onset-rhythm', 'm8-lesson-curator'];

// A scoped check of rendered text on solid backgrounds. Gradients, images and
// group opacity need separate visual inspection and are reported as skipped.
function inspectTextContrast() {
  const rgb = text => (text.match(/[\d.]+/g) || []).map(Number);
  const luminance = channels => channels.slice(0, 3).map(v => v / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const result = {checked: 0, skipped: [], failures: []};
  for (const element of document.querySelectorAll('body *')) {
    if (!element.checkVisibility() || element.closest('svg, [disabled], [inert]') ||
        !Array.from(element.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const style = getComputedStyle(element);
    const chain = [];
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) chain.unshift(ancestor);
    let background = [255, 255, 255], unsupported = false;
    for (const ancestor of chain) {
      const computed = getComputedStyle(ancestor);
      if (computed.backgroundImage !== 'none' || computed.opacity !== '1') unsupported = true;
      const color = rgb(computed.backgroundColor), alpha = color[3] ?? 1;
      background = background.map((value, i) => value * (1 - alpha) + color[i] * alpha);
    }
    const description = {tag: element.tagName, id: element.id, text: element.textContent.trim().slice(0, 80)};
    if (unsupported) { result.skipped.push(description); continue; }
    const color = rgb(style.color), alpha = color[3] ?? 1;
    const foreground = background.map((value, i) => value * (1 - alpha) + color[i] * alpha);
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    const ratio = (light + .05) / (dark + .05);
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && parseInt(style.fontWeight) >= 700);
    result.checked++;
    if (ratio < (large ? 3 : 4.5)) result.failures.push({...description, ratio});
  }
  return result;
}

async function tabTo(page, selector) {
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(selector => document.activeElement.matches(selector), selector)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Unreachable by Tab: ${selector}`);
}

(async () => {
  mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  const report = {pages: [], states: [], keyboardFlows: []};
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = await page.context().newCDPSession(page);
    async function inspect(label) {
      const tree = await cdp.send('Accessibility.getFullAXTree');
      const controls = tree.nodes.filter(node => !node.ignored &&
        ['button', 'textbox', 'combobox', 'checkbox', 'slider', 'spinbutton', 'link'].includes(node.role?.value));
      const missingNames = controls.filter(node => !node.name?.value).map(node => node.backendDOMNodeId);
      const contrast = await page.evaluate(inspectTextContrast);
      const result = {label, controls: controls.length, missingNames, contrast};
      report.states.push(result);
      assert.deepEqual(missingNames, [], `${label}: unnamed controls in accessibility tree`);
      assert.deepEqual(contrast.failures, [], `${label}: text contrast`);
      return tree;
    }
    for (const route of routes) {
      await page.setViewportSize({width: 1440, height: 900});
      await page.goto(`${base}/${route ? `poc/${route}/` : ''}`);
      assert.equal(await page.locator('h1').count(), 1);
      assert.match(await page.locator('html').getAttribute('lang'), /^pt/);
      await inspect(`${route || 'home'}: initial`);
      for (const summary of await page.locator('details:not([open]) > summary').all()) {
        if (await summary.isVisible()) await summary.click();
      }
      await inspect(`${route || 'home'}: expanded details`);
      const primary = page.locator('button.primary, .study-action, .study-log button').first();
      if (await primary.isVisible() && await primary.isEnabled()) {
        await primary.hover();
        await page.waitForTimeout(150);
        await inspect(`${route || 'home'}: primary hover`);
      }

      for (const width of [1440, 390]) {
        await page.setViewportSize({width, height: 844});
        await page.goto('about:blank');
        await page.goto(`${base}/${route ? `poc/${route}/` : ''}`);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.study-skip').evaluate(e => e === document.activeElement), true);
        await page.keyboard.press('Enter');
        const visited = new Set();
        const hiddenFocus = [];
        for (let i = 0; i < 160; i++) {
          await page.keyboard.press('Tab');
          const focus = await page.evaluate(() => {
            const e = document.activeElement, s = getComputedStyle(e);
            const visible = Array.from(e.getClientRects()).some(r => {
              const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              // SVG groups can have unpainted space between their shapes.
              return !!center && (e === center || e.contains(center) ||
                (e instanceof SVGElement && e.closest('svg').contains(center)));
            });
            return {key: Array.from(document.querySelectorAll('*')).indexOf(e) + ':' + e.tagName + ':' + e.id,
              body: e === document.body, visible,
              outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0};
          });
          if (focus.body || visited.has(focus.key)) break;
          visited.add(focus.key);
          if (!focus.visible || !focus.outline) hiddenFocus.push(focus);
        }
        report.pages.push({route, width, tabStops: visited.size, hiddenFocus});
        assert.deepEqual(hiddenFocus, [], `${route}: focus obscured or without outline at ${width}`);
      }
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 844});
      await page.goto(`${base}/`);
      await tabTo(page, '.study-action');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/m8-lesson-curator/');
      await tabTo(page, '#continue-lesson');
      await page.keyboard.press('Enter');
      const tree = await inspect(`lesson open: ${width}`);
      assert.ok(tree.nodes.some(n => !n.ignored && n.role?.value === 'dialog' && n.name?.value.includes('Primeiros passos com o violão')));
      assert.ok(!tree.nodes.some(n => !n.ignored && n.role?.value === 'navigation'));
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#m-back').evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#m-close').evaluate(e => e === document.activeElement), true);
      await tabTo(page, '#lesson-note');
      await page.keyboard.type('Teste tecnico de teclado.');
      await tabTo(page, '#m-back');
      await page.screenshot({path: `${output}/keyboard-lesson-${width}.png`});
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#continue-lesson').evaluate(e => e === document.activeElement), true);
      await tabTo(page, 'aside summary');
      await page.keyboard.press('Enter');
      await tabTo(page, 'input[name="minutes"]');
      await page.keyboard.press('Control+A');
      await page.keyboard.type('5');
      await tabTo(page, 'textarea[name="note"]');
      await page.keyboard.type('Registro tecnico por teclado, sem instrumento.');
      await tabTo(page, '.study-log button');
      await inspect(`diary focused: ${width}`);
      await page.keyboard.press('Enter');
      assert.match(await page.locator('.study-save-status').textContent(), /Prática salva/);
      await inspect(`diary saved: ${width}`);
      if (width < 1200) {
        await tabTo(page, '.study-menu-toggle');
        await page.keyboard.press('Enter');
      }
      await tabTo(page, '.study-links a[href$="#history"]');
      await page.keyboard.press('Enter');
      await page.waitForURL('**/#history');
      assert.match(await page.locator('#session-list').textContent(), /Registro tecnico por teclado/);
      report.keyboardFlows.push({width, passed: true});
    }
    assert.deepEqual(errors, []);
    console.log('PASS: accessible names, solid-background text contrast, visible Tab focus, keyboard-only lesson and diary, modal accessibility tree and focus return.');
  } finally {
    writeFileSync(`${output}/accessibility.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
