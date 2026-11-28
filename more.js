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

// ---------- luftkvalitet (MET, varsel per time) ----------
const AQ_CITIES = [['Oslo', 59.913, 10.739], ['Bergen', 60.392, 5.324], ['Trondheim', 63.43, 10.395], ['Stavanger', 58.97, 5.733], ['Drammen', 59.744, 10.204], ['Fredrikstad', 59.218, 10.929],
  ['Kristiansand', 58.146, 7.996], ['Tromsø', 69.649, 18.955], ['Skien', 59.209, 9.609], ['Bodø', 67.28, 14.405], ['Ålesund', 62.472, 6.149], ['Lillehammer', 61.115, 10.466], ['Hamar', 60.795, 11.068], ['Mo i Rana', 66.313, 14.143], ['Narvik', 68.438, 17.427], ['Tønsberg', 59.267, 10.408], ['Sarpsborg', 59.284, 11.11], ['Gjøvik', 60.795, 10.692]];
async function getAirQuality(home) {
  const list = [...AQ_CITIES]; if (home && isFinite(home.lat) && !list.some(c => Math.abs(c[1] - home.lat) < .05 && Math.abs(c[2] - home.lon) < .05)) list.push([home.name || 'Hjemme', home.lat, home.lon]);
  return cached('aq:' + list.length + (home ? home.lat : ''), 60, async () => {
    const out = [];
    for (const [name, lat, lon] of list) {
      try {
        const d = await get(`https://api.met.no/weatherapi/airqualityforecast/0.1/?lat=${lat}&lon=${lon}`);
        const now = Date.now(), ts = (d.data && d.data.time) || [];
        const cur = ts.find(t => Date.parse(t.from) <= now && now < Date.parse(t.to) + 3600e3) || ts[0]; if (!cur) continue;
        const v = cur.variables || {}, num = k => v[k] && isFinite(v[k].value) ? +v[k].value : null;
        const worst = ['AQI_no2', 'AQI_pm10', 'AQI_pm25', 'AQI_o3'].map(k => [k.slice(4), num(k)]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1])[0];
        out.push({ name, lat, lon, aqi: num('AQI'), main: worst ? worst[0] : null, no2: num('no2_concentration'), pm10: num('pm10_concentration'), pm25: num('pm25_concentration'), time: cur.from });
      } catch {}
    }
    return { at: new Date().toISOString(), cities: out };
  });
}

// ---------- fly fra norske flyplasser (Avinor) ----------
const AIRPORTS = [['OSL', 'Oslo lufthavn', 60.194, 11.1], ['BGO', 'Bergen', 60.293, 5.218], ['TRD', 'Trondheim', 63.458, 10.924], ['SVG', 'Stavanger', 58.877, 5.638], ['TOS', 'Tromsø', 69.683, 18.919],
  ['BOO', 'Bodø', 67.269, 14.365], ['AES', 'Ålesund', 62.562, 6.12], ['KRS', 'Kristiansand', 58.204, 8.085], ['EVE', 'Harstad/Narvik', 68.491, 16.678], ['HAU', 'Haugesund', 59.345, 5.208],
  ['MOL', 'Molde', 62.745, 7.263], ['KSU', 'Kristiansund', 63.112, 7.825], ['ALF', 'Alta', 69.976, 23.372], ['LYR', 'Longyearbyen', 78.246, 15.466], ['KKN', 'Kirkenes', 69.726, 29.891]];
