const { chromium } = require('playwright-core');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

function log(msg) {
  console.log(`[SMOKE ${new Date().toISOString()}] ${msg}`);
}

// Watchdog to prevent any hang from running up to the GitHub Actions job limit
let childProcess = null;
function killProcesses() {
  try { execFileSync('taskkill', ['/IM', 'RayCaster.exe', '/F'], { stdio: 'ignore' }); } catch {}
  try { execFileSync('taskkill', ['/IM', 'electron.exe', '/F'], { stdio: 'ignore' }); } catch {}
  if (childProcess && childProcess.pid) {
    try { execFileSync('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
}

const watchdog = setTimeout(() => {
  console.error('[SMOKE] FATAL: Global watchdog timeout (180s) exceeded! Killing processes and exiting...');
  killProcesses();
  process.exit(1);
}, 180000);
watchdog.unref();

function safeEval(page, fn, timeoutMs = 8000, fallback = null) {
  if (!page) return Promise.resolve(fallback);
  return Promise.race([
    page.evaluate(fn),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluation timed out')), timeoutMs))
  ]).catch(() => fallback);
}

const version = require('../package.json').version;
const executable = path.resolve(`dist/Raycasting-Game-${version}-Windows-x64-Portable.exe`);
const out = path.resolve('dist/smoke-test');
fs.mkdirSync(out, { recursive: true });

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'Raycasting_portable_test_'));
const portable = path.join(temp, path.basename(executable));
fs.copyFileSync(executable, portable);
const profileDir = path.join(temp, 'profile');
const flags = [
  '--remote-debugging-port=9333',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`
];

log(`Spawning portable executable: ${portable}`);
const stdoutFd = fs.openSync(path.join(out, 'stdout.log'), 'w');
const stderrFd = fs.openSync(path.join(out, 'stderr.log'), 'w');

const child = spawn(portable, flags, {
  cwd: temp,
  stdio: ['ignore', stdoutFd, stderrFd]
});
childProcess = child;
child.on('error', error => {
  console.error('[SMOKE] Child process error:', error);
  process.exitCode = 1;
});

const errors = [];
const failedRequests = [];
const consoleMessages = [];
let browser = null;
let page = null;

(async () => {
  try {
    log('Waiting for CDP port 9333...');
    for (let attempt = 0; attempt < 90; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:9333/json/version', { signal: AbortSignal.timeout(1000) });
        if (response.ok) {
          log(`CDP port 9333 ready after attempt ${attempt + 1}`);
          break;
        }
      } catch {}
      if (attempt === 89) throw new Error('Portable did not open debugging port within 90 seconds');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log('Connecting over CDP to http://127.0.0.1:9333...');
    browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { timeout: 30000 });
    const context = browser.contexts()[0];

    log('Searching for index.html page...');
    for (let attempt = 0; attempt < 60; attempt++) {
      page = context.pages().find(p => p.url().includes('index.html'));
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(page, 'Game window must load index.html');
    assert(!context.pages().some(p => p.url().startsWith('devtools:')), 'No developer tools at startup');
    log(`Found game page: ${page.url()}`);

    page.on('pageerror', error => {
      log(`Page error: ${error.message}`);
      errors.push(error.message);
    });
    page.on('console', message => {
      consoleMessages.push({ type: message.type(), text: message.text() });
    });
    page.on('requestfailed', request => {
      failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
    });

    await page.bringToFront();

    // Pull any early logs or errors captured in head script
    const earlyData = await safeEval(page, () => ({
      logs: window.__logs || [],
      errors: window.__errors || []
    }), 5000, { logs: [], errors: [] });

    if (earlyData.logs.length > 0) {
      consoleMessages.unshift(...earlyData.logs);
    }
    if (earlyData.errors.length > 0) {
      errors.push(...earlyData.errors.map(e => e.message || String(e)));
    }

    log('Waiting for #btn-start to be visible...');
    await page.locator('#btn-start').waitFor({ state: 'visible', timeout: 30000 });

    log('Waiting for initial textures...');
    await page.waitForFunction(() => window.state && Object.keys(window.state.textureData).length > 0, null, { polling: 200, timeout: 30000 });

    log('Capturing menu screenshot...');
    await page.screenshot({ path: path.join(out, 'menu.png'), timeout: 10000 }).catch(() => {});

    log('Clicking #btn-start to enter dungeon...');
    await page.locator('#btn-start').click();

    log('Skipping intro screen...');
    // Give history screen a moment to appear, then skip via click or space
    await page.locator('#history-screen').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.locator('#history-screen').click({ timeout: 5000 }).catch(() => page.keyboard.press('Space'));
    await page.keyboard.press('Space');

    log('Waiting for PLAYING state and level map...');
    await page.waitForFunction(() => window.state && window.state.gameState === 'PLAYING' && window.state.map, null, { polling: 200, timeout: 20000 });

    log('Waiting for sound assets to decode...');
    await page.waitForFunction(() => window.audioManager && Object.keys(window.audioManager.sounds).length > 0, null, { polling: 200, timeout: 20000 });

    log('Validating game loop advances...');
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

    log('Capturing gameplay screenshot...');
    await page.screenshot({ path: path.join(out, 'gameplay.png'), timeout: 10000 }).catch(() => {});

    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ state, errors, failedRequests }, null, 2));
    assert.equal(errors.length, 0, 'No uncaught renderer errors');
    assert.equal(failedRequests.filter(r => !r.error?.includes('ERR_ABORTED')).length, 0, 'Game assets must load');

    log(`Portable smoke test passed successfully: ${JSON.stringify(state)}`);
  } catch (error) {
    log(`Portable smoke test failed: ${error.message}`);
    let crashLog = null;
    try {
      const crashFile = path.join(profileDir, 'crash.log');
      if (fs.existsSync(crashFile)) crashLog = fs.readFileSync(crashFile, 'utf8');
    } catch {}

    const diagnostics = page ? await safeEval(page, () => ({
      ready: document.readyState,
      state: window.state?.gameState,
      textures: window.state?.textureData && Object.keys(window.state.textureData),
      images: Array.from(document.images).map(i => ({ src: i.src, width: i.naturalWidth })),
      floors: window.state?.textures?.floors?.map(i => ({ src: i.src, complete: i.complete, width: i.naturalWidth }))
    }), 5000, null) : null;

    if (page) {
      await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 8000 }).catch(() => {});
    }

    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({
      error: error.stack,
      crashLog,
      diagnostics,
      consoleMessages,
      errors,
      failedRequests
    }, null, 2));

    process.exitCode = 1;
    console.error(error);
  } finally {
    log('Cleaning up browser and terminating portable process...');
    if (browser) await browser.close().catch(() => {});
    killProcesses();
    try { fs.closeSync(stdoutFd); } catch {}
    try { fs.closeSync(stderrFd); } catch {}
    log('Cleanup finished.');
    process.exit(process.exitCode || 0);
  }
})();
