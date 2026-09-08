const assert = require('node:assert/strict');
const {mkdirSync, writeFileSync} = require('node:fs');
const {chromium} = require('playwright');
const routes = ['', 'm1-theory-foundation', 'm2-chords-diagram', 'm3-chordpro-player', 'm4-pitch-detect', 'm5-mediapipe-mirror', 'm6-fretdetection-marks', 'm7-onset-rhythm', 'm8-lesson-curator','m9-audio-tabs'];
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const output = 'test-results/frontend-after';
function luminance(hex) {
  const channels = hex.trim().slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
(async () => {
  mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-fake-device-for-media-stream']});
  const report = {pages: [], contrast: [], media: []};
  try {
    const context = await browser.newContext({permissions: ['camera']});
    const page = await context.newPage();
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failures.push(response.url()); });
    let navigation;
    for (const [index, route] of routes.entries()) {
      await page.setViewportSize({width: 320, height: 900});
      await page.goto(`${base}/${route ? `poc/${route}/` : ''}`);
      const links = page.locator('#study-navigation-links');
      const menu = page.getByRole('button', {name: 'Menu', exact: true});
      assert.equal(await links.isVisible(), false, `${route}: compact menu starts closed`);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.study-skip').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('main').evaluate(el => el === document.activeElement), true);
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      const currentNavigation = await links.locator('a').evaluateAll(els => els.map(el => ({text: el.textContent, href: el.getAttribute('href')})));
      if (!navigation) navigation = currentNavigation;
      else assert.deepEqual(currentNavigation, navigation, 'same navigation across pages');
      assert.equal(await links.locator('[aria-current=page]').count(), 1);
      const activeURL = new URL(await links.locator('[aria-current=page]').getAttribute('href'));
      assert.equal(activeURL.pathname, route ? `/poc/${route}/` : '/');
      await links.locator('a').last().focus();
      await page.keyboard.press('Escape');
      assert.equal(await links.isVisible(), false);
      assert.equal(await menu.evaluate(el => el === document.activeElement), true);
      for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 960});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: overflow at ${width}`);
        const metric = await page.locator('main').evaluate(el => ({left: el.getBoundingClientRect().left, mainWidth: el.getBoundingClientRect().width}));
        report.pages.push({route, width, ...metric});
        if ([320, 1440].includes(width)) await page.screenshot({path: `${output}/${index}-${width}.png`, fullPage: true});
      }
      // CSS zoom exercises enlarged text/controls and reflow. It is not browser chrome zoom.
      await page.evaluate(() => document.documentElement.style.zoom = '2');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: overflow with 200% CSS zoom`);
      await page.evaluate(() => document.documentElement.style.zoom = '');
      await page.setViewportSize({width: 720, height: 900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route}: 200% equivalent layout width`);
    }
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(['bg', 'panel', 'raised', 'text', 'muted', 'accent', 'ink', 'control-border'].map(key => [key, style.getPropertyValue('--study-' + key).trim()]));
    });
    for (const foreground of ['text', 'muted', 'accent']) for (const background of ['bg', 'panel', 'raised']) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio}`);
      report.contrast.push({foreground, background, ratio});
    }
    assert.ok(contrast(tokens.ink, tokens.accent) >= 4.5);
    assert.ok(contrast(tokens['control-border'], tokens.raised) >= 3);
    // Exercise the real media module with Chromium's synthetic camera, including resize.
    for (const route of ['m5-mediapipe-mirror', 'm6-fretdetection-marks']) {
      await page.goto(`${base}/poc/${route}/`);
      await page.locator('#start').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Câmera ligada'));
      await page.locator('video').evaluate(video => new Promise(resolve => video.requestVideoFrameCallback(resolve)));
      for (const width of [320, 1440]) {
        await page.setViewportSize({width, height: 960});
        const geometry = await page.evaluate(() => {
          const video = document.querySelector('video'), canvas = document.querySelector('canvas');
          const bounds = el => { const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height}; };
          return {video: bounds(video), canvas: bounds(canvas), actualRatio: video.videoWidth / video.videoHeight, transformVideo: getComputedStyle(video).transform, transformCanvas: getComputedStyle(canvas).transform};
        });
        assert.deepEqual(geometry.video, geometry.canvas, `${route}: overlay bounds at ${width}`);
        assert.ok(Math.abs(geometry.video.width / geometry.video.height - geometry.actualRatio) < .01, `${route}: video ratio at ${width}`);
        if (route.startsWith('m5')) assert.equal(geometry.transformVideo, geometry.transformCanvas);
        else assert.equal(geometry.transformCanvas, 'none');
        report.media.push({route, width, ...geometry});
        await page.locator('#stage').scrollIntoViewIfNeeded();
        await page.screenshot({path: `${output}/${route}-camera-${width}.png`});
      }
      await page.locator('#stop').click();
      assert.equal(await page.locator('#stage').isVisible(), false);
    }
    // Modal must also disable the new navigation, and restore it when closed.
    await page.goto(`${base}/poc/m8-lesson-curator/`);
    await page.locator('#continue-lesson').click();
    assert.equal(await page.locator('nav.study-navigation').evaluate(el => el.inert), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('nav.study-navigation').evaluate(el => el.inert), false);
    await page.emulateMedia({reducedMotion: 'reduce'});
    assert.ok(await page.locator('#continue-lesson').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < .001));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    writeFileSync(`${output}/verification.json`, JSON.stringify(report, null, 2));
    console.log('PASS: common navigation, keyboard disclosure/skip, ten routes/four widths, CSS zoom/reflow, token contrast, media geometry and modal isolation.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
