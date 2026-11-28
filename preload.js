// Gir sidene et lite, trygt grensesnitt mot appen.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nk', {
  setNotify: on => ipcRenderer.send('notify', !!on),
  onOpen: cb => ipcRenderer.on('open', (_e, id) => cb(String(id))),
  toggleTicker: () => ipcRenderer.send('ticker'),
  openItem: id => ipcRenderer.send('open-item', String(id)),
  updateState: () => ipcRenderer.invoke('update-state'),
  checkUpdates: () => ipcRenderer.send('update-check'),
  applyUpdate: () => ipcRenderer.send('update-apply'),
  onUpdate: cb => ipcRenderer.on('update', (_e, s) => cb(s)),
  appInfo: () => ipcRenderer.invoke('app-info'),
  setLogin: on => ipcRenderer.send('set-login', !!on),
  openData: () => ipcRenderer.send('open-data'),
  restartTicker: () => ipcRenderer.send('ticker-restart'),
  onOpenSettings: cb => ipcRenderer.on('open-settings', () => cb()),
  onOpenTab: cb => ipcRenderer.on('open-tab', (_e, t) => cb(String(t))),
  setZoom: f => ipcRenderer.send('zoom', +f),
  widget: on => ipcRenderer.send('widget', on === 'close' ? 'close' : !!on),
  widgetTop: on => ipcRenderer.send('widget-top', !!on),
  savePng: (dataUrl, name) => ipcRenderer.invoke('save-png', String(dataUrl), String(name || '')),
  savePdf: (html, name) => ipcRenderer.invoke('save-pdf', String(html), String(name || '')),
  saveText: (text, name, kind) => ipcRenderer.invoke('save-text', String(text), String(name || ''), String(kind || '')),
  copyText: text => ipcRenderer.invoke('copy-text', String(text)),
  diag: () => ipcRenderer.invoke('diag'),
  onChime: cb => ipcRenderer.on('chime', (_e, kind) => cb(String(kind))),
});
