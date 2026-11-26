// Nyhetskloden – tilleggsdata: marked (aksjer, valuta, råvarer), vær, fly, skip og daglig oppsummering.
// Alt hentes bare når funksjonen er slått på i innstillingene.

const UA = 'Nyhetskloden/3.1 (privat hobbyapp)';

// ---------- marked ----------
// Yahoo Finance sitt åpne chart-endepunkt (forsinkede kurser, ingen nøkkel).
const INDICES = [
  { sym: 'OSEBX.OL', name: 'Oslo Børs (OSEBX)', lat: 59.911, lon: 10.749, city: 'Oslo', region: 'Norden' },
  { sym: 'OBX.OL', name: 'OBX', lat: 59.911, lon: 10.749, city: 'Oslo', region: 'Norden', noGlobe: true },
  { sym: '^OMX', name: 'OMX Stockholm 30', lat: 59.334, lon: 18.063, city: 'Stockholm', region: 'Norden' },
  { sym: '^OMXC25', name: 'OMX København 25', lat: 55.676, lon: 12.568, city: 'København', region: 'Norden' },
  { sym: '^OMXH25', name: 'OMX Helsinki 25', lat: 60.17, lon: 24.94, city: 'Helsingfors', region: 'Norden' },
  { sym: '^GDAXI', name: 'DAX', lat: 50.115, lon: 8.672, city: 'Frankfurt', region: 'Europa' },
  { sym: '^FTSE', name: 'FTSE 100', lat: 51.515, lon: -0.088, city: 'London', region: 'Europa' },
  { sym: '^FCHI', name: 'CAC 40', lat: 48.869, lon: 2.341, city: 'Paris', region: 'Europa' },
  { sym: '^STOXX50E', name: 'Euro Stoxx 50', lat: 50.85, lon: 4.35, city: 'Brussel', region: 'Europa', noGlobe: true },
  { sym: '^IBEX', name: 'IBEX 35', lat: 40.418, lon: -3.703, city: 'Madrid', region: 'Europa' },
  { sym: '^GSPC', name: 'S&P 500', lat: 40.706, lon: -74.011, city: 'New York', region: 'Amerika' },
  { sym: '^IXIC', name: 'Nasdaq', lat: 40.757, lon: -73.986, city: 'New York', region: 'Amerika' },
  { sym: '^DJI', name: 'Dow Jones', lat: 40.706, lon: -74.011, city: 'New York', region: 'Amerika' },
  { sym: '^GSPTSE', name: 'TSX', lat: 43.649, lon: -79.381, city: 'Toronto', region: 'Amerika' },
  { sym: '^BVSP', name: 'Bovespa', lat: -23.547, lon: -46.634, city: 'São Paulo', region: 'Amerika' },
  { sym: '^N225', name: 'Nikkei 225', lat: 35.682, lon: 139.774, city: 'Tokyo', region: 'Asia og Oseania' },
  { sym: '^HSI', name: 'Hang Seng', lat: 22.283, lon: 114.158, city: 'Hongkong', region: 'Asia og Oseania' },
  { sym: '000001.SS', name: 'Shanghai', lat: 31.236, lon: 121.48, city: 'Shanghai', region: 'Asia og Oseania' },
  { sym: '^KS11', name: 'Kospi', lat: 37.566, lon: 126.978, city: 'Seoul', region: 'Asia og Oseania' },
  { sym: '^BSESN', name: 'Sensex', lat: 18.93, lon: 72.833, city: 'Mumbai', region: 'Asia og Oseania' },
  { sym: '^AXJO', name: 'ASX 200', lat: -33.868, lon: 151.207, city: 'Sydney', region: 'Asia og Oseania' },
];
const OTHER = [
  { sym: 'USDNOK=X', name: 'USD/NOK', kind: 'fx' }, { sym: 'EURNOK=X', name: 'EUR/NOK', kind: 'fx' }, { sym: 'GBPNOK=X', name: 'GBP/NOK', kind: 'fx' },
  { sym: 'SEKNOK=X', name: 'SEK/NOK', kind: 'fx' }, { sym: 'DKKNOK=X', name: 'DKK/NOK', kind: 'fx' }, { sym: 'EURUSD=X', name: 'EUR/USD', kind: 'fx' },
  { sym: 'BZ=F', name: 'Olje (Brent)', kind: 'cmd' }, { sym: 'CL=F', name: 'Olje (WTI)', kind: 'cmd' }, { sym: 'NG=F', name: 'Naturgass', kind: 'cmd' },
  { sym: 'GC=F', name: 'Gull', kind: 'cmd' }, { sym: 'SI=F', name: 'Sølv', kind: 'cmd' }, { sym: 'HG=F', name: 'Kobber', kind: 'cmd' },
  { sym: 'BTC-USD', name: 'Bitcoin', kind: 'crypto' }, { sym: 'ETH-USD', name: 'Ethereum', kind: 'crypto' }, { sym: 'SOL-USD', name: 'Solana', kind: 'crypto' },
];
// Store selskaper på Oslo Børs – grunnlaget for «vinnere og tapere»
const OSLO = ['EQNR', 'DNB', 'KOG', 'MOWI', 'TEL', 'NHY', 'YAR', 'ORK', 'AKRBP', 'GJF', 'SALM', 'STB', 'SUBC', 'TOM', 'NOD', 'FRO',
  'AUTO', 'VAR', 'NAS', 'TGS', 'BAKKA', 'SCATC', 'MPCC', 'HAFNI', 'AKER', 'AKSO', 'BWLPG', 'WAWI', 'ENTRA', 'LSG', 'NEL', 'HAUTO'].map(s => s + '.OL');