const xtag = (x, n) => (x.match(new RegExp(`<${n}>([^<]*)</${n}>`)) || [])[1] || '';
async function getAirports() {
  return cached('avinor', 5, async () => {
    const out = [];
    for (const [code, name, lat, lon] of AIRPORTS) {
      try {
        const x = await get(`https://asrv.avinor.no/XmlFeed/v1.0?TimeFrom=1&TimeTo=4&airport=${code}&direction=D`, 'text');
        const fl = x.split('<flight ').slice(1); let late = 0, canc = 0, total = 0; const worst = [];
        for (const f of fl) {
          const sched = Date.parse(xtag(f, 'schedule_time')), st = (f.match(/<status code="(\w)"(?: time="([^"]+)")?/) || []), code2 = st[1] || '', t = st[2] ? Date.parse(st[2]) : null;
          total++;
          if (code2 === 'C') { canc++; worst.push({ id: xtag(f, 'flight_id'), to: xtag(f, 'airport'), kind: 'innstilt' }); continue; }
          const delay = t && sched ? (t - sched) / 60e3 : 0;
          if (delay >= 15 || (/<delayed>Y<\/delayed>/.test(f) && delay >= 15)) { late++; if (delay >= 45) worst.push({ id: xtag(f, 'flight_id'), to: xtag(f, 'airport'), kind: Math.round(delay) + ' min forsinket' }); }
        }
        out.push({ code, name, lat, lon, total, late, canc, worst: worst.slice(0, 5) });
      } catch {}
    }
    return { at: new Date().toISOString(), airports: out };
  });
}

// ---------- snøskred, flom og jordskred (Varsom, NVE) ----------
const AVA_REGIONS = { 3003: [78.15, 16.0], 3006: [70.6, 25.5], 3007: [70.25, 22.6], 3009: [69.8, 21.2], 3010: [69.6, 20.2], 3011: [69.6, 18.8], 3012: [68.85, 17.6], 3013: [68.85, 19.4],
  3014: [68.4, 14.6], 3015: [68.35, 17.3], 3016: [67.15, 15.4], 3017: [66.7, 14.0], 3018: [65.95, 13.6], 3022: [62.8, 9.2], 3023: [62.45, 7.75], 3024: [62.2, 6.6], 3027: [61.65, 6.9],
  3028: [61.55, 8.4], 3029: [61.2, 7.4], 3031: [60.7, 6.4], 3032: [60.6, 8.6], 3034: [60.15, 6.9], 3035: [59.75, 8.0], 3037: [59.2, 7.1] };
const dayStr = d => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
async function getVarsom(placeLookup) {
  return cached('varsom', 60, async () => {
    const a = dayStr(new Date()), b = dayStr(new Date(Date.now() + 864e5)), items = [];
    const getJ = async u => { const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
    try {
      const av = await getJ(`https://api01.nve.no/hydrology/forecast/avalanche/v6.3.0/api/RegionSummary/Simple/1/${a}/${b}`);
      for (const r of av) { const pos = AVA_REGIONS[r.Id]; if (!pos) continue;
        for (const w of r.AvalancheWarningList || []) { const lvl = +w.DangerLevel; if (lvl >= 2) items.push({ kind: 'snøskred', level: lvl, name: r.Name, lat: pos[0], lon: pos[1], text: w.MainText || '', from: w.ValidFrom, url: 'https://www.varsom.no/snoskredvarsling/' }); } }
    } catch {}
    for (const [kind, api] of [['flom', 'flood'], ['jordskred', 'landslide']]) {
      try {
        const ws = await getJ(`https://api01.nve.no/hydrology/forecast/${api}/v1.0.10/api/Warning/All/1/${a}/${b}`);
        for (const w of ws) { const lvl = +w.ActivityLevel; if (!(lvl >= 2)) continue;
          for (const m of w.MunicipalityList || []) { const p = placeLookup(m.Name); if (!p) continue;
            items.push({ kind, level: lvl, name: m.Name, lat: p.lat, lon: p.lon, text: w.MainText || '', from: w.ValidFrom, url: `https://www.varsom.no/${kind === 'flom' ? 'flom-og-jordskred' : 'flom-og-jordskred'}/varsling/` }); } }
      } catch {}
    }
    // ett punkt per sted og type, med høyeste nivå og første dag
    const by = new Map(); for (const i of items) { const k = i.kind + i.name; const o = by.get(k); if (!o || i.level > o.level) by.set(k, i); }
    return { at: new Date().toISOString(), items: [...by.values()] };
  });
}

// ---------- børsmeldinger (Newsweb, Oslo Børs) ----------
async function getNewsweb(issuer) {
  issuer = String(issuer).replace(/\.OL$/i, '').toUpperCase();
  if (!/^[A-Z0-9-]{1,10}$/.test(issuer)) throw new Error('ukjent selskap');
  return cached('nw:' + issuer, 15, async () => {
    const r = await fetch(`https://api3.oslo.oslobors.no/v1/newsreader/list?issuer=${issuer}`, { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), msgs = ((j.data || {}).messages || []).filter(m => !m.test);
    // samme melding kommer ofte på norsk og engelsk: behold den norske
    const no = s => /[æøå]|\b(og|av|for|på|meldepliktig|utbytte|aksjer)\b/i.test(s);
    const out = [];
    for (const m of msgs.slice(0, 80)) {
      const t = Date.parse(m.publishedTime), twin = out.find(o => Math.abs(Date.parse(o.time) - t) < 3000);
      const item = { id: m.messageId, title: (m.title || '').trim(), time: m.publishedTime, cat: ((m.category || [])[0] || {}).category_no || '', issuer: m.issuerSign, name: m.issuerName, url: `https://newsweb.oslobors.no/message/${m.messageId}` };
      if (twin) { if (no(item.title) && !no(twin.title)) Object.assign(twin, item); continue; }
      out.push(item);
    }
    return out.slice(0, 30);
  });
}

// ---------- datoer for kvartalsrapport og utbytte (Yahoo Finance) ----------
let yCrumb = null, yCookie = '', yAt = 0;
async function yahooCrumb() {
  if (yCrumb && Date.now() - yAt < 6 * 3600e3) return;
  const r = await fetch('https://fc.yahoo.com/', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36' }, redirect: 'manual', signal: AbortSignal.timeout(10000) }).catch(() => null);
  const sc = r ? (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).filter(Boolean) : [];
  yCookie = sc.map(c => c.split(';')[0]).join('; ');
  const c = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36', Cookie: yCookie }, signal: AbortSignal.timeout(10000) });
  const t = await c.text(); if (!c.ok || !t || t.length > 40 || /</.test(t)) throw new Error('fikk ikke tilgang');
  yCrumb = t; yAt = Date.now();
}
async function getEarnings(sym) {
  return cached('earn:' + sym, 12 * 60, async () => {
    await yahooCrumb();
    const r = await fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=calendarEvents,price&crumb=${encodeURIComponent(yCrumb)}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36', Cookie: yCookie }, signal: AbortSignal.timeout(15000) });
    if (r.status === 401) { yCrumb = null; throw new Error('fikk ikke tilgang'); }
    const j = await r.json(), res = (((j || {}).quoteSummary || {}).result || [])[0] || {}, ce = res.calendarEvents || {}, name = (res.price || {}).shortName || sym;
    const d = x => x && x.raw ? new Date(x.raw * 1000).toISOString().slice(0, 10) : null;
    return { sym, name, earnings: ((ce.earnings || {}).earningsDate || []).map(d).filter(Boolean), estimate: !!(ce.earnings || {}).isEarningsDateEstimate, exDiv: d(ce.exDividendDate), divDate: d(ce.dividendDate) };
  });
}

module.exports = { getAirQuality, getAirports, getVarsom, getNewsweb, getEarnings, AIRPORTS, setUA, getShakemap, getFires, getAurora, getPolicyRate, getPowerDay, powerSummary, zoneFor, POWER_ZONES, getDivs };
