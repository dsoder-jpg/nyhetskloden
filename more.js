// Flere datakilder: ShakeMap (USGS), skogbranner (NASA FIRMS), nordlys (NOAA), styringsrente (Norges Bank),
// strømpriser for i morgen (hvakosterstrommen.no) og utbytte (Yahoo Finance). Alle er gratis og uten nøkkel.
'use strict';

let UA = 'Nyhetskloden';
const setUA = u => { UA = u; };
async function get(url, type = 'json', ms = 20000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return type === 'json' ? r.json() : r.text();
}
const cache = new Map();
async function cached(key, minutes, fn) {
  const h = cache.get(key); if (h && Date.now() - h.at < minutes * 60e3) return h.data;
  const data = await fn(); cache.set(key, { at: Date.now(), data }); return data;
}

// ---------- ShakeMap: hvor kraftig det ristet rundt et jordskjelv ----------
async function getShakemap(link) {
  const id = (String(link).match(/eventpage\/([a-z0-9]+)/i) || [])[1];
  if (!id) throw new Error('ukjent skjelv');
  return cached('sm:' + id, 30, async () => {
    const d = await get(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${id}.geojson`);
    const sm = (((d.properties || {}).products || {}).shakemap || [])[0];
    if (!sm) return { id, none: true, type: 'FeatureCollection', features: [] };
    const c = sm.contents || {}, file = c['download/cont_mmi.json'] || c['download/cont_mi.json'];
    if (!file || !/^https:\/\//.test(file.url)) return { id, none: true, type: 'FeatureCollection', features: [] };
    const g = await get(file.url);
    const features = (g.features || []).filter(f => f.geometry && /LineString/.test(f.geometry.type)).map(f => ({ type: 'Feature', geometry: f.geometry, properties: { mmi: +((f.properties || {}).value ?? (f.properties || {}).mmi ?? 0) } }));
    return { id, type: 'FeatureCollection', features };
  });
}

// ---------- skogbranner siste døgn fra satellitt (NASA FIRMS, MODIS) ----------
// Fila er stor, så punktene slås sammen til ruter på 0,5 grader.
async function getFires() {
  return cached('fires', 60, async () => {
    const csv = await get('https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv', 'text', 60000);
    const lines = csv.split('\n'), head = lines[0].split(','), I = k => head.indexOf(k);
    const iLat = I('latitude'), iLon = I('longitude'), iConf = I('confidence'), iFrp = I('frp');
    if (iLat < 0 || iLon < 0) throw new Error('ukjent format');
    const grid = new Map();
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(','); if (c.length < head.length) continue;
      if (iConf >= 0 && +c[iConf] < 50) continue;
      const lat = Math.round(+c[iLat] * 2) / 2, lon = Math.round(+c[iLon] * 2) / 2, k = lat + ',' + lon;
      const g = grid.get(k) || { lat, lon, n: 0, frp: 0 }; g.n++; g.frp += +c[iFrp] || 0; grid.set(k, g);
    }
    const pts = [...grid.values()].filter(g => g.n >= 2 || g.frp > 50).map(g => [g.lon, g.lat, g.n, Math.round(g.frp)]);
    return { at: new Date().toISOString(), pts };
  });
}

// ---------- nordlys (NOAA SWPC) ----------
async function getAuroraGrid() {
  return cached('ovation', 15, async () => {
    const d = await get('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', 'json', 30000);
    return { time: d['Forecast Time'] || d['Observation Time'] || null, pts: (d.coordinates || []).filter(c => c[2] >= 3 && Math.abs(c[1]) >= 40) };
  });
}
async function getKp() {
  return cached('kp', 60, async () => {
    const d = await get('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
    const rows = Array.isArray(d[0]) ? d.slice(1).map(r => ({ t: r[0], kp: +r[1], kind: r[2] })) : d.map(r => ({ t: r.time_tag, kp: +r.kp, kind: r.observed }));
    return rows.filter(r => isFinite(r.kp));
  });
}
// sjansen for å se nordlys der du bor: høyeste verdi i ovalen nord for deg (nordlys kan sees et stykke unna)
async function getAurora(home, withGrid) {
  const g = await getAuroraGrid();
  let kp = []; try { kp = await getKp(); } catch {}
  let chance = null;
  if (home && isFinite(home.lat)) {
    const lon = ((home.lon % 360) + 360) % 360;
    let best = 0;
    for (const [x, y, v] of g.pts) {
      const dx = Math.min(Math.abs(x - lon), 360 - Math.abs(x - lon));
      if (dx <= 12 && y >= home.lat - 1 && y <= home.lat + 6) best = Math.max(best, v);
    }
    chance = best;
  }
  const now = Date.now(), next = kp.filter(r => Date.parse(r.t.replace(' ', 'T') + (r.t.endsWith('Z') ? '' : 'Z')) >= now - 3 * 3600e3).slice(0, 8);
  const level = chance == null ? null : chance >= 50 ? 'høy' : chance >= 20 ? 'middels' : chance >= 8 ? 'lav' : 'svært lav';
  return { time: g.time, chance, level, kpMax: next.length ? Math.max(...next.map(r => r.kp)) : null, kp: next, ...(withGrid ? { pts: g.pts } : {}) };
}

// ---------- styringsrenten (Norges Bank) ----------
async function getPolicyRate() {
  return cached('rate', 6 * 60, async () => {
    const start = new Date(Date.now() - 6 * 365 * 864e5).toISOString().slice(0, 10);
    const txt = await get(`https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=csv&startPeriod=${start}&locale=en`, 'text');
    const lines = txt.trim().split(/\r?\n/), sep = lines[0].includes(';') ? ';' : ',';
    const head = lines[0].split(sep).map(h => h.replace(/"/g, '').trim()), it = head.indexOf('TIME_PERIOD'), iv = head.indexOf('OBS_VALUE');
    if (it < 0 || iv < 0) throw new Error('ukjent format');
    const pts = lines.slice(1).map(l => l.split(sep).map(c => c.replace(/"/g, ''))).map(c => [c[it], +c[iv]]).filter(p => /^\d{4}-\d\d-\d\d$/.test(p[0]) && isFinite(p[1]));
    // bare dagene renten endret seg, pluss siste dag
    const ch = pts.filter((p, i) => i === 0 || p[1] !== pts[i - 1][1]); if (pts.length && ch[ch.length - 1] !== pts[pts.length - 1]) ch.push(pts[pts.length - 1]);
    return { rate: pts.length ? pts[pts.length - 1][1] : null, since: ch.length > 1 ? ch[ch.length - 2][0] : null, changes: ch };
  });
}

// ---------- strømpris for en dag i et prisområde ----------
const POWER_ZONES = { NO1: 'Øst', NO2: 'Sør', NO3: 'Midt', NO4: 'Nord', NO5: 'Vest' };
// grovt prisområde fra koordinater (kan overstyres i innstillingene)
function zoneFor(home) {
  if (!home || !isFinite(home.lat)) return null;
  const { lat, lon } = home;
  if (lat >= 65) return 'NO4';
  if (lat >= 62) return 'NO3';
  if (lat >= 59.5 && lon < 7.6) return 'NO5';
  if (lat < 60 && lon < 9.95) return 'NO2';
  return 'NO1';
}
async function getPowerDay(zone, day) {
  return cached('p:' + zone + day, 60, async () => {
    const [y, m, d] = day.split('-');
    const arr = await get(`https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${d}_${zone}.json`);
    return arr.map(p => ({ t: p.time_start, end: p.time_end, kr: p.NOK_per_kWh }));
  });
}
// billigste sammenhengende periode på tre timer, og dyreste time
function powerSummary(hours) {
  if (!hours.length) return null;
  const byH = [];
  for (const h of hours) { const k = new Date(h.t).getTime(); const last = byH[byH.length - 1]; if (last && k - last.k < 3600e3) { last.sum += h.kr; last.n++; } else byH.push({ k, t: h.t, sum: h.kr, n: 1 }); }
  const hr = byH.map(h => ({ t: h.t, kr: h.sum / h.n }));
  let best = null;
  for (let i = 0; i + 2 < hr.length; i++) { const avg = (hr[i].kr + hr[i + 1].kr + hr[i + 2].kr) / 3; if (!best || avg < best.avg) best = { from: hr[i].t, avg }; }
  const max = hr.reduce((a, b) => b.kr > a.kr ? b : a, hr[0]), avg = hr.reduce((a, b) => a + b.kr, 0) / hr.length;
  return { cheap: best, dear: max, avg };
}

// ---------- utbytte (Yahoo Finance) ----------
async function getDivs(sym) {
  return cached('div:' + sym, 12 * 60, async () => {
    const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10y&interval=1mo&events=div`);
    const r = (((d || {}).chart || {}).result || [])[0] || {}, m = r.meta || {};
    const divs = Object.values(((r.events || {}).dividends) || {}).map(x => ({ date: new Date(x.date * 1000).toISOString().slice(0, 10), amount: +x.amount })).filter(x => x.amount > 0).sort((a, b) => a.date.localeCompare(b.date));
    return { sym, name: m.longName || m.shortName || sym, cur: m.currency || '', divs };
  });
}

module.exports = { setUA, getShakemap, getFires, getAurora, getPolicyRate, getPowerDay, powerSummary, zoneFor, POWER_ZONES, getDivs };
