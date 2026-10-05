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
const child = spawn(portable, ['--remote-debugging-port=9333', `--user-data-dir=${path.join(temp, 'profile')}`], {
  cwd: os.tmpdir(), windowsHide: true, stdio: 'ignore'
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
const errors = [];
const failedRequests = [];
let browser;

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
    let page;
    for (let attempt = 0; attempt < 60; attempt++) {
      page = context.pages().find(p => p.url().includes('index.html'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(page, 'Game window must load index.html');
    assert(!context.pages().some(p => p.url().startsWith('devtools:')), 'No developer tools at startup');
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failedRequests.push({url: request.url(), error: request.failure()?.errorText}));
    await page.reload();
    await page.waitForFunction(() => window.state && Object.keys(window.state.textureData).length > 0);
    await page.locator('#btn-start').waitFor({ state: 'visible' });
    await page.screenshot({path: path.join(out, 'menu.png')});
    await page.locator('#btn-start').click();
    await page.waitForFunction(() => document.getElementById('intro-video').readyState >= 2);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.state.gameState === 'PLAYING' && window.state.map);
    await page.waitForFunction(() => Object.keys(window.audioManager.sounds).length > 0);
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
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({error: error.stack, errors, failedRequests}, null, 2));
    process.exitCode = 1;
    console.error(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child.pid) {
      try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore'}); } catch {}
    }
  }
})();
