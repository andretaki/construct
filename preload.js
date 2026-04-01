const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  setBounds: (bounds) => ipcRenderer.invoke('window-set-bounds', bounds),
});

contextBridge.exposeInMainWorld('terminalAPI', {
  send: (id, data) => {
    ipcRenderer.send(`pty-input-${id}`, data);
  },
  onData: (id, callback) => {
    ipcRenderer.on(`pty-output-${id}`, (_event, data) => callback(data));
  },
  offData: (id) => {
    ipcRenderer.removeAllListeners(`pty-output-${id}`);
  },
  resize: (id, cols, rows) => {
    ipcRenderer.send(`pty-resize-${id}`, { cols, rows });
  },
  notify: (id) => {
    ipcRenderer.send('pty-notify', id);
  },
  killPty: (id) => {
    ipcRenderer.send('pty-kill', id);
  },
});

contextBridge.exposeInMainWorld('appAPI', {
  getRuntimeInfo: () => ipcRenderer.invoke('app-get-runtime-info'),
  runBenchmarkScenario: (payload) => ipcRenderer.invoke('benchmark-run-scenario', payload),
  saveBenchmarkReport: (report) => ipcRenderer.invoke('benchmark-save-report', report),
});
