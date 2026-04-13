const { app, BrowserWindow, ipcMain, globalShortcut, Notification } = require('electron');
const fs = require('fs');
const pty = require('node-pty');
const path = require('path');
const os = require('os');

const MAX_TERMINALS = 16;
const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
const cliArgs = new Set(process.argv.slice(1));
const benchmarkMode = cliArgs.has('--benchmark') || process.env.CONSTRUCT_BENCHMARK === '1';
const benchmarkOutputDir = path.join(process.cwd(), '.construct-benchmarks');
const isWsl = process.platform === 'linux' && (
  Boolean(process.env.WSL_DISTRO_NAME) ||
  Boolean(process.env.WSL_INTEROP) ||
  /microsoft/i.test(os.release())
);
const forceGpuDisable = cliArgs.has('--disable-gpu') || process.env.CONSTRUCT_DISABLE_GPU === '1';
const forceGpuEnable = !forceGpuDisable && (
  cliArgs.has('--force-gpu') || process.env.CONSTRUCT_FORCE_GPU === '1'
);
const disableWslD3d12 = cliArgs.has('--disable-wsl-d3d12') || process.env.CONSTRUCT_WSL_D3D12 === '0';
const respectGpuBlocklist = cliArgs.has('--respect-gpu-blocklist') || process.env.CONSTRUCT_IGNORE_GPU_BLOCKLIST === '0';
const autoWslGpu = isWsl && !forceGpuDisable && !disableWslD3d12;
const shouldSetWslGalliumDriver = autoWslGpu && !process.env.GALLIUM_DRIVER;
const shouldIgnoreGpuBlocklist = !forceGpuDisable && (
  cliArgs.has('--ignore-gpu-blocklist') ||
  process.env.CONSTRUCT_IGNORE_GPU_BLOCKLIST === '1' ||
  (autoWslGpu && !respectGpuBlocklist)
);
const gpuDisabled = forceGpuDisable;
const gpuMode = forceGpuDisable
  ? 'disabled-explicit'
  : forceGpuEnable
    ? 'enabled-explicit'
    : autoWslGpu
      ? 'enabled-wsl-auto'
      : 'enabled-default';

let mainWindow;
let preMaximizeBounds = null;
const ptys = [];

if (shouldSetWslGalliumDriver) {
  process.env.GALLIUM_DRIVER = 'd3d12';
}

if (gpuDisabled) {
  app.disableHardwareAcceleration();
}

