// Nyhetskloden – Electron-app (v3)
// Starter nyhetsmotoren (server.js), viser kloden i eget vindu, legger seg i systemstatusfeltet,
// har en ticker-stripe som alltid ligger øverst, varsler om store saker og overvåkede ord,
// og oppdaterer seg selv fra GitHub Releases (se LES-MEG).

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, nativeImage, screen } = require('electron');
const path = require('path');
const engine = require('./server');

app.setAppUserModelId('no.nyhetskloden.app'); // trengs for Windows-varsler
if (!app.requestSingleInstanceLock()) { app.quit(); }

const ICON = path.join(__dirname, 'build', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'build', 'tray.png');
const PREFERRED_PORT = 37851; // fast port, så innstillinger (lagret per adresse) huskes mellom oppstarter
let win = null, ticker = null, tray = null, port = null, quitting = false, hintShown = false;
const base = () => `http://127.0.0.1:${port}`;
const S = () => engine.getSettings();


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
    if (!S().closeToTray) { quitting = true; app.quit(); return; }
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
  const y = S().tickerPos === 'bottom' ? workArea.y + workArea.height - 36 : workArea.y;
  ticker = new BrowserWindow({
    x: workArea.x, y, width: workArea.width, height: 36, frame: false, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#070c14', title: 'Nyhetskloden – ticker', icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  ticker.setAlwaysOnTop(true, 'screen-saver');
  ticker.loadURL(base() + '/ticker.html?speed=' + encodeURIComponent(S().tickerSpeed || 1));
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
    { label: 'Varsler', type: 'checkbox', checked: S().notify, click: i => engine.applySettings({ notify: i.checked }) },
    { label: 'Innstillinger …', click: () => { show(); setTimeout(() => win && win.webContents.send('open-settings'), 400); } },
    { label: 'Start med Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: i => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    pendingUpdate ? { label: `Start på nytt med versjon ${pendingUpdate.ver}`, click: () => applyUpdate(true) } : { label: 'Se etter oppdateringer', click: () => checkUpdates(true) },
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

function quietNow() { const q = S().quiet; if (!q || !q.on) return false; const h = new Date().getHours(); return q.from <= q.to ? h >= q.from && h < q.to : h >= q.from || h < q.to; }
function notify(title, body, id) {
  if (!S().notify || quietNow() || !Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON, silent: !S().sound });
  n.on('click', () => openItem(id));
  n.show();
}
const label = i => i.titleNo || i.title;
engine.events.on('top', all => {
  const mode = S().notifyMode;
  if (mode === 'watch') return;
  const items = mode === 'top' ? all : all.filter(i => (i.top && i.sev >= 2) || i.sev >= 5);
  if (!items.length) return;
  const first = items.sort((a, b) => (b.sev || 0) - (a.sev || 0))[0];
  if (items.length > 1) notify(`${items.length} store saker`, items.slice(0, 3).map(i => '• ' + label(i)).join('\n'), first.eid || first.id);
  else notify(`${first.sev >= 5 ? 'Stor sak' : 'Toppsak'} · ${first.src}`, label(first), first.eid || first.id);
});
engine.events.on('settings', () => buildTrayMenu());
engine.events.on('watch', items => {
  if (!S().notifyWatch) return;
  const first = items[0];
  notify(`Følger: ${[...new Set(items.flatMap(i => i.watch))].slice(0, 3).join(', ')}`,
    items.length > 1 ? items.slice(0, 3).map(i => '• ' + label(i)).join('\n') : label(first), first.eid || first.id);
});

// ---------- oppdateringer ----------
// Ser etter nye versjoner under GitHub Releases i repoet som står i package.json (nyhetskloden.updateRepo).
// Versjonen leses fra filnavnene, så taggen på utgivelsen spiller ingen rolle:
//   nyhetskloden-app-<versjon>-e<electron>.asar  → liten oppdatering (bare appkoden, ca. 3 MB)
//   Nyhetskloden-Setup-<versjon>.exe              → full installasjon (brukes når Electron er byttet ut)
// Oppdateringen lastes ned i bakgrunnen og installeres automatisk når appen lukkes,
// eller med en gang hvis brukeren klikker på varselet.
const fs = require('fs');
const ofs = require('original-fs'); // vanlig fs behandler .asar som mapper; original-fs skriver dem som filer
const crypto = require('crypto');
const { spawn } = require('child_process');
const UPDATE_REPO = (require('./package.json').nyhetskloden || {}).updateRepo;
const ELECTRON_MAJOR = String(process.versions.electron || '').split('.')[0];
const RES = process.resourcesPath;
let pendingUpdate = null, applying = false;
// status som vises i appen: idle | checking | downloading | ready | none | error | off
let upd = { state: 'idle', current: app.getVersion() };
function setUpd(s) { upd = { ...upd, ...s, current: app.getVersion(), at: new Date().toISOString() }; for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update', upd); }
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
function plain(title, body, onClick) { if (!Notification.isSupported()) return; const n = new Notification({ title, body, icon: ICON }); if (onClick) n.on('click', onClick); n.show(); }
const okUrl = u => /^https:\/\/github\.com\//.test(u || '');

async function download(asset) {
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Nyhetskloden' } });
  if (!res.ok) throw new Error('nedlasting HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (asset.size && buf.length !== asset.size) throw new Error('nedlastingen ble ufullstendig');
  if (/^sha256:/.test(asset.digest || '') && crypto.createHash('sha256').update(buf).digest('hex') !== asset.digest.slice(7)) throw new Error('kontrollsummen stemmer ikke');
  return buf;
}

async function checkUpdates(manual) {
  if (!app.isPackaged || !UPDATE_REPO) { setUpd({ state: 'off', msg: 'Oppdatering virker bare i den installerte appen.' }); if (manual === true) plain('Oppdatering er ikke satt opp', 'Se LES-MEG for hvordan du publiserer nye versjoner.'); return; }
  if (upd.state === 'checking' || upd.state === 'downloading') return;
  if (pendingUpdate) { setUpd({ state: 'ready', ver: pendingUpdate.ver }); if (manual === true) plain(`Nyhetskloden ${pendingUpdate.ver} er klar`, 'Den installeres når du lukker appen. Klikk for å starte på nytt nå.', () => applyUpdate(true)); return; }
  setUpd({ state: 'checking', msg: null });
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=10`, { headers: { 'User-Agent': 'Nyhetskloden', Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const assets = (await r.json()).filter(rel => !rel.draft).flatMap(rel => rel.assets || []).filter(a => okUrl(a.browser_download_url));
    let best = null;
    for (const a of assets) {
      let m = a.name.match(/^nyhetskloden-app-(\d+\.\d+\.\d+)-e(\d+)\.asar$/i);
      if (m && m[2] === ELECTRON_MAJOR) { if (!best || cmp(m[1], best.ver) > 0 || (cmp(m[1], best.ver) === 0 && best.kind === 'setup')) best = { ver: m[1], kind: 'asar', asset: a }; continue; }
      m = a.name.match(/^Nyhetskloden-Setup-(\d+\.\d+\.\d+)\.exe$/i);
      if (m && (!best || cmp(m[1], best.ver) > 0)) best = { ver: m[1], kind: 'setup', asset: a };
    }
    if (!best || cmp(best.ver, app.getVersion()) <= 0) { setUpd({ state: 'none', ver: null }); if (manual === true) plain('Ingen oppdatering', `Du har nyeste versjon (${app.getVersion()}).`); return; }
    setUpd({ state: 'downloading', ver: best.ver, size: best.asset.size, kind: best.kind });
    const buf = await download(best.asset);
    if (best.kind === 'asar') { const file = path.join(RES, 'app.asar.new'); ofs.writeFileSync(file, buf); pendingUpdate = { ...best, file }; }
    else { const file = path.join(app.getPath('temp'), best.asset.name); fs.writeFileSync(file, buf); pendingUpdate = { ...best, file }; }
    buildTrayMenu();
    setUpd({ state: 'ready', ver: best.ver, kind: best.kind });
    plain(`Nyhetskloden ${best.ver} er klar`, 'Den installeres automatisk når du lukker appen. Klikk her for å starte på nytt med en gang.', () => applyUpdate(true));
  } catch (e) { setUpd({ state: 'error', msg: String(e.message || e).slice(0, 160) }); if (manual === true) plain('Kunne ikke se etter oppdateringer', String(e.message || e).slice(0, 120)); }
}

// Bytter inn den nye versjonen etter at appen har lukket seg. restart = start appen igjen etterpå.
function applyUpdate(restart) {
  if (!pendingUpdate || applying) return;
  applying = true;
  const exe = process.execPath;
  if (pendingUpdate.kind === 'asar') {
    const target = path.join(RES, 'app.asar');
    // venter til appen har sluppet filen, bytter den ut (prøver i opptil ~30 s), og starter appen igjen om ønsket
    const done = restart ? `(start "" "${exe}" & exit)` : 'exit';
    const script = `for /l %i in (1,1,15) do @(ping -n 3 127.0.0.1 >nul & move /y "${pendingUpdate.file}" "${target}" >nul 2>&1 && ${done})`;
    // samme måte som Node selv starter cmd (shell: true): /s /c "…" med uendrede argumenter, ellers ødelegges anførselstegnene
    spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${script}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  } else {
    spawn(pendingUpdate.file, restart ? ['/S'] : ['/S', '/norun'], { detached: true, stdio: 'ignore' }).unref();
  }
  quitting = true; app.quit();
}

ipcMain.on('notify', (_e, on) => { engine.applySettings({ notify: !!on }); });
ipcMain.handle('app-info', () => ({ version: app.getVersion(), electron: process.versions.electron, openAtLogin: app.getLoginItemSettings().openAtLogin, dataDir: app.getPath('userData'), packaged: app.isPackaged, ticker: !!ticker }));
ipcMain.on('set-login', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); buildTrayMenu(); });
ipcMain.on('open-data', () => shell.openPath(app.getPath('userData')));
ipcMain.on('ticker-restart', () => { if (ticker) { ticker.close(); setTimeout(toggleTicker, 300); } });
// ---------- daglig oppsummering ----------
let digestDay = '';
setInterval(() => {
  const s = S(); if (!s.digest || !s.notify) return;
  const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), day = now.toDateString();
  if (hm !== s.digestTime || digestDay === day) return;
  digestDay = day;
  const top = engine.topEvents();
  if (!top.length || !Notification.isSupported()) return;
  const n = new Notification({ title: 'Døgnets viktigste', body: top.map((e, i) => `${i + 1}. ${e.title}`).join('\n'), icon: ICON, silent: !s.sound });
  n.on('click', () => { show(); setTimeout(() => win && win.webContents.send('open-tab', 'top'), 500); });
  n.show();
}, 30e3);
ipcMain.on('zoom', (e, f) => { const z = Math.max(0.8, Math.min(1.6, +f || 1)); for (const w of BrowserWindow.getAllWindows()) if (w !== ticker) w.webContents.setZoomFactor(z); });
ipcMain.handle('update-state', () => ({ ...upd, current: app.getVersion() }));
ipcMain.on('update-check', () => checkUpdates('ui'));
ipcMain.on('update-apply', () => applyUpdate(true));
ipcMain.on('ticker', () => toggleTicker());
ipcMain.on('open-item', (_e, id) => openItem(String(id)));
app.on('second-instance', show);
app.on('before-quit', () => { quitting = true; if (pendingUpdate && !applying && S().autoInstall) applyUpdate(false); });
app.on('window-all-closed', e => e.preventDefault?.());

app.whenReady().then(async () => {
  const dataDir = app.getPath('userData');
  try { port = await engine.start({ port: PREFERRED_PORT, dataDir }); }
  catch { port = await engine.start({ port: 0, dataDir }); }
  buildTray();
  if (!process.argv.includes('--hidden')) createWindow();
  if (S().tickerAtStart) setTimeout(toggleTicker, 2500);
  setTimeout(() => checkUpdates(false), 15000);
  setInterval(() => checkUpdates(false), 6 * 3600e3);
});
