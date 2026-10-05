const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function logCrash(msg) {
    console.error(msg);
    try {
        const p = path.join(app.getPath('userData'), 'crash.log');
        fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`);
    } catch {}
}

if (process.argv.includes('--no-sandbox') || process.env.CI) {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "RayCaster V3.2",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            backgroundThrottling: false
        },
        autoHideMenuBar: true
    });

    win.loadFile(path.join(__dirname, 'index.html'));
    if (!app.isPackaged) win.webContents.openDevTools();

    win.webContents.on('render-process-gone', (event, details) => {
        logCrash(`CRITICAL: Renderer process gone: ${details.reason} (exitCode: ${details.exitCode})`);
    });

    win.webContents.on('crashed', () => {
        logCrash('CRITICAL: Renderer process crashed!');
    });
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

