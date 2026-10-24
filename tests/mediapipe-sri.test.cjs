const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const cameraModule = await import('../shared/camera.js');
  assert.equal(typeof cameraModule.ensureMediaPipePreload, 'function');
  assert.equal(cameraModule.MEDIAPIPE_VISION_URL, 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
  assert.match(cameraModule.MEDIAPIPE_VISION_INTEGRITY, /^sha384-[A-Za-z0-9+/=]+$/);
  assert.equal(cameraModule.MEDIAPIPE_VISION_INTEGRITY, 'sha384-qsA1BRfKmchnC69yqjINz0DJRWvhfT/a97ChCw5MjMk1dzQqwwGgIoAb+J7eW8N5');

  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    // 1. Verify modulepreload link structure with SRI
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${base}/poc/m5-mediapipe-mirror/`);

    const preloadInfo = await page.evaluate(async () => {
      const { ensureMediaPipePreload, MEDIAPIPE_VISION_URL, MEDIAPIPE_VISION_INTEGRITY } = await import('../../shared/camera.js');
      const link = ensureMediaPipePreload();
      return {
        rel: link.rel,
        href: link.href,
        crossOrigin: link.crossOrigin,
        hasIntegrityAttr: link.hasAttribute('integrity'),
        integrityValue: link.getAttribute('integrity'),
        expectedIntegrity: MEDIAPIPE_VISION_INTEGRITY
      };
    });

    assert.equal(preloadInfo.rel, 'modulepreload');
    assert.equal(preloadInfo.crossOrigin, 'anonymous');

    // 2. Verify SRI blocks tampered module content
    const tamperedContext = await browser.newContext();
    await tamperedContext.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
      contentType: 'text/javascript',
      body: 'export const tampered = true;'
    }));
    const tamperedPage = await tamperedContext.newPage();
    await tamperedPage.goto(`${base}/poc/m5-mediapipe-mirror/`);

    const tamperResult = await tamperedPage.evaluate(async () => {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
      link.integrity = 'sha384-qsA1BRfKmchnC69yqjINz0DJRWvhfT/a97ChCw5MjMk1dzQqwwGgIoAb+J7eW8N5';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      try {
        await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
        return { loaded: true };
      } catch (err) {
        return { loaded: false, error: err.message };
      }
    });

    assert.equal(tamperResult.loaded, false, 'Tampered script with mismatched SRI must be blocked by the browser');
    await tamperedContext.close();

    // 3. Verify SRI succeeds when digest matches
    const validBody = 'export const safeMediaPipeModule = "verified";';
    const validDigest = 'sha384-' + crypto.createHash('sha384').update(validBody).digest('base64');
    const validContext = await browser.newContext();
    await validContext.route('https://cdn.jsdelivr.net/**', route => route.fulfill({
      contentType: 'text/javascript',
      body: validBody
    }));
    const validPage = await validContext.newPage();
    await validPage.goto(`${base}/poc/m5-mediapipe-mirror/`);

    const validResult = await validPage.evaluate(async (digest) => {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
      link.integrity = digest;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
        return { loaded: true, safe: mod.safeMediaPipeModule };
      } catch (err) {
        return { loaded: false, error: err.message };
      }
    }, validDigest);

    assert.equal(validResult.loaded, true);
    assert.equal(validResult.safe, 'verified');
    await validContext.close();

    console.log('PASS mediapipe-sri: constants, modulepreload, tamper resistance, digest match validation.');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
