const { chromium } = require('playwright-core');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

// This test runs on the Windows GitHub runner against the shipped .exe.
const version = require('../package.json').version;
const executable = path.resolve(`dist/Raycasting-Game-${version}-Windows-x64-Portable.exe`);
const out = path.resolve('dist/smoke-test');
fs.mkdirSync(out, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'Raycasting portable test '));
const portable = path.join(temp, path.basename(executable));
fs.copyFileSync(executable, portable);
const profileDir = path.join(temp, 'profile');
const flags = [
  '--remote-debugging-port=9333',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`
];
const child = spawn(portable, flags, {
  cwd: os.tmpdir(),
  stdio: ['ignore', fs.openSync(path.join(out, 'stdout.log'), 'w'), fs.openSync(path.join(out, 'stderr.log'), 'w')]
});
child.on('error', error => { console.error('Child process error:', error); process.exitCode = 1; });
const errors = [];
const failedRequests = [];
let browser;
let page;
const consoleMessages = [];

(async () => {
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:9333/json/version');
        if (response.ok) break;
      } catch {}
      if (attempt === 119) throw new Error('Portable did not start within two minutes');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
    const context = browser.contexts()[0];
    for (let attempt = 0; attempt < 60; attempt++) {
      page = context.pages().find(p => p.url().includes('index.html'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(page, 'Game window must load index.html');
    assert(!context.pages().some(p => p.url().startsWith('devtools:')), 'No developer tools at startup');
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => consoleMessages.push({type: message.type(), text: message.text()}));
    page.on('requestfailed', request => failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
    await page.bringToFront();

    // Pull any early logs stored before CDP attached
    const earlyData = await page.evaluate(() => ({
      logs: window.__logs || [],
      errors: window.__errors || []
    })).catch(() => ({ logs: [], errors: [] }));
    if (earlyData.logs.length > 0) {
      consoleMessages.unshift(...earlyData.logs);
    }
    if (earlyData.errors.length > 0) {
      errors.push(...earlyData.errors.map(e => e.message || String(e)));
    }

    await page.waitForFunction(() => window.state && Object.keys(window.state.textureData).length > 0, null, {polling: 100, timeout: 60000});
    await page.locator('#btn-start').waitFor({ state: 'visible' });
    await page.screenshot({path: path.join(out, 'menu.png')});
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => {
      const v = document.getElementById('intro-video');
      return v && v.readyState >= 2;
    }, null, {polling: 100, timeout: 30000});
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.state.gameState === 'PLAYING' && window.state.map, null, {polling: 100});
    await page.waitForFunction(() => Object.keys(window.audioManager.sounds).length > 0, null, {polling: 100});
    const before = await page.evaluate(() => window.state.lastTime);
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => ({
      gameState: window.state.gameState,
      frameTime: window.state.lastTime,
      mapWidth: window.state.map.width,
      enemies: window.state.enemies.length,
      textures: Object.keys(window.state.textureData).length,
      sounds: Object.keys(window.audioManager.sounds).length,
      canvasWidth: document.getElementById('gameCanvas').width
    }));
    assert(state.frameTime > before, 'Game loop must advance');
    assert(state.mapWidth > 0 && state.enemies > 0 && state.canvasWidth > 0, 'Playable level must exist');
    await page.screenshot({path: path.join(out, 'gameplay.png')});
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({state, errors, failedRequests}, null, 2));
    assert.equal(errors.length, 0, 'No uncaught renderer errors');
    assert.equal(failedRequests.filter(r => !r.error?.includes('ERR_ABORTED')).length, 0, 'Game assets must load');
    console.log('Portable smoke test passed:', JSON.stringify(state));
  } catch (error) {
    let crashLog = null;
    try {
      const crashFile = path.join(profileDir, 'crash.log');
      if (fs.existsSync(crashFile)) crashLog = fs.readFileSync(crashFile, 'utf8');
    } catch {}
    const diagnostics = page ? await page.evaluate(() => ({ready: document.readyState, state: window.state?.gameState, textures: window.state?.textureData && Object.keys(window.state.textureData), images: Array.from(document.images).map(i => ({src: i.src, width: i.naturalWidth})), floors: window.state?.textures?.floors?.map(i => ({src: i.src, complete: i.complete, width: i.naturalWidth}))})).catch(() => null) : null;
    if (page) await page.screenshot({path: path.join(out, 'failure.png'), timeout: 10000}).catch(() => {});
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({error: error.stack, crashLog, diagnostics, consoleMessages, errors, failedRequests}, null, 2));
    process.exitCode = 1;
    console.error(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child.pid) {
      try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore'}); } catch {}
    }
  }
})();
