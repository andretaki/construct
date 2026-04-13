const { spawn } = require('child_process');
const os = require('os');

const electronBinary = require('electron');
const appDir = __dirname;
const cliArgs = process.argv.slice(2);
const env = { ...process.env };

const isWsl = process.platform === 'linux' && (
  Boolean(env.WSL_DISTRO_NAME) ||
  Boolean(env.WSL_INTEROP) ||
  /microsoft/i.test(os.release())
);

const forceGpuDisable = cliArgs.includes('--disable-gpu') || env.CONSTRUCT_DISABLE_GPU === '1';
const forceGpuEnable = cliArgs.includes('--force-gpu') || env.CONSTRUCT_FORCE_GPU === '1';

const electronArgs = [appDir].concat(cliArgs);

if (isWsl) {
  // WSL needs --no-sandbox (Chrome sandbox requires unprivileged user namespaces)
  if (!electronArgs.includes('--no-sandbox')) {
    electronArgs.push('--no-sandbox');
  }

  // WSLg Wayland socket lives at /mnt/wslg/runtime-dir, not $XDG_RUNTIME_DIR.
  // Without this, Electron can't connect to Wayland and falls back to X11,
  // where an XInput2 bug (xinput.cc:2297) crashes Chromium with SIGTRAP.
  // WSLg Wayland socket lives at /mnt/wslg/runtime-dir, not $XDG_RUNTIME_DIR.
  // Without this, Electron can't connect to Wayland and falls back to X11,
  // where an XInput2 bug (xinput.cc:2297) crashes Chromium with SIGTRAP.
  const fs = require('fs');
  const wslgRuntime = '/mnt/wslg/runtime-dir';
  const hasWslg = fs.existsSync(wslgRuntime + '/wayland-0');

  if (hasWslg) {
    env.XDG_RUNTIME_DIR = wslgRuntime;
    electronArgs.push('--ozone-platform=wayland');
    electronArgs.push('--enable-features=WaylandWindowDecorations');
  }

  if (forceGpuEnable) {
    if (!env.GALLIUM_DRIVER) env.GALLIUM_DRIVER = 'd3d12';
    electronArgs.push('--ignore-gpu-blocklist');
  }
}

console.log('[construct] launching electron ...');
console.log('[construct] WSL:', isWsl, '| args:', electronArgs.slice(1).join(' '));

const child = spawn(electronBinary, electronArgs, {
  cwd: appDir,
  env: env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code === null ? 1 : code);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