if (shouldIgnoreGpuBlocklist) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: !isWsl,
    backgroundColor: isWsl ? '#1e1e2e' : '#00000000',
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flushSyntheticOutput(id, data) {
  if (!data || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(`pty-output-${id}`, data);
}

function buildHeavyOutputChunk(id, startLine, endLine, lineWidth) {
  let chunk = '';
  for (let line = startLine; line < endLine; line++) {
    const prefix = 'pane ' + (id + 1) + ' line ' + String(line).padStart(6, '0') + ' ';
    const fillWidth = Math.max(8, lineWidth - prefix.length);
    chunk += prefix + 'x'.repeat(fillWidth) + '\r\n';
  }
  return chunk;
}

function buildTuiFrame(id, frame, totalFrames, rows, width) {
  let chunk = '\x1b[?25l\x1b[2J\x1b[H';
  chunk += 'Construct synthetic TUI benchmark\r\n';
  chunk += 'pane ' + (id + 1) + '  frame ' + (frame + 1) + '/' + totalFrames + '\r\n\r\n';

  for (let row = 0; row < rows; row++) {
    const progress = (frame * 3 + row * 7) % width;
    const meter = '#'.repeat(progress + 1).padEnd(width, '.');
    chunk += 'row ' + String(row + 1).padStart(2, '0') + ' [' + meter + ']\r\n';
  }

  chunk += '\r\n';
  chunk += 'alt-screen style repaint workload';
  return chunk;
}

async function runHeavyOutputScenario(ids, options) {
  const lineCount = options.lineCount || 4000;
  const lineWidth = options.lineWidth || 120;
  const batchSize = options.batchSize || 80;

  ids.forEach((id) => flushSyntheticOutput(id, '\x1bc\x1b[?25l'));

  for (let startLine = 0; startLine < lineCount; startLine += batchSize) {
    const endLine = Math.min(startLine + batchSize, lineCount);
    ids.forEach((id) => {
      flushSyntheticOutput(id, buildHeavyOutputChunk(id, startLine, endLine, lineWidth));
    });
    await sleep(0);
  }

  ids.forEach((id) => flushSyntheticOutput(id, '\x1b[?25h'));
}

async function runTuiScenario(ids, options) {
  const frameCount = options.frameCount || 120;
  const frameDelayMs = options.frameDelayMs || 16;
  const rowCount = options.rowCount || 14;
  const rowWidth = options.rowWidth || 36;

  for (let frame = 0; frame < frameCount; frame++) {
    ids.forEach((id) => {
      flushSyntheticOutput(id, buildTuiFrame(id, frame, frameCount, rowCount, rowWidth));
    });
    await sleep(frameDelayMs);
  }

  ids.forEach((id) => flushSyntheticOutput(id, '\x1b[?25h\r\n'));
}

async function runBenchmarkScenario(ids, scenario, options) {
  if (!Array.isArray(ids) || ids.length === 0) return;

  if (scenario === 'heavy-output') {
    await runHeavyOutputScenario(ids, options);
    return;
  }

  if (scenario === 'tui') {
    await runTuiScenario(ids, options);
  }
}

function setupPtyIPC() {
  for (let id = 0; id < MAX_TERMINALS; id++) {
    ipcMain.on(`pty-input-${id}`, (_event, data) => {
      if (!ptys[id]) spawnPty(id);
      ptys[id].write(data);
    });

    ipcMain.on(`pty-resize-${id}`, (_event, { cols, rows }) => {
      if (benchmarkMode && !ptys[id]) return;
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
  const { screen } = require('electron');
  if (preMaximizeBounds) {
    // Restore to pre-maximize bounds
    mainWindow.setBounds(preMaximizeBounds);
    preMaximizeBounds = null;
  } else {
    // Save current bounds, then fill the work area
    preMaximizeBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(preMaximizeBounds);
    mainWindow.setBounds(display.workArea);
  }
});
ipcMain.on('window-close', () => { mainWindow.close(); });

ipcMain.handle('app-get-runtime-info', async () => {
  let gpuFeatureStatus = null;
  let gpuInfo = null;

  try {
    gpuFeatureStatus = app.getGPUFeatureStatus();
  } catch (_error) {
    gpuFeatureStatus = null;
  }

  try {
    gpuInfo = await app.getGPUInfo('basic');
  } catch (_error) {
    gpuInfo = null;
  }

  return {
    benchmarkMode,
    benchmarkOutputDir,
    gpuDisabled,
    gpuFeatureStatus,
    gpuInfo,
    gpuMode,
    gpuBlocklistIgnored: shouldIgnoreGpuBlocklist,
    isWsl,
    galliumDriver: process.env.GALLIUM_DRIVER || null,
    platform: process.platform,
    arch: process.arch,
    shell,
    versions: {
      chrome: process.versions.chrome,
      electron: process.versions.electron,
      node: process.versions.node,
    },
  };
});

ipcMain.handle('window-set-bounds', (_event, bounds) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const currentBounds = mainWindow.getBounds();
  const nextBounds = {
    x: currentBounds.x,
    y: currentBounds.y,
    width: bounds && typeof bounds.width === 'number' ? bounds.width : currentBounds.width,
    height: bounds && typeof bounds.height === 'number' ? bounds.height : currentBounds.height,
  };

  mainWindow.setBounds(nextBounds);
  return mainWindow.getBounds();
});

ipcMain.handle('benchmark-run-scenario', async (_event, payload) => {
  const ids = payload && Array.isArray(payload.ids) ? payload.ids : [];
  const scenario = payload && payload.scenario ? payload.scenario : '';
  const options = payload && payload.options ? payload.options : {};

  await runBenchmarkScenario(ids, scenario, options);
  return true;
});

ipcMain.handle('benchmark-save-report', async (_event, report) => {
  fs.mkdirSync(benchmarkOutputDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(benchmarkOutputDir, 'construct-benchmark-' + stamp + '.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  return reportPath;
});

app.whenReady().then(() => {
  createWindow();
  setupPtyIPC();
  if (!benchmarkMode) {
    spawnPty(0);
  }

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
