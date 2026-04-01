const { app, BrowserWindow, ipcMain } = require('electron');
const pty = require('node-pty');
const path = require('path');
const os = require('os');

const TERMINAL_COUNT = 6;
const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';

let mainWindow;
const ptys = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
}

function createPtys() {
  for (let id = 0; id < TERMINAL_COUNT; id++) {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env,
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`pty-output-${id}`, data);
      }
    });

    ipcMain.on(`pty-input-${id}`, (_event, data) => {
      ptyProcess.write(data);
    });

    ipcMain.on(`pty-resize-${id}`, (_event, { cols, rows }) => {
      ptyProcess.resize(cols, rows);
    });

    ptys.push(ptyProcess);
  }
}

app.whenReady().then(() => {
  createWindow();
  createPtys();
});

app.on('window-all-closed', () => {
  ptys.forEach((p) => p.kill());
  app.quit();
});
