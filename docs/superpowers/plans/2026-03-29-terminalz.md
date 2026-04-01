# Terminalz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that displays 6 real terminal emulators in a fixed 3x2 CSS grid.

**Architecture:** Two-process Electron app. Main process spawns 6 node-pty shell instances and bridges them over IPC. Renderer process creates 6 xterm.js terminals in a CSS Grid, each connected to its PTY via namespaced IPC channels through a secure preload bridge.

**Tech Stack:** Electron, xterm.js, xterm-addon-fit, node-pty

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, electron start script |
| `main.js` | BrowserWindow creation, PTY lifecycle, IPC handlers |
| `preload.js` | contextBridge API exposing send/onData/resize per terminal ID |
| `index.html` | Document shell with CSS Grid container and 6 terminal divs |
| `styles.css` | Grid layout (3×2), terminal cell sizing, dark theme |
| `renderer.js` | xterm.js instantiation, fit addon, IPC wiring, resize observer |

---

### Task 1: Project scaffold and dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Initialize npm project**

Run: `cd /home/andre/terminalz && npm init -y`

- [ ] **Step 2: Install dependencies**

Run: `npm install electron xterm xterm-addon-fit node-pty`

- [ ] **Step 3: Update package.json with start script**

Replace the `"scripts"` section in `package.json`:

```json
{
  "scripts": {
    "start": "electron ."
  },
  "main": "main.js"
}
```

- [ ] **Step 4: Initialize git and commit**

```bash
git init
echo "node_modules/" > .gitignore
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold project with electron, xterm, node-pty"
```

---

### Task 2: Electron main process with PTY management

**Files:**
- Create: `main.js`

- [ ] **Step 1: Create main.js with BrowserWindow setup**

```javascript
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
```

- [ ] **Step 2: Verify file created**

Run: `head -5 /home/andre/terminalz/main.js`
Expected: Shows the require statements.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: electron main process with 6 PTY instances and IPC"
```

---

### Task 3: Preload script with secure IPC bridge

**Files:**
- Create: `preload.js`

- [ ] **Step 1: Create preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('terminalAPI', {
  send: (id, data) => {
    ipcRenderer.send(`pty-input-${id}`, data);
  },
  onData: (id, callback) => {
    ipcRenderer.on(`pty-output-${id}`, (_event, data) => callback(data));
  },
  resize: (id, cols, rows) => {
    ipcRenderer.send(`pty-resize-${id}`, { cols, rows });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add preload.js
git commit -m "feat: preload bridge exposing terminalAPI to renderer"
```

---

### Task 4: HTML shell with CSS Grid layout

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Terminalz</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="node_modules/xterm/css/xterm.css">
</head>
<body>
  <div id="grid">
    <div class="terminal-cell" id="terminal-0"></div>
    <div class="terminal-cell" id="terminal-1"></div>
    <div class="terminal-cell" id="terminal-2"></div>
    <div class="terminal-cell" id="terminal-3"></div>
    <div class="terminal-cell" id="terminal-4"></div>
    <div class="terminal-cell" id="terminal-5"></div>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create styles.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: #1e1e1e;
}

#grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  height: 100vh;
  gap: 1px;
  background: #333;
}

.terminal-cell {
  background: #000;
  overflow: hidden;
}
```

- [ ] **Step 3: Verify layout visually**

Run: `npx electron .`
Expected: Window opens with 6 black cells in a 3×2 grid separated by 1px grey lines. No terminal content yet (renderer.js doesn't exist). Close the window.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: HTML shell and CSS Grid layout for 3x2 terminal grid"
```

---

### Task 5: Renderer — xterm.js instances wired to IPC

**Files:**
- Create: `renderer.js`

- [ ] **Step 1: Create renderer.js**

