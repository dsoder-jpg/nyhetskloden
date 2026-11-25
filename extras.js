// Nyhetskloden – tilleggsdata: marked (aksjer, valuta, råvarer), vær, fly, skip og daglig oppsummering.
// Alt hentes bare når funksjonen er slått på i innstillingene.

const UA = 'Nyhetskloden/3.1 (privat hobbyapp)';

// ---------- marked ----------
// Yahoo Finance sitt åpne chart-endepunkt (forsinkede kurser, ingen nøkkel).
const INDICES = [
  { sym: 'OSEBX.OL', name: 'Oslo Børs (OSEBX)', lat: 59.911, lon: 10.749, city: 'Oslo' },
  { sym: '^GSPC', name: 'S&P 500', lat: 40.706, lon: -74.011, city: 'New York' },
  { sym: '^IXIC', name: 'Nasdaq', lat: 40.757, lon: -73.986, city: 'New York' },
  { sym: '^GDAXI', name: 'DAX', lat: 50.115, lon: 8.672, city: 'Frankfurt' },
  { sym: '^FTSE', name: 'FTSE 100', lat: 51.515, lon: -0.088, city: 'London' },
  { sym: '^OMX', name: 'OMX Stockholm 30', lat: 59.334, lon: 18.063, city: 'Stockholm' },
  { sym: '^N225', name: 'Nikkei 225', lat: 35.682, lon: 139.774, city: 'Tokyo' },
  { sym: '^HSI', name: 'Hang Seng', lat: 22.283, lon: 114.158, city: 'Hongkong' },
  { sym: '000001.SS', name: 'Shanghai', lat: 31.236, lon: 121.48, city: 'Shanghai' },
];
const OTHER = [
  { sym: 'USDNOK=X', name: 'USD/NOK', kind: 'fx' },
  { sym: 'EURNOK=X', name: 'EUR/NOK', kind: 'fx' },
  { sym: 'BZ=F', name: 'Olje (Brent)', kind: 'cmd' },
  { sym: 'GC=F', name: 'Gull', kind: 'cmd' },
  { sym: 'BTC-USD', name: 'Bitcoin', kind: 'crypto' },
];
// Store selskaper på Oslo Børs – grunnlaget for «vinnere og tapere i dag»
const OSLO = ['EQNR', 'DNB', 'KOG', 'MOWI', 'TEL', 'NHY', 'YAR', 'ORK', 'AKRBP', 'GJF', 'SALM', 'STB', 'SUBC', 'TOM', 'NOD', 'FRO',
  'AUTO', 'VAR', 'NAS', 'TGS', 'BAKKA', 'SCATC', 'MPCC', 'HAFNI', 'AKER', 'AKSO', 'BWLPG', 'WAWI', 'ENTRA', 'LSG', 'NEL', 'HAUTO'].map(s => s + '.OL');

async function quote(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=15m`, { headers: { 'User-Agent': 'Mozilla/5.0 ' + UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(), res = j.chart && j.chart.result && j.chart.result[0];
  if (!res) throw new Error('ukjent ticker');
  const m = res.meta, prev = m.chartPreviousClose ?? m.previousClose, price = m.regularMarketPrice;
  const closes = ((res.indicators && res.indicators.quote && res.indicators.quote[0].close) || []).filter(v => v != null);
  return { sym, name: m.shortName || m.longName || sym, long: m.longName || m.shortName || sym, price, prev, cur: m.currency || '',
    pct: prev ? +((price / prev - 1) * 100).toFixed(2) : null, time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
    spark: closes.length > 60 ? closes.filter((_, i) => i % Math.ceil(closes.length / 60) === 0) : closes };
}
async function many(list, fn, conc = 6) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, list.length) }, async () => { while (i < list.length) { const k = i++; try { out[k] = await fn(list[k]); } catch (e) { out[k] = null; } } }));
  return out;
}
let market = null, marketAt = 0;
async function getMarket(cfg) {
  if (market && Date.now() - marketAt < 4 * 60e3) return market;
  const watch = (cfg.watch || []).map(s => s.toUpperCase());
  const [idx, oth, osl, wl] = await Promise.all([
    many(INDICES, i => quote(i.sym).then(q => ({ ...q, ...i, name: i.name }))),
    many(OTHER, o => quote(o.sym).then(q => ({ ...q, ...o, name: o.name }))),
    cfg.movers ? many(OSLO, quote) : Promise.resolve([]),
    many(watch, quote),
  ]);
  const movers = osl.filter(q => q && q.pct != null).sort((a, b) => b.pct - a.pct);
  market = { at: new Date().toISOString(), indices: idx.filter(Boolean), other: oth.filter(Boolean),
    up: movers.slice(0, 5), down: movers.slice(-5).reverse(), watch: wl.filter(Boolean),
    failed: watch.filter((s, i) => !wl[i]),
    cos: [...new Map([...osl, ...wl].filter(Boolean).map(q => [q.sym, { sym: q.sym, name: q.name, price: q.price, cur: q.cur, pct: q.pct, names: companyNames(q) }])).values()] };
  marketAt = Date.now();
  return market;
}
const resetMarket = () => { marketAt = 0; };
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
  wx = { at: new Date().toISOString(), place: home.name, now: pick(ts[0]), hours: ts.slice(1, 13).map(pick) };
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

module.exports = { getMarket, resetMarket, companyNames, getWeather, getFlights, getShips, resetShips, distKm, topEvents, INDICES };
