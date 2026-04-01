const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});

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
