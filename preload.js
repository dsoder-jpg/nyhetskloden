// Gir sidene et lite, trygt grensesnitt mot appen.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nk', {
  setNotify: on => ipcRenderer.send('notify', !!on),
  onOpen: cb => ipcRenderer.on('open', (_e, id) => cb(String(id))),
  toggleTicker: () => ipcRenderer.send('ticker'),
  openItem: id => ipcRenderer.send('open-item', String(id)),
});
