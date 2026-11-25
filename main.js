// Nyhetskloden – Electron-app (v3)
// Starter nyhetsmotoren (server.js), viser kloden i eget vindu, legger seg i systemstatusfeltet,
// har en ticker-stripe som alltid ligger øverst, varsler om store saker og overvåkede ord,
// og ser etter nye versjoner på GitHub Releases (se LES-MEG).

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, nativeImage, screen } = require('electron');
const path = require('path');
const engine = require('./server');

app.setAppUserModelId('no.nyhetskloden.app'); // trengs for Windows-varsler
if (!app.requestSingleInstanceLock()) { app.quit(); }

const ICON = path.join(__dirname, 'build', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'build', 'tray.png');
const PREFERRED_PORT = 37851; // fast port, så innstillinger (lagret per adresse) huskes mellom oppstarter
let win = null, ticker = null, tray = null, port = null, quitting = false, notifyOn = true, hintShown = false;
const base = () => `http://127.0.0.1:${port}`;

function show() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}
function openItem(id) { show(); setTimeout(() => win && win.webContents.send('open', id), win && win.webContents.isLoading() ? 1500 : 300); }

function guardLinks(w) {
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(base())) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 900, minHeight: 600,
    title: 'Nyhetskloden', icon: ICON, backgroundColor: '#05080e',
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.loadURL(base() + '/');
  win.once('ready-to-show', () => win.show());
  guardLinks(win);
  win.on('close', e => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (!hintShown && Notification.isSupported()) {
      hintShown = true;
      new Notification({ title: 'Nyhetskloden kjører videre', body: 'Den henter nyheter i bakgrunnen. Høyreklikk globusen ved klokka for å avslutte.', icon: ICON }).show();
    }
  });
  win.on('closed', () => { win = null; });
}

// Ticker: smal stripe øverst på skjermen som alltid ligger over andre vinduer
function toggleTicker() {
  if (ticker) { ticker.close(); return; }
  const { workArea } = screen.getPrimaryDisplay();
  ticker = new BrowserWindow({
    x: workArea.x, y: workArea.y, width: workArea.width, height: 36, frame: false, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#070c14', title: 'Nyhetskloden – ticker', icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  ticker.setAlwaysOnTop(true, 'screen-saver');
  ticker.loadURL(base() + '/ticker.html');
  guardLinks(ticker);
  ticker.on('closed', () => { ticker = null; buildTrayMenu(); });
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Vis Nyhetskloden', click: show },
    { label: ticker ? 'Skjul ticker' : 'Vis ticker', click: toggleTicker },
    { label: 'Hent nyheter nå', click: () => engine.poll() },
    { type: 'separator' },
    { label: 'Varsler', type: 'checkbox', checked: notifyOn, click: i => { notifyOn = i.checked; } },
    { label: 'Start med Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: i => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    pendingUpdate ? { label: `Installer versjon ${pendingUpdate.ver}`, click: installUpdate } : { label: 'Se etter oppdateringer', click: () => checkUpdates(true) },
    { type: 'separator' },
    { label: 'Avslutt', click: () => { quitting = true; app.quit(); } },
  ]));
}
function buildTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('Nyhetskloden');
  buildTrayMenu();
  tray.on('click', show);
}

function notify(title, body, id) {
  if (!notifyOn || !Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  n.on('click', () => openItem(id));
  n.show();
}
const label = i => i.titleNo || i.title;
engine.events.on('top', items => {
  const first = items.sort((a, b) => (b.sev || 0) - (a.sev || 0))[0];
  if (items.length > 1) notify(`${items.length} store saker`, items.slice(0, 3).map(i => '• ' + label(i)).join('\n'), first.eid || first.id);
  else notify(`Stor sak · ${first.src}`, label(first), first.eid || first.id);
});
engine.events.on('watch', items => {
  const first = items[0];
  notify(`Følger: ${[...new Set(items.flatMap(i => i.watch))].slice(0, 3).join(', ')}`,
    items.length > 1 ? items.slice(0, 3).map(i => '• ' + label(i)).join('\n') : label(first), first.eid || first.id);
});

// ---------- oppdateringer ----------
// Ser etter ny versjon under GitHub Releases i repoet som står i package.json (nyhetskloden.updateRepo).
// Finnes en nyere «Nyhetskloden-Setup-x.y.z.exe», lastes den ned og kan installeres med ett klikk.
const fs = require('fs');
const { spawn } = require('child_process');
const UPDATE_REPO = (require('./package.json').nyhetskloden || {}).updateRepo;
let pendingUpdate = null;
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function plain(title, body, onClick) { if (!Notification.isSupported()) return; const n = new Notification({ title, body, icon: ICON }); if (onClick) n.on('click', onClick); n.show(); }
async function checkUpdates(manual) {
  if (!app.isPackaged || !UPDATE_REPO) { if (manual) plain('Oppdatering er ikke satt opp', 'Se LES-MEG for hvordan du publiserer nye versjoner.'); return; }
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { 'User-Agent': 'Nyhetskloden', Accept: 'application/vnd.github+json' } });
    if (r.status === 404) { if (manual) plain('Ingen oppdateringer publisert ennå', `Fant ingen utgivelser i ${UPDATE_REPO}.`); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rel = await r.json(), ver = String(rel.tag_name || '').replace(/^v/i, '');
    if (!newer(ver, app.getVersion())) { if (manual) plain('Ingen oppdatering', `Du har nyeste versjon (${app.getVersion()}).`); return; }
    const asset = (rel.assets || []).find(a => /^Nyhetskloden-Setup-.*\.exe$/i.test(a.name) && /^https:\/\/github\.com\//.test(a.browser_download_url));
    if (!asset) return;
    const file = path.join(app.getPath('temp'), asset.name);
    if (!fs.existsSync(file) || fs.statSync(file).size !== asset.size) {
      const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Nyhetskloden' } });
      if (!res.ok) throw new Error('nedlasting HTTP ' + res.status);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    pendingUpdate = { file, ver };
    buildTrayMenu();
    plain(`Nyhetskloden ${ver} er klar`, 'Klikk her for å installere nå. Du finner det også i menyen ved klokka.', installUpdate);
  } catch (e) { if (manual) plain('Kunne ikke se etter oppdateringer', String(e.message || e).slice(0, 120)); }
}
function installUpdate() {
  if (!pendingUpdate) return;
  spawn(pendingUpdate.file, ['/S'], { detached: true, stdio: 'ignore' }).unref(); // installerer stille og starter appen igjen
  quitting = true; app.quit();
}

ipcMain.on('notify', (_e, on) => { notifyOn = !!on; buildTrayMenu(); });
ipcMain.on('ticker', () => toggleTicker());
ipcMain.on('open-item', (_e, id) => openItem(String(id)));
app.on('second-instance', show);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', e => e.preventDefault?.());

app.whenReady().then(async () => {
  const dataDir = app.getPath('userData');
  try { port = await engine.start({ port: PREFERRED_PORT, dataDir }); }
  catch { port = await engine.start({ port: 0, dataDir }); }
  buildTray();
  if (!process.argv.includes('--hidden')) createWindow();
  setTimeout(() => checkUpdates(false), 15000);
  setInterval(() => checkUpdates(false), 6 * 3600e3);
});
