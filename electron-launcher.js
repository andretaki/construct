const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

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
const disableWslD3d12 = cliArgs.includes('--disable-wsl-d3d12') || env.CONSTRUCT_WSL_D3D12 === '0';
const respectGpuBlocklist = cliArgs.includes('--respect-gpu-blocklist') || env.CONSTRUCT_IGNORE_GPU_BLOCKLIST === '0';
const ignoreGpuBlocklist = cliArgs.includes('--ignore-gpu-blocklist') || env.CONSTRUCT_IGNORE_GPU_BLOCKLIST === '1';

if (isWsl && !forceGpuDisable && !disableWslD3d12 && !env.GALLIUM_DRIVER) {
  env.GALLIUM_DRIVER = 'd3d12';
}

const electronArgs = [appDir].concat(cliArgs);
if (isWsl && !forceGpuDisable && !respectGpuBlocklist && !ignoreGpuBlocklist) {
  electronArgs.push('--ignore-gpu-blocklist');
}

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
