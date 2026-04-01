const { app, BrowserWindow, ipcMain, globalShortcut, Notification } = require('electron');
const pty = require('node-pty');
const path = require('path');
const os = require('os');

// Force software rendering on WSL2 / systems without GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const MAX_TERMINALS = 16;
const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';

let mainWindow;
const ptys = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

// Output buffers for throttled IPC (keyed by terminal id)
const outputBuffers = {};
const FLUSH_INTERVAL = 16; // ~60fps

function flushOutput(id) {
  if (outputBuffers[id] && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(`pty-output-${id}`, outputBuffers[id]);
    outputBuffers[id] = '';
  }
}

function spawnPty(id, cols, rows) {
  if (ptys[id]) return; // already spawned
  if (outputBuffers[id] === undefined) outputBuffers[id] = '';

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: os.homedir(),
    env: process.env,
  });

  // Throttled output — buffer data and flush at 60fps
  let flushTimer = null;
  ptyProcess.onData((data) => {
    outputBuffers[id] += data;
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushOutput(id);
        flushTimer = null;
      }, FLUSH_INTERVAL);
    }
  });

  ptys[id] = ptyProcess;
}

function setupPtyIPC() {
  for (let id = 0; id < MAX_TERMINALS; id++) {
    ipcMain.on(`pty-input-${id}`, (_event, data) => {
      if (!ptys[id]) spawnPty(id);
      ptys[id].write(data);
    });

    ipcMain.on(`pty-resize-${id}`, (_event, { cols, rows }) => {
      if (!ptys[id]) spawnPty(id, cols, rows);
      else ptys[id].resize(cols, rows);
    });
  }

  // Kill a PTY when a terminal is removed
  ipcMain.on('pty-kill', (_event, id) => {
    if (ptys[id]) {
      ptys[id].kill();
      ptys[id] = null;
    }
  });
}

// Process completion notifications
ipcMain.on('pty-notify', (_event, id) => {
  if (Notification.isSupported()) {
    new Notification({
      title: 'Construct',
      body: 'Command finished in terminal ' + (id + 1),
      silent: true,
    }).show();
  }
});

ipcMain.on('window-minimize', () => { mainWindow.minimize(); });
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) { mainWindow.unmaximize(); }
  else { mainWindow.maximize(); }
});
ipcMain.on('window-close', () => { mainWindow.close(); });

app.whenReady().then(() => {
  createWindow();
  setupPtyIPC();
  spawnPty(0);

  // F12 global hotkey — Quake-style toggle
  globalShortcut.register('F12', () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  ptys.forEach((p) => { if (p) p.kill(); });
  app.quit();
});
