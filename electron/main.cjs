const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// OPTIMIZATION: Disable Hardware Acceleration to save memory (RAM) and GPU resources.
// This matches the user request to "minimize it for low end pc users".
// For a simple timer app, GPU acceleration is not needed and consumes ~30-50MB extra RAM.
app.disableHardwareAcceleration();

// OPTIMIZATION: Single Instance Lock
// Prevents multiple instances from running, which would double resource usage.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const windows = BrowserWindow.getAllWindows();
        if (windows.length) {
            const win = windows[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    // Create window only if we have the lock
    app.whenReady().then(() => {
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 720,
        height: 720,
        webPreferences: {
            nodeIntegration: false, // OPTIMIZATION: Disable Node.js integration in renderer (saves memory/security)
            contextIsolation: true, // OPTIMIZATION: Enable context isolation (standard, detailed)
            backgroundThrottling: false // IMPORTANT: Prevent timer from slowing down
        },
        autoHideMenuBar: true, // Hide the menu bar for a cleaner look
        frame: true, // Keep standard window frame for now (minimize/close buttons)
        resizable: false, // Fixed size like a widget/Tomighty
        icon: path.join(__dirname, app.isPackaged ? '../dist/icon.png' : '../public/icon.png')
    });

    // In production, load the built html. In dev, load localhost.
    const isDev = !app.isPackaged;

    // Open external links in default browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools(); // Optional: open dev tools in dev mode
    } else {
        // Correctly load the index.html file from the dist directory in production
        // The path needs to be absolute or relative to the executable
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
