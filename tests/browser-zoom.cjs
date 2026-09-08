// Optional Linux/X11 check. Sends keys only to an isolated test Chromium window.
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {mkdirSync, writeFileSync} = require('node:fs');
const {chromium} = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const output = 'test-results/technical-validation';
const routes = ['', 'm1-theory-foundation', 'm2-chords-diagram', 'm3-chordpro-player', 'm4-pitch-detect', 'm5-mediapipe-mirror', 'm6-fretdetection-marks', 'm7-onset-rhythm', 'm8-lesson-curator','m9-audio-tabs'];

(async () => {
  mkdirSync(output, {recursive: true});
  const windowClass = `guitar-study-zoom-${process.pid}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: false,
    args: ['--no-sandbox', '--ozone-platform=x11', `--class=${windowClass}`, '--force-device-scale-factor=1']});
  try {
    const context = await browser.newContext({viewport: null});
    const page = await context.newPage();
    await page.goto(`${base}/`);
    const windows = execFileSync('xdotool', ['search', '--onlyvisible', '--class', windowClass], {encoding: 'utf8'}).trim().split('\n');
    const windowId = windows.at(-1);
    assert.match(windowId, /^\d+$/);
    execFileSync('xdotool', ['windowfocus', '--sync', windowId]);
    const key = value => execFileSync('xdotool', ['key', '--window', windowId, value]);
    key('ctrl+0');
    await page.waitForTimeout(500);
    const measure = () => page.evaluate(() => ({dpr: devicePixelRatio, width: innerWidth}));
    const baseline = await measure();
    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await measure()).dpr / baseline.dpr >= 2) break;
      key('ctrl+plus');
      await page.waitForTimeout(400);
    }
    const zoom = await measure();
    assert.equal(zoom.dpr / baseline.dpr, 2, 'native zoom must double DPR');
    assert.ok(Math.abs(zoom.width * 2 - baseline.width) <= 2);
    const cdp = await context.newCDPSession(page);
    const pages = [];
    for (const [index, route] of routes.entries()) {
      await page.goto(`${base}/${route ? `poc/${route}/` : ''}`);
      const state = await page.evaluate(() => ({dpr: devicePixelRatio, width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth, cssZoom: getComputedStyle(document.documentElement).zoom}));
      assert.equal(state.dpr / baseline.dpr, 2);
      assert.ok(state.scrollWidth <= state.width, `${route}: horizontal overflow at 200%`);
      assert.equal(state.cssZoom, '1');
      pages.push({route, ...state});
      // No CSS-pixel clip: Playwright fullPage clips incorrectly under native zoom.
      const shot = await cdp.send('Page.captureScreenshot', {format: 'png', fromSurface: true, captureBeyondViewport: false});
      writeFileSync(`${output}/zoom-200-${index}.png`, Buffer.from(shot.data, 'base64'));
    }
    writeFileSync(`${output}/browser-zoom.json`, JSON.stringify({method: 'Isolated headed Chromium; xdotool Ctrl+plus directed to test window', baseline, zoom, pages}, null, 2));
    console.log('PASS: native browser zoom 200%, nine pages, doubled DPR, reflow without horizontal document overflow.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