// periode → Yahoo range og oppløsning
const RANGES = { '1d': ['1d', '5m'], '5d': ['5d', '30m'], '1mo': ['1mo', '1d'], '6mo': ['6mo', '1d'], 'ytd': ['ytd', '1d'], '1y': ['1y', '1d'], '5y': ['5y', '1wk'], 'max': ['max', '1mo'] };
const okRange = r => (RANGES[r] ? r : '1d');

async function chart(sym, range = '1d') {
  const [rg, iv] = RANGES[okRange(range)];
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${rg}&interval=${iv}&includePrePost=false`, { headers: { 'User-Agent': 'Mozilla/5.0 ' + UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(), res = j.chart && j.chart.result && j.chart.result[0];
  if (!res) throw new Error('ukjent ticker');
  const ts = res.timestamp || [], cl = (res.indicators && res.indicators.quote && res.indicators.quote[0].close) || [];
  const pts = ts.map((t, i) => [t * 1000, cl[i]]).filter(p => p[1] != null);
  return { res, m: res.meta, pts };
}
async function quote(sym, range = '1d') {
  const { m, pts } = await chart(sym, range);
  const price = m.regularMarketPrice ?? (pts.length ? pts[pts.length - 1][1] : null);
  // 1 dag: mot gårsdagens slutt. Lengre perioder: mot første kurs i perioden.
  const prev = okRange(range) === '1d' ? (m.chartPreviousClose ?? m.previousClose) : (pts.length ? pts[0][1] : null);
  const closes = pts.map(p => p[1]);
  return { sym, name: m.shortName || m.longName || sym, long: m.longName || m.shortName || sym, price, prev, cur: m.currency || '',
    pct: prev && price != null ? +((price / prev - 1) * 100).toFixed(2) : null, time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
    spark: closes.length > 60 ? closes.filter((_, i) => i % Math.ceil(closes.length / 60) === 0) : closes };
}
async function many(list, fn, conc = 6) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, list.length) }, async () => { while (i < list.length) { const k = i++; try { out[k] = await fn(list[k]); } catch (e) { out[k] = null; } } }));
  return out;
}
const marketCache = new Map();
async function getMarket(cfg) {
  const range = okRange(cfg.range), key = range + '|' + (cfg.watch || []).join(',') + '|' + !!cfg.movers;
  const hit = marketCache.get(key);
  if (hit && Date.now() - hit.at < (range === '1d' ? 4 : 30) * 60e3) return hit.data;
  const watch = (cfg.watch || []).map(s => s.toUpperCase());
  const [idx, oth, osl, wl] = await Promise.all([
    many(INDICES, i => quote(i.sym, range).then(q => ({ ...q, ...i, name: i.name }))),
    many(OTHER, o => quote(o.sym, range).then(q => ({ ...q, ...o, name: o.name }))),
    cfg.movers ? many(OSLO, s => quote(s, range)) : Promise.resolve([]),
    many(watch, s => quote(s, range)),
  ]);
  const movers = osl.filter(q => q && q.pct != null).sort((a, b) => b.pct - a.pct);
  const data = { at: new Date().toISOString(), range, indices: idx.filter(Boolean), other: oth.filter(Boolean),
    up: movers.slice(0, 5), down: movers.slice(-5).reverse(), watch: wl.filter(Boolean),
    failed: watch.filter((s, i) => !wl[i]),
    cos: [...new Map([...osl, ...wl].filter(Boolean).map(q => [q.sym, { sym: q.sym, name: q.name, price: q.price, cur: q.cur, pct: q.pct, names: companyNames(q) }])).values()] };
  marketCache.set(key, { at: Date.now(), data });
  if (marketCache.size > 20) marketCache.delete(marketCache.keys().next().value);
  return data;
}
// Detaljer for én ticker: graf og nøkkeltall
const detailCache = new Map();
async function getDetail(sym, range) {
  range = okRange(range); const key = sym + '|' + range, hit = detailCache.get(key);
  if (hit && Date.now() - hit.at < (range === '1d' ? 3 : 20) * 60e3) return hit.data;
  const { m, pts } = await chart(sym, range);
  const price = m.regularMarketPrice ?? (pts.length ? pts[pts.length - 1][1] : null);
  const first = okRange(range) === '1d' ? (m.chartPreviousClose ?? m.previousClose) : (pts.length ? pts[0][1] : null);
  const step = Math.ceil(pts.length / 400);
  const data = { sym, name: m.longName || m.shortName || sym, short: m.shortName || sym, cur: m.currency || '', exch: m.fullExchangeName || m.exchangeName || '', type: m.instrumentType || '',
    price, first, pct: first && price != null ? +((price / first - 1) * 100).toFixed(2) : null, range,
    high52: m.fiftyTwoWeekHigh ?? null, low52: m.fiftyTwoWeekLow ?? null, dayHigh: m.regularMarketDayHigh ?? null, dayLow: m.regularMarketDayLow ?? null, vol: m.regularMarketVolume ?? null,
    time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null, tz: m.exchangeTimezoneName || null,
    points: pts.filter((_, i) => i % step === 0 || i === pts.length - 1) };
  detailCache.set(key, { at: Date.now(), data });
  if (detailCache.size > 60) detailCache.delete(detailCache.keys().next().value);
  return data;
}
// Søk etter aksjer, fond, indekser, valuta og krypto
async function searchTicker(q) {
  const r = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0&lang=nb-NO&region=NO`, { headers: { 'User-Agent': 'Mozilla/5.0 ' + UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return (j.quotes || []).filter(x => x.symbol && x.quoteType !== 'OPTION').map(x => ({ sym: x.symbol, name: x.longname || x.shortname || x.symbol, exch: x.exchDisp || x.exchange || '', type: x.typeDisp || x.quoteType || '' }));
}
const resetMarket = () => { marketCache.clear(); };
// Navn som kan nevnes i nyheter: «EQUINOR» → «Equinor», «Kongsberg Gruppen ASA» → «Kongsberg Gruppen»
function companyNames(q) {
  const clean = s => String(s || '').replace(/\b(ASA|AS|Inc\.?|Corporation|Corp\.?|Ltd\.?|plc|Holding(s)?|Group|SE|AG|N\.V\.)\b/gi, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const names = new Set([clean(q.long), clean(q.name)].filter(n => n.length >= 3).map(n => n.split(' ').slice(0, 2).join(' ')));
  for (const n of [...names]) { const first = n.split(' ')[0]; if (first.length >= 5) names.add(first); }
  return [...names].map(n => n.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()));
}

// ---------- vær (MET Norge) ----------
let wx = null, wxKey = '', wxAt = 0;
async function getWeather(home) {
  if (!home || !isFinite(home.lat)) return null;
  const key = home.lat.toFixed(2) + ',' + home.lon.toFixed(2);
  if (wx && wxKey === key && Date.now() - wxAt < 30 * 60e3) return wx;
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${home.lat.toFixed(4)}&lon=${home.lon.toFixed(4)}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('MET HTTP ' + r.status);
  const ts = (await r.json()).properties.timeseries;
  const pick = t => ({ time: t.time, temp: t.data.instant.details.air_temperature, wind: t.data.instant.details.wind_speed,
    sym: (t.data.next_1_hours || t.data.next_6_hours || {}).summary?.symbol_code || '', rain: (t.data.next_1_hours || {}).details?.precipitation_amount ?? null });
  // dager som på Yr: min/maks, nedbør og symbolet midt på dagen (lokal tid)
  const days = new Map();
  for (const t of ts) {
    const d = new Date(t.time), key = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
    const h = +d.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Oslo' });
    if (!days.has(key)) days.set(key, { date: key, min: Infinity, max: -Infinity, rain: 0, sym: '', symH: 99, wind: 0 });
    const x = days.get(key), det = t.data.instant.details;
    x.min = Math.min(x.min, det.air_temperature); x.max = Math.max(x.max, det.air_temperature); x.wind = Math.max(x.wind, det.wind_speed || 0);
    const n1 = t.data.next_1_hours, n6 = t.data.next_6_hours;
    if (n1) x.rain += n1.details?.precipitation_amount || 0; else if (n6) x.rain += n6.details?.precipitation_amount || 0;
    const sym = (n6 || n1 || {}).summary?.symbol_code;
    if (sym && Math.abs(h - 12) < Math.abs(x.symH - 12)) { x.sym = sym; x.symH = h; }
  }
  wx = { at: new Date().toISOString(), place: home.name, now: pick(ts[0]), hours: ts.slice(1, 25).map(pick),
    days: [...days.values()].slice(0, 8).map(({ symH, ...d }) => ({ ...d, min: Math.round(d.min * 10) / 10, max: Math.round(d.max * 10) / 10, rain: Math.round(d.rain * 10) / 10 })) };
  wxKey = key; wxAt = Date.now();
  return wx;
}

// ---------- fly (adsb.lol, åpne ADS-B-data) ----------
const flightCache = new Map();
async function getFlights(lat, lon) {
  const key = lat.toFixed(1) + ',' + lon.toFixed(1), c = flightCache.get(key);
  if (c && Date.now() - c.at < 25e3) return c.data;
  const r = await fetch(`https://api.adsb.lol/v2/lat/${lat.toFixed(3)}/lon/${lon.toFixed(3)}/dist/250`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('adsb.lol HTTP ' + r.status);
  const ac = ((await r.json()).ac || []).filter(a => isFinite(a.lat) && isFinite(a.lon) && a.alt_baro !== 'ground').slice(0, 800)
    .map(a => ({ lat: a.lat, lon: a.lon, track: a.track ?? a.true_heading ?? 0, cs: (a.flight || '').trim(), alt: typeof a.alt_baro === 'number' ? a.alt_baro : null, type: a.t || '', reg: a.r || '' }));
  const data = { at: new Date().toISOString(), ac };
  flightCache.set(key, { at: Date.now(), data }); if (flightCache.size > 30) flightCache.delete(flightCache.keys().next().value);
  return data;
}

// ---------- skip (BarentsWatch åpne AIS-data, krever gratis API-klient) ----------
let bwToken = null, bwExp = 0, ships = null, shipsAt = 0;
async function getShips(cfg) {
  if (!cfg.clientId || !cfg.clientSecret) throw new Error('mangler BarentsWatch-klient');
  if (ships && Date.now() - shipsAt < 90e3) return ships;
  if (!bwToken || Date.now() > bwExp) {
    const r = await fetch('https://id.barentswatch.no/connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: 'ais', grant_type: 'client_credentials' }) });
    if (!r.ok) throw new Error('innlogging til BarentsWatch feilet (HTTP ' + r.status + ')');
    const j = await r.json(); bwToken = j.access_token; bwExp = Date.now() + ((j.expires_in || 3600) - 60) * 1000;
  }
  const r = await fetch('https://live.ais.barentswatch.no/v1/latest/combined', { headers: { Authorization: 'Bearer ' + bwToken, 'User-Agent': UA } });
  if (!r.ok) throw new Error('BarentsWatch HTTP ' + r.status);
  const list = await r.json();
  ships = { at: new Date().toISOString(), ships: (Array.isArray(list) ? list : []).filter(s => isFinite(s.latitude) && isFinite(s.longitude))
    .map(s => ({ lat: s.latitude, lon: s.longitude, cog: s.courseOverGround ?? s.trueHeading ?? 0, name: s.name || '', type: s.shipType || 0, sog: s.speedOverGround ?? null, mmsi: s.mmsi })) };
  shipsAt = Date.now();
  return ships;
}
const resetShips = () => { bwToken = null; ships = null; };

// ---------- hjelpere ----------
function distKm(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
// De viktigste hendelsene (gruppert som i appen) – brukes til daglig oppsummering
function topEvents(news, hours = 24, n = 5, off = []) {
  const g = new Map(), cut = Date.now() - hours * 3600e3, skip = new Set(off);
  for (const x of news) { if (new Date(x.date) < cut || skip.has(x.cat)) continue; const k = x.eid || x.id; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  return [...g.values()].map(it => {
    const srcs = new Set(it.map(x => x.src)).size, top = it.some(x => x.top), sev = Math.max(...it.map(x => x.sev || 0));
    const p = it.find(x => x.lang === 'no') || it.find(x => x.titleNo) || it[0];
    return { id: p.eid || p.id, title: p.lang === 'no' ? p.title : (p.titleNo || p.title), score: sev + (srcs - 1) * 1.5 + (top ? 2 : 0), srcs };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}

// ---------- vær på kloden: norske byer ----------
// Henter Yr-varsel for de største byene. Mellomlagres i 45 min, så MET får få forespørsler.
const WX_CITIES = [['Oslo', 59.91, 10.75], ['Bergen', 60.39, 5.32], ['Trondheim', 63.43, 10.39], ['Stavanger', 58.97, 5.73], ['Kristiansand', 58.15, 8.0],
  ['Tromsø', 69.65, 18.96], ['Bodø', 67.28, 14.4], ['Ålesund', 62.47, 6.15], ['Lillehammer', 61.12, 10.47], ['Hamar', 60.8, 11.07],
  ['Skien', 59.21, 9.61], ['Drammen', 59.74, 10.2], ['Fredrikstad', 59.22, 10.93], ['Haugesund', 59.41, 5.27], ['Førde', 61.45, 5.85],
  ['Molde', 62.74, 7.16], ['Mo i Rana', 66.31, 14.14], ['Narvik', 68.44, 17.43], ['Alta', 69.97, 23.27], ['Kirkenes', 69.73, 30.05],
  ['Hammerfest', 70.66, 23.68], ['Svolvær', 68.23, 14.57], ['Røros', 62.57, 11.38], ['Geilo', 60.53, 8.21], ['Rjukan', 59.88, 8.59],
  ['Arendal', 58.46, 8.77], ['Gjøvik', 60.8, 10.69], ['Steinkjer', 64.01, 11.5], ['Vadsø', 70.07, 29.75], ['Longyearbyen', 78.22, 15.65]];
let wxMap = null, wxMapAt = 0, wxMapBusy = null;
async function getWxMap(home) {
  if (wxMap && Date.now() - wxMapAt < 45 * 60e3) return wxMap;
  if (wxMapBusy) return wxMapBusy;
  wxMapBusy = (async () => {
    const list = [...WX_CITIES];
    if (home && isFinite(home.lat) && !list.some(c => distKm({ lat: c[1], lon: c[2] }, home) < 15)) list.push([home.name, home.lat, home.lon]);
    const out = [];
    for (let i = 0; i < list.length; i += 5) {
      const part = await Promise.all(list.slice(i, i + 5).map(async ([name, lat, lon]) => {
        try {
          const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, { headers: { 'User-Agent': UA } });
          if (!r.ok) return null;
          const t = (await r.json()).properties.timeseries[0];
          return { name, lat, lon, temp: t.data.instant.details.air_temperature, wind: t.data.instant.details.wind_speed, sym: (t.data.next_1_hours || t.data.next_6_hours || {}).summary?.symbol_code || '' };
        } catch { return null; }
      }));
      out.push(...part.filter(Boolean));
    }
    if (out.length) { wxMap = { at: new Date().toISOString(), cities: out }; wxMapAt = Date.now(); }
    return wxMap || { at: null, cities: [], error: 'Fikk ikke kontakt med Yr' };
  })();
  try { return await wxMapBusy; } finally { wxMapBusy = null; }
}
// ---------- nedbørsradar (RainViewer) ----------
let radar = null, radarAt = 0;
async function getRadar() {
  if (radar && Date.now() - radarAt < 5 * 60e3) return radar;
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json', { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('RainViewer HTTP ' + r.status);
  const d = await r.json(), past = d.radar?.past || [];
  if (!past.length) throw new Error('ingen radarbilder');
  const last = past[past.length - 1];
  radar = { host: d.host || 'https://tilecache.rainviewer.com', path: last.path, time: new Date(last.time * 1000).toISOString() }; radarAt = Date.now();
  return radar;
}

// ---------- tropiske stormer (GDACS) ----------
// Henter aktive sykloner fra GDACS og banen deres (linjer) og varslingsområder (flater). Mellomlagres i 30 min.
let storms = null, stormsAt = 0;
async function getStorms() {
  if (storms && Date.now() - stormsAt < 30 * 60e3) return storms;
  const r = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/latest', { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error('GDACS HTTP ' + r.status);
  // bare stormer som pågår nå, eller som var aktive de siste to døgnene
  const list = ((await r.json()).features || []).filter(f => f.properties && f.properties.eventtype === 'TC' &&
    (String(f.properties.iscurrent) === 'true' || Date.now() - new Date(f.properties.todate + 'Z') < 2 * 864e5)).slice(0, 8);
  const feats = [];
  for (const ev of list) {
    const p = ev.properties, name = (p.eventname || 'Storm').replace(/-\d+$/, ''), level = String(p.alertlevel || 'green').toLowerCase();
    const base = { name, level, eventid: p.eventid, url: `https://www.gdacs.org/report.aspx?eventtype=TC&eventid=${p.eventid}` };
    if (ev.geometry && ev.geometry.type === 'Point') feats.push({ type: 'Feature', geometry: ev.geometry, properties: { ...base, role: 'now' } });
    const gurl = p.url && p.url.geometry || `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=${p.eventid}&episodeid=${p.episodeid}`;
    try {
      const g = await fetch(gurl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!g.ok) continue;
      for (const f of (await g.json()).features || []) {
        const t = f.geometry && f.geometry.type;
        if (t === 'LineString' || t === 'MultiLineString') feats.push({ type: 'Feature', geometry: f.geometry, properties: { ...base, role: 'track' } });
        else if ((t === 'Polygon' || t === 'MultiPolygon') && /cone|forecast|uncertain/i.test(JSON.stringify(f.properties || {}))) feats.push({ type: 'Feature', geometry: f.geometry, properties: { ...base, role: 'cone' } });
      }
    } catch {}
  }
  storms = { type: 'FeatureCollection', features: feats, at: new Date().toISOString() }; stormsAt = Date.now();
  return storms;
}

// ---------- podkaster ----------
const PODS = [
  { name: 'Dagsnytt 18', by: 'NRK', url: 'https://podkast.nrk.no/program/dagsnytt_18.rss' },
  { name: 'Global News Podcast', by: 'BBC', url: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss' },
  { name: 'The Daily', by: 'New York Times', url: 'https://feeds.simplecast.com/54nAGcIl' },
];
let pods = null, podsAt = 0;
const unx = t => (t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
async function getPodcasts() {
  if (pods && Date.now() - podsAt < 30 * 60e3) return pods;
  const out = await Promise.all(PODS.map(async p => {
    try {
      const r = await fetch(p.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const xml = await r.text();
      const eps = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].slice(0, 3).map(m => {
        const it = m[0], enc = (it.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1];
        return { title: unx((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]), date: (it.match(/<pubDate>([^<]+)/) || [])[1] || null,
          audio: enc && /^https:\/\//.test(unx(enc)) ? unx(enc) : null, dur: unx((it.match(/<itunes:duration>([^<]+)/) || [])[1]) || null };
      }).filter(e => e.audio);
      return { ...p, eps };
    } catch (e) { return { ...p, eps: [], error: e.message }; }
  }));
  pods = { at: new Date().toISOString(), pods: out }; podsAt = Date.now();
  return pods;
}

// ---------- landfakta ----------
// countries.json: [hovedstad, areal km², språk, valuta, tidssone, hovedstad lat, lon] fra world-countries (ODbL) og countries-and-timezones (MIT)
const COUNTRIES = require('./countries.json');
if (COUNTRIES.US) { COUNTRIES.US[5] = 38.9; COUNTRIES.US[6] = -77.04; }
const popCache = new Map(), capWx = new Map();
async function getCountry(cc) {
  const c = COUNTRIES[cc];
  if (!c) return null;
  const [capital, area, langs, curr, tz, lat, lon] = c;
  let pop = popCache.get(cc);
  if (!pop || Date.now() - pop.at > 7 * 864e5) {
    try {
      const r = await fetch(`https://api.worldbank.org/v2/country/${cc}/indicator/SP.POP.TOTL?format=json&mrv=1`, { headers: { 'User-Agent': UA } });
      const d = await r.json(); const v = d && d[1] && d[1][0];
      pop = { at: Date.now(), n: v && v.value, year: v && v.date };
    } catch { pop = { at: Date.now() - 6 * 864e5, n: null }; }
    popCache.set(cc, pop);
  }
  let wx = capWx.get(cc);
  if (!wx || Date.now() - wx.at > 30 * 60e3) {
    try {
      const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${(+lat).toFixed(2)}&lon=${(+lon).toFixed(2)}`, { headers: { 'User-Agent': UA } });
      const t = (await r.json()).properties.timeseries[0];
      wx = { at: Date.now(), temp: t.data.instant.details.air_temperature, sym: (t.data.next_1_hours || t.data.next_6_hours || {}).summary?.symbol_code || '' };
    } catch { wx = { at: Date.now() - 25 * 60e3 }; }
    capWx.set(cc, wx);
  }
  return { cc, capital, area, langs, curr, tz, lat, lon, population: pop.n || null, popYear: pop.year || null, weather: wx.temp != null ? { temp: wx.temp, sym: wx.sym } : null };
}

// ---------- strømpris (hvakosterstrommen.no) ----------
const ZONES = [['NO1', 'Øst', 60.2, 10.9], ['NO2', 'Sør', 58.9, 7.4], ['NO3', 'Midt', 63.4, 10.4], ['NO4', 'Nord', 68.6, 16.5], ['NO5', 'Vest', 60.6, 6.2]];
let power = null, powerAt = 0;
async function getPower() {
  if (power && Date.now() - powerAt < 10 * 60e3 && new Date(power.at).getHours() === new Date().getHours()) return power;
  const d = new Date(), day = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
  const [y, m, dd] = day.split('-');
  const zones = await Promise.all(ZONES.map(async ([id, name, lat, lon]) => {
    try {
      const r = await fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${dd}_${id}.json`, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const arr = (await r.json()).map(p => ({ t: p.time_start, end: p.time_end, kr: p.NOK_per_kWh }));
      const now = arr.find(p => new Date(p.t) <= d && d < new Date(p.end)) || arr[arr.length - 1];
      const ks = arr.map(p => p.kr);
      return { id, name, lat, lon, now: now ? now.kr : null, avg: ks.reduce((a, b) => a + b, 0) / ks.length, min: Math.min(...ks), max: Math.max(...ks), hours: arr };
    } catch (e) { return { id, name, lat, lon, now: null, error: e.message }; }
  }));
  power = { at: new Date().toISOString(), day, zones }; powerAt = Date.now();
  return power;
}

// ---------- trafikk på norske veier (Statens vegvesen, DATEX II) ----------
let traffic = null, trafficAt = 0, trafficKey = '';
async function getTraffic(cfg) {
  if (!cfg || !cfg.user || !cfg.pass) throw new Error('mangler DATEX-tilgang');
  const key = cfg.user;
  if (traffic && key === trafficKey && Date.now() - trafficAt < 5 * 60e3) return traffic;
  const r = await fetch('https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetSituation/pullsnapshotdata', {
    headers: { 'User-Agent': UA, Authorization: 'Basic ' + Buffer.from(cfg.user + ':' + cfg.pass).toString('base64'), Accept: 'application/xml' } });
  if (r.status === 401 || r.status === 403) throw new Error('feil brukernavn eller passord');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const xml = await r.text(), out = [];
  for (const m of xml.matchAll(/<(?:\w+:)?situationRecord\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?situationRecord>/g)) {
    const attrs = m[1], body = m[2];
    const type = ((attrs.match(/type="(?:\w+:)?(\w+)"/) || [])[1] || '').replace(/^(\w)/, x => x.toLowerCase());
    const lat = +(body.match(/<(?:\w+:)?latitude>([-\d.]+)</) || [])[1], lon = +(body.match(/<(?:\w+:)?longitude>([-\d.]+)</) || [])[1];
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const text = ((body.match(/<(?:\w+:)?value lang="no[^"]*">([\s\S]*?)<\/(?:\w+:)?value>/) || body.match(/<(?:\w+:)?value[^>]*>([\s\S]*?)<\/(?:\w+:)?value>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    const start = (body.match(/<(?:\w+:)?overallStartTime>([^<]+)</) || [])[1] || null;
    const kind = /accident/i.test(type) ? 'ulykke' : /roadOrCarriagewayOrLaneManagement|roadClosed|closure/i.test(type + body) && /closed|stengt/i.test(body + text) ? 'stengt' : /maintenance|roadworks|constructionWorks/i.test(type) ? 'veiarbeid' : /weather|poorEnvironment|conditions/i.test(type) ? 'føre' : /ferry|ferje/i.test(type + text) ? 'ferje' : 'melding';
    out.push({ lat, lon, kind, type, text: text.slice(0, 400), start });
  }
  traffic = { at: new Date().toISOString(), items: out.slice(0, 3000) }; trafficAt = Date.now(); trafficKey = key;
  return traffic;
}

module.exports = { getDetail, searchTicker, quote, getCountry, getPower, getTraffic, getPodcasts, getStorms, getMarket, resetMarket, companyNames, getWeather, getWxMap, getRadar, getFlights, getShips, resetShips, distKm, topEvents, INDICES };