```javascript
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

const TERMINAL_COUNT = 6;
const terminals = [];
const fitAddons = [];

for (let id = 0; id < TERMINAL_COUNT; id++) {
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'monospace',
    theme: {
      background: '#000000',
      foreground: '#cccccc',
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const container = document.getElementById(`terminal-${id}`);
  term.open(container);
  fitAddon.fit();

  term.onData((data) => {
    window.terminalAPI.send(id, data);
  });

  window.terminalAPI.onData(id, (data) => {
    term.write(data);
  });

  const { cols, rows } = term;
  window.terminalAPI.resize(id, cols, rows);

  terminals.push(term);
  fitAddons.push(fitAddon);
}

window.addEventListener('resize', () => {
  fitAddons.forEach((fitAddon, id) => {
    fitAddon.fit();
    const { cols, rows } = terminals[id];
    window.terminalAPI.resize(id, cols, rows);
  });
});
```

- [ ] **Step 2: Run the app end-to-end**

Run: `npx electron .`
Expected: Window opens with 6 working terminal emulators in a 3×2 grid. Each terminal shows a shell prompt. You can type commands in any terminal independently. Resize the window and all terminals refit.

- [ ] **Step 3: Commit**

```bash
git add renderer.js
git commit -m "feat: renderer with 6 xterm.js instances wired to PTY via IPC"
```

---

### Task 6: Fix renderer module loading for Electron renderer process

**Files:**
- Modify: `index.html`

**Why this task exists:** xterm.js and xterm-addon-fit are CommonJS modules. In an Electron renderer with `contextIsolation: true` and `nodeIntegration: false`, `require()` is not available. We need to load xterm via script tags pointing to the UMD/browser builds.

- [ ] **Step 1: Update index.html to use script tags for xterm**

Replace the `<script src="renderer.js">` line and add xterm script tags before it:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Terminalz</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="node_modules/xterm/css/xterm.css">
</head>
<body>
  <div id="grid">
    <div class="terminal-cell" id="terminal-0"></div>
    <div class="terminal-cell" id="terminal-1"></div>
    <div class="terminal-cell" id="terminal-2"></div>
    <div class="terminal-cell" id="terminal-3"></div>
    <div class="terminal-cell" id="terminal-4"></div>
    <div class="terminal-cell" id="terminal-5"></div>
  </div>
  <script src="node_modules/xterm/lib/xterm.js"></script>
  <script src="node_modules/xterm-addon-fit/lib/xterm-addon-fit.js"></script>
  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update renderer.js to use globals instead of require**

Remove the `require` lines at the top. Replace with global references:

```javascript
const { Terminal } = window.exports || { Terminal: window.Terminal };
const { FitAddon } = window.FitAddon || {};

const TERMINAL_COUNT = 6;
const terminals = [];
const fitAddons = [];

for (let id = 0; id < TERMINAL_COUNT; id++) {
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'monospace',
    theme: {
      background: '#000000',
      foreground: '#cccccc',
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const container = document.getElementById(`terminal-${id}`);
  term.open(container);
  fitAddon.fit();

  term.onData((data) => {
    window.terminalAPI.send(id, data);
  });

  window.terminalAPI.onData(id, (data) => {
    term.write(data);
  });

  const { cols, rows } = term;
  window.terminalAPI.resize(id, cols, rows);

  terminals.push(term);
  fitAddons.push(fitAddon);
}

window.addEventListener('resize', () => {
  fitAddons.forEach((fitAddon, id) => {
    fitAddon.fit();
    const { cols, rows } = terminals[id];
    window.terminalAPI.resize(id, cols, rows);
  });
});
```

- [ ] **Step 3: Run and verify**

Run: `npx electron .`
Expected: Same as Task 5 — 6 working terminals. If xterm globals don't resolve, check the browser console (`Ctrl+Shift+I`) for errors and adjust the global references.

- [ ] **Step 4: Commit**

```bash
git add index.html renderer.js
git commit -m "fix: load xterm via script tags for renderer without nodeIntegration"
```

---

### Task 7: Final verification

- [ ] **Step 1: Clean install and run**

```bash
rm -rf node_modules
npm install
npx electron .
```

Expected: App launches. 6 terminals in 3×2 grid. Each has a shell prompt. Can type in each independently. Window resize refits all terminals.

- [ ] **Step 2: Test each terminal independently**

In each of the 6 terminals, run: `echo "terminal works"`
Expected: Each terminal independently executes the command and shows output.

- [ ] **Step 3: Test window resize**

Resize the window by dragging edges. Expected: All 6 terminals refit to new dimensions without overlap or clipping.
