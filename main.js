const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        title: "RayCaster V3.2",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        autoHideMenuBar: true
    });

    win.loadFile('index.html');
    win.webContents.openDevTools();

    win.webContents.on('render-process-gone', (event, details) => {
        console.error('CRITICAL: Renderer process gone:', details.reason);
    });

    win.webContents.on('crashed', () => {
        console.error('CRITICAL: Renderer process crashed!');
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
