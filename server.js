// Nyhetskloden – nyhetsmotor og lokal webserver (v3)
// Henter nyhetsfeeder hvert 5. minutt, grupperer saker om samme hendelse, gir dem en
// viktighetsscore, finner sted og land, oversetter engelske titler (valgfritt, DeepL),
// sjekker overvåkede ord, henter farevarsler fra MET og sender alt til appen i sanntid (SSE).
// Brukes av Electron-appen (main.js), men kan også kjøres alene: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const events = new EventEmitter();
const POLL_MIN = +process.env.POLL_MIN || 5;
const KEEP_HOURS = +process.env.KEEP_HOURS || 168; // 7 dager, så tidslinjen kan spille av uka
const MAX_ITEMS = 5000;
const UA = 'Nyhetskloden/3.0 (privat hobbyapp)';

// lang: språket i feeden (no/en). top: toppsaker. region: reserveplassering.
const BUILTIN_FEEDS = [
  // Norge
  { src: 'NRK', url: 'https://www.nrk.no/toppsaker.rss', top: true, lang: 'no' },
  { src: 'NRK', url: 'https://www.nrk.no/nyheter/siste.rss', lang: 'no' },
  { src: 'NRK', url: 'https://www.nrk.no/norge/toppsaker.rss', top: true, lang: 'no' },
  { src: 'NRK', url: 'https://www.nrk.no/urix/toppsaker.rss', top: true, lang: 'no' },
  { src: 'NRK Sport', url: 'https://www.nrk.no/sport/toppsaker.rss', cat: 'sport', lang: 'no' },
  { src: 'NRK Vestland', url: 'https://www.nrk.no/vestland/toppsaker.rss', region: 'Vestland', lang: 'no' },
  { src: 'NRK Trøndelag', url: 'https://www.nrk.no/trondelag/siste.rss', region: 'Trøndelag', lang: 'no' },
  { src: 'NRK Møre og Romsdal', url: 'https://www.nrk.no/mr/siste.rss', region: 'Møre og Romsdal', lang: 'no' },
  { src: 'NRK Nordland', url: 'https://www.nrk.no/nordland/siste.rss', region: 'Nordland', lang: 'no' },
  { src: 'NRK Troms', url: 'https://www.nrk.no/troms/siste.rss', region: 'Troms', lang: 'no' },
  { src: 'NRK Sørlandet', url: 'https://www.nrk.no/sorlandet/toppsaker.rss', region: 'Agder', lang: 'no' },
  { src: 'NRK Rogaland', url: 'https://www.nrk.no/rogaland/toppsaker.rss', region: 'Rogaland', lang: 'no' },
  { src: 'NRK Innlandet', url: 'https://www.nrk.no/innlandet/toppsaker.rss', region: 'Innlandet', lang: 'no' },
  { src: 'NRK Vestfold og Telemark', url: 'https://www.nrk.no/vestfoldogtelemark/toppsaker.rss', region: 'Telemark', lang: 'no' },
  { src: 'NRK Østlandssendingen', url: 'https://www.nrk.no/osloogviken/toppsaker.rss', region: 'Akershus', lang: 'no' },
  { src: 'NRK Finnmark', url: 'https://www.nrk.no/tromsogfinnmark/toppsaker.rss', region: 'Finnmark', lang: 'no' },
  { src: 'VG', url: 'https://www.vg.no/rss/feed', lang: 'no' },
  { src: 'Aftenposten', url: 'https://www.aftenposten.no/rss', lang: 'no' },
  { src: 'Dagbladet', url: 'https://www.dagbladet.no/rss', lang: 'no' },
  { src: 'E24', url: 'https://e24.no/rss2/', lang: 'no', cat: 'politikk' },
  // Verden
  { src: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', top: true, lang: 'en' },
  { src: 'The Guardian', url: 'https://www.theguardian.com/world/rss', lang: 'en' },
  { src: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en' },
  { src: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', lang: 'en' },
  { src: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world', lang: 'en' },
  { src: 'France 24', url: 'https://www.france24.com/en/rss', lang: 'en' },
  { src: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', lang: 'en' },
  { src: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml', lang: 'en' },
  // Naturhendelser med nøyaktige koordinater
  { src: 'USGS', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', type: 'usgs', cat: 'vaer', lang: 'no' },
  { src: 'GDACS', url: 'https://www.gdacs.org/xml/rss.xml', cat: 'vaer', lang: 'en' },
];
const MET_ALERTS = 'https://api.met.no/weatherapi/metalerts/2.0/current.json?lang=no';

// ---------- innstillinger ----------
let SETTINGS_FILE = null;
let settings = { deeplKey: '', translate: true, watch: [], customFeeds: [], dailyChars: 15000, usage: { day: '', chars: 0 } };
function loadSettings() { try { settings = { ...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }; } catch {} }
function saveSettings() { try { fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true }); fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch (e) { console.warn('Kunne ikke lagre innstillinger:', e.message); } }
const publicSettings = () => ({ hasKey: !!settings.deeplKey, translate: settings.translate, watch: settings.watch, customFeeds: settings.customFeeds,
  dailyChars: settings.dailyChars, usedToday: settings.usage.day === today() ? settings.usage.chars : 0 });
const today = () => new Date().toISOString().slice(0, 10);
const feeds = () => [...BUILTIN_FEEDS, ...settings.customFeeds.filter(f => /^https:\/\//.test(f.url)).map(f => ({ src: f.src || new URL(f.url).hostname, url: f.url, custom: true }))];

// ---------- steder ----------
// [navn, lat, lon, type, landkode]  type: c = by/sted, r = region/land, d = adjektiv/person (russisk, Putin …)
const PLACES = JSON.parse(fs.readFileSync(path.join(__dirname, 'places.json'), 'utf8'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RANK = { c: 0, r: 1, d: 2 };
const PLACE_RE = PLACES.map(p => ({ p, rank: RANK[p[3]], re: new RegExp(`(?<![\\p{L}\\-])${esc(p[0])}(?:s|'s|’s)?(?![\\p{L}])`, p[3] === 'd' ? 'iu' : 'u') }));
const loc = p => ({ place: p[0], lat: p[1], lon: p[2], cc: p[4] || null });

// Beste sted + alle land som nevnes (for buer mellom land)
function findPlaces(title, desc, region) {
  let best = null; const ccs = new Set();
  for (const [ti, text] of [title, desc].entries()) {
    if (!text) continue;
    let b = null;
    for (const { p, rank, re } of PLACE_RE) {
      const m = re.exec(text);
      if (!m) continue;
      if (p[4]) ccs.add(p[4]);
      if (!b || rank < b.rank || (rank === b.rank && (m.index < b.i || (m.index === b.i && p[0].length > b.p[0].length)))) b = { p, i: m.index, rank };
    }
    if (b && !best) best = b; // tittelen vinner over ingressen
    if (ti === 0 && best) continue;
  }
  let where = best ? loc(best.p) : null;
  if (!where && region) { const p = PLACES.find(x => x[0] === region); if (p) where = { ...loc(p), place: p[0] + ' (region)', approx: true }; }
  if (where && where.cc) ccs.add(where.cc);
  return { where, ccs: [...ccs].slice(0, 6) };
}
const findPlace = (t, d, r) => findPlaces(t, d, r).where;

// ---------- kategorier ----------
// "ord*" = alt som begynner på ordet, "ord" = bare hele ordet
const CAT_WORDS = {
  krim: 'drept drap* skutt skyting* knivstukket knivstikk* siktet* tiltalt* dømt* pågrep* politi* ran voldtekt* vold* ulykke* omkom* døde dødsulykke* brann* eksplosjon* savnet* leteaksjon* redningsaksjon* kollisjon* skadd* kriminell* narkotika* svindel* ' +
        'killed kill murder* shot shooting* stabb* arrest* charged convicted sentenced police crash* accident* fire blaze explosion* dead died missing rescue* injured gunman hostage* kidnap* trial',
  forsvar: 'forsvar* nato militær* soldat* krig* drone* rakett* angrep* hæren sjøforsvar* fregatt* kampfly* pst våpen* atomvåpen* invasjon* bombe* opprør* terror* våpenhvile* styrker* front* flykt* gissel* ' +
           'war military army troops missile* drone* airstrike* strike strikes attack* invasion* bomb* ceasefire defence defense nuclear rebel* militant* terror* soldier* weapon* fighting refugee* reinforce* border* flee* hostilit* front*',
  vaer: 'vær været uvær* storm* orkan* flom* ras skred* snø* regn* vind* farevarsel* met temperatur* varmerekord* kulde* hete* klima* tørke* jordskjelv* vulkan* tsunami* skogbrann* ' +
        'storm* hurricane* typhoon* cyclone* flood* earthquake* quake* wildfire* bushfire* heatwave* climate drought* volcan* tsunami* tornado* snow* landslide* weather',
  samferdsel: 'tog toget togene bane nor vy buss* ferje* fly flyet flyplass* avinor vei veien veier e6 e18 e39 e16 trafikk* tunnel* bru brua bro elsparkesyk* kø ' +
              'train* railway* rail flight* airline* airport* plane traffic road* ferry',
  kongehus: 'kong kongen dronning* kronprins* prinsesse* prins slottet kongehus* kongefamilie* king queen prince princess royal*',
  politikk: 'regjering* storting* statsminister* minister* statsråd* statsbudsjett* budsjett* parti* frp høyre ap sv krf venstre mdg rødt senterpartiet valg* skatt* rente* norges bank oljefond* økonomi* inflasjon* strømpris* avgift* lovforslag* eu toll* aksje* børs* ' +
            'election* president* minister* parliament* government* vote* voting tariff* economy econom* inflation interest rate* budget* congress senate summit* sanction* trade policy stocks market*',
  sport: 'fotball* ski langrenn* skiskyting* hopp alpin* håndball* vm ol landslag* eliteserien haaland ødegaard finale* cupfinale* medalje* gull sølv bronse sjakk* carlsen ' +
         'football soccer world cup olympic* tennis champions league premier league match goal* medal* tournament',
};
const CAT_RE = Object.fromEntries(Object.entries(CAT_WORDS).map(([k, words]) => [k,
  [...new Set(words.split(/\s+/))].filter(Boolean).map(w => new RegExp(`(?<![\\p{L}])${esc(w.replace('*', ''))}${w.endsWith('*') ? '' : '(?![\\p{L}])'}`, 'iu'))]));
const PRIORITY = ['vaer', 'krim', 'forsvar', 'samferdsel', 'kongehus', 'politikk', 'sport'];
function categorize(title, desc, feedCat) {
  if (feedCat) return feedCat;
  let best = 'annet', score = 0;
  for (const k of PRIORITY) {
    const s = CAT_RE[k].reduce((n, re) => n + (re.test(title) ? 2 : 0) + (re.test(desc) ? 1 : 0), 0);
    if (s > score) { best = k; score = s; }
  }
  return best;
}

// ---------- alvorlighet (0–10) ----------
const STRONG = /(?<![\p{L}])(massakre|terrorangrep|terror|eksplosjon|jordskjelv|tsunami|krig|invasjon|kupp|attentat|unntakstilstand|siste nytt|massacre|terror attack|explosion|earthquake|tsunami|invasion|coup|assassinat\w*|state of emergency|breaking|nuclear|atomvåpen|evakuer\w*|evacuat\w*|catastroph\w*|katastrof\w*)(?![\p{L}])/iu;
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozens: 24, hundreds: 200, thousands: 2000, en: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, sju: 7, åtte: 8, ni: 9, ti: 10, titalls: 24, hundrevis: 200, tusenvis: 2000 };
function severity(i) {
  if (i.mag != null) return Math.max(0, Math.min(10, (i.mag - 4.5) * 2.5 + (i.tsunami ? 3 : 0)));
  const text = i.title + ' ' + (i.desc || '');
  let s = 0;
  const num = w => { const raw = String(w).replace(/[\s.,]/g, ''); return /^\d+$/.test(raw) ? +raw : NUM[String(w).toLowerCase()] || 0; };
  let n = 0;
  for (const re of [/(\d[\d.,]*|[a-zæøå]+)\s+(?:[\p{L}-]+\s+){0,2}?(?:drept|døde|omkom|omkommet|killed|dead|died|deaths|bodies)(?![\p{L}])/giu,
                    /(?:kills?|killed|killing|dreper|drepte|omkom|dead)\s+(?:at least\s+|minst\s+|over\s+|nearly\s+)?(\d[\d.,]*|[a-zæøå]+)(?![\p{L}])/giu])
    for (const m of text.matchAll(re)) n = Math.max(n, num(m[1]));
  if (n) s += Math.min(5, Math.log10(n + 1) * 2.2);
  if (STRONG.test(text)) s += 2.5;
  if (i.alert === 'red') s += 5; else if (i.alert === 'orange') s += 3;
  return Math.min(10, +s.toFixed(1));
}

// ---------- gruppering av saker om samme hendelse ----------
const STOP = new Set('this that with from have will been were their after over into about than what when where which while would could says said says amid more most also just only first year years week news live update updates video watch over under være etter etter mellom eller blir ble skal kan vil ikke dette denne disse også både mens fordi under over mange flere sier sier mener nytt nyhet nyheter nrk'.split(' '));
const tokens = s => new Set((s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-zæøå0-9]{4,}/g)?.filter(w => !STOP.has(w)) || []);
function sameEvent(a, b) {
  const ta = a._tok, tb = b._tok; let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  const jac = shared / (ta.size + tb.size - shared || 1);
  const sameLand = a.cc && a.cc === b.cc;
  if (a.exact && b.exact) return Math.hypot(a.lat - b.lat, a.lon - b.lon) < 1.5 && Math.abs(new Date(a.date) - new Date(b.date)) < 3 * 3600e3;
  const samePlace = a.place && a.place === b.place && !a.approx && !b.approx && a.cat === b.cat && Math.abs(new Date(a.date) - new Date(b.date)) < 6 * 3600e3 && shared >= 1;
  return samePlace || jac >= 0.34 || (shared >= 3 && sameLand) || (shared >= 4);
}

// ---------- oversettelse (DeepL, valgfritt) ----------
const looksNorwegian = s => /[æøå]/i.test(s) || /(?<![\p{L}])(og|ikke|etter|blir|skal|med|på|til|som|har)(?![\p{L}])/iu.test(s);
async function translate(items) {
  if (!settings.translate || !settings.deeplKey || !items.length) return;
  if (settings.usage.day !== today()) settings.usage = { day: today(), chars: 0 };
  const todo = [];
  for (const i of items) { if (settings.usage.chars + i.title.length > settings.dailyChars) break; todo.push(i); settings.usage.chars += i.title.length; }
  const host = settings.deeplKey.trim().endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  for (let k = 0; k < todo.length; k += 50) {
    const batch = todo.slice(k, k + 50);
    try {
      const r = await fetch(host + '/v2/translate', { method: 'POST', headers: { Authorization: 'DeepL-Auth-Key ' + settings.deeplKey.trim(), 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ text: batch.map(i => i.title), target_lang: 'NB', source_lang: 'EN' }) });
      if (!r.ok) throw new Error('DeepL HTTP ' + r.status);
      const j = await r.json(); j.translations.forEach((t, n) => { batch[n].titleNo = t.text; });
      status.deepl = { src: 'DeepL', ok: true, n: batch.length };
    } catch (e) { status.deepl = { src: 'DeepL (oversettelse)', ok: false, err: e.message }; break; }
  }
  saveSettings();
}

// ---------- overvåkning ----------
function watchHits(n) {
  const text = [n.title, n.titleNo, n.text, n.place].filter(Boolean).join(' ');
  return settings.watch.filter(w => w && new RegExp(`(?<![\\p{L}])${esc(w.trim())}`, 'iu').test(text));
}

// ---------- RSS / RDF / GeoJSON ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;(?=[#a-z0-9]+;)/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))
      : (ENT[e] ?? m))
    .replace(/\s+/g, ' ').trim();
}
function tag(xml, name) { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : ''; }
function parseRss(xml) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(m => m[0]);
  const entries = items.length ? [] : [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(m => m[0]); // Atom
  return [...items, ...entries].map(item => {
    let link = decode(tag(item, 'link'));
    if (!link) { const m = item.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    const d = decode(tag(item, 'pubDate') || tag(item, 'dc:date') || tag(item, 'updated') || tag(item, 'published'));
    const out = { title: decode(tag(item, 'title')), link, desc: decode(tag(item, 'description') || tag(item, 'summary')).slice(0, 400), date: new Date(d || Date.now()).toISOString() };
    const pt = decode(tag(item, 'georss:point')).split(/\s+/).map(Number);
    const glat = +decode(tag(item, 'geo:lat')), glon = +decode(tag(item, 'geo:long'));
    if (pt.length === 2 && pt.every(isFinite)) { out.lat = pt[0]; out.lon = pt[1]; }
    else if (tag(item, 'geo:lat') && isFinite(glat) && isFinite(glon)) { out.lat = glat; out.lon = glon; }
    const alert = decode(tag(item, 'gdacs:alertlevel')).toLowerCase();
    if (alert) { out.alert = alert; if (alert === 'red' || alert === 'orange') out.top = true; if (alert === 'green') out.minor = true; }
    if (isNaN(new Date(out.date))) out.date = new Date().toISOString();
    return out;
  }).filter(i => i.title && /^https:\/\//.test(i.link));
}
function parseUsgs(json) {
  return (JSON.parse(json).features || []).map(f => {
    const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
    return { title: `Jordskjelv M${(+p.mag).toFixed(1)} – ${p.place || 'ukjent sted'}`, link: p.url, desc: `Magnitude ${(+p.mag).toFixed(1)}, dybde ${Math.round(depth)} km.${p.tsunami ? ' Tsunamivarsel utstedt.' : ''}`,
      date: new Date(p.time).toISOString(), lat, lon, top: p.mag >= 6 || !!p.tsunami, place: p.place, mag: +p.mag, tsunami: !!p.tsunami };
  }).filter(i => /^https:\/\//.test(i.link || ''));
}

// ---------- motor ----------
let news = [], DATA_FILE = null, alerts = { type: 'FeatureCollection', features: [] }, alertsAt = null;
let lastPoll = null, nextPoll = null, polling = false;
const status = {};
const clients = new Set();
const save = () => { if (!DATA_FILE) return; try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(news)); } catch (e) { console.warn('Kunne ikke lagre:', e.message); } };
function broadcast(event, data) { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const res of clients) res.write(msg); }

async function fetchFeed(feed) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(feed.url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const body = await r.text();
    const items = feed.type === 'usgs' ? parseUsgs(body) : parseRss(body);
    status[feed.url] = { src: feed.src, ok: true, n: items.length, custom: !!feed.custom };
    return items.map(i => ({ ...i, feed }));
  } catch (e) {
    status[feed.url] = { src: feed.src, ok: false, err: e.name === 'AbortError' ? 'tidsavbrudd' : e.message, custom: !!feed.custom };
    return [];
  } finally { clearTimeout(t); }
}

async function poll() {
  if (polling) return; polling = true;
  try {
    const list = feeds();
    for (const k of Object.keys(status)) if (k !== 'deepl' && k !== 'met' && !list.some(f => f.url === k)) delete status[k];
    const results = (await Promise.all(list.map(fetchFeed))).flat();
    const byId = new Map(news.map(n => [n.id, n]));
    const added = [];
    for (const i of results) {
      const id = i.link.split('?')[0].replace(/#.*$/, '');
      const old = byId.get(id);
      if (old) { if ((i.feed.top || i.top) && !old.top && !i.minor) old.top = true; continue; }
      const { where: found, ccs } = isFinite(i.lat) ? { where: null, ccs: findPlaces(i.title, i.desc).ccs } : findPlaces(i.title, i.desc, i.feed.region);
      let where = found;
      if (isFinite(i.lat) && isFinite(i.lon)) { where = { lat: i.lat, lon: i.lon, place: i.place || null, cc: null, exact: true }; if (!where.place) { const p = findPlace(i.title, i.desc); if (p) where.place = p.place; } }
      const lang = i.feed.lang || (looksNorwegian(i.title) ? 'no' : 'en');
      const n = {
        id, title: i.title, text: i.desc, url: i.link, date: i.date, src: i.feed.src, lang,
        cat: categorize(i.title, i.desc, i.feed.cat), top: !!(i.feed.top || i.top) && !i.minor,
        sev: severity(i), ccs, ...(where || {}),
      };
      byId.set(id, n); added.push(n);
    }
    await translate(added.filter(n => n.lang === 'en'));
    // grupper nye saker inn i hendelser
    const recent = [...byId.values()].filter(n => Date.now() - new Date(n.date) < 48 * 3600e3);
    for (const n of recent) if (!n._tok) n._tok = tokens(n.title + ' ' + (n.titleNo || '') + ' ' + (n.place || ''));
    for (const n of added) {
      if (!n._tok) n._tok = tokens(n.title + ' ' + (n.titleNo || '') + ' ' + (n.place || ''));
      n.watch = watchHits(n);
      let match = null; try { match = recent.find(o => o !== n && o.eid && o._tok && sameEvent(n, o)); } catch (e) { match = null; }
      n.eid = match ? match.eid : n.id;
    }
    const cutoff = Date.now() - KEEP_HOURS * 3600e3;
    const isFirst = !lastPoll && !news.length;
    news = [...byId.values()].filter(n => new Date(n.date) > cutoff).sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);
    for (const n of news) { if (!n.eid) n.eid = n.id; delete n._tok; }
    lastPoll = new Date(); nextPoll = new Date(Date.now() + POLL_MIN * 60e3);
    save();
    const ok = Object.values(status).filter(s => s.ok).length;
    console.log(`[${lastPoll.toLocaleTimeString('nb-NO')}] ${ok}/${Object.keys(status).length} kilder ok, ${added.length} nye, ${news.length} totalt`);
    broadcast('update', { added: added.map(a => a.id), news, lastPoll, nextPoll, status });
    if (!isFirst) {
      const fresh = added.filter(a => Date.now() - new Date(a.date) < 2 * 3600e3);
      const big = fresh.filter(a => (a.top && a.sev >= 2) || a.sev >= 5);
      const watched = fresh.filter(a => a.watch.length);
      if (big.length) events.emit('top', big);
      if (watched.length) events.emit('watch', watched);
    }
  } catch (e) {
    // en feil i én sak skal aldri stoppe henting: logg den og fortsett neste gang
    console.error('Feil under henting:', e);
    status.engine = { src: 'Nyhetsmotor', ok: false, err: String(e && e.message || e).slice(0, 160) };
    lastPoll = new Date(); nextPoll = new Date(Date.now() + POLL_MIN * 60e3);
    broadcast('update', { added: [], news, lastPoll, nextPoll, status });
  } finally { polling = false; }
}

async function pollAlerts() {
  try {
    const r = await fetch(MET_ALERTS, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    alerts = { type: 'FeatureCollection', features: (j.features || []).filter(f => f.geometry).map(f => {
      const p = f.properties || {}, lvl = String(p.awareness_level || '').split(';').map(s => s.trim());
      return { type: 'Feature', geometry: f.geometry, properties: { id: p.id || p.title, level: (lvl[1] || 'yellow').toLowerCase(), title: p.title || p.eventAwarenessName || 'Farevarsel',
        event: p.eventAwarenessName || p.event || '', area: p.area || '', desc: p.description || '', instruction: p.instruction || '', consequences: p.consequences || '',
        from: f.when && f.when.interval ? f.when.interval[0] : null, to: f.when && f.when.interval ? f.when.interval[1] : null } };
    }) };
    alertsAt = new Date(); status.met = { src: 'MET farevarsler', ok: true, n: alerts.features.length };
    broadcast('alerts', { n: alerts.features.length, at: alertsAt });
  } catch (e) { status.met = { src: 'MET farevarsler', ok: false, err: e.message }; }
}

// ---------- webserver ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function readBody(req) { return new Promise((res, rej) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } }); }); }
function start({ port = +process.env.PORT || 3000, dataDir = path.join(__dirname, 'data') } = {}) {
  DATA_FILE = path.join(dataDir, 'news.json'); SETTINGS_FILE = path.join(dataDir, 'settings.json');
  loadSettings();
  try { news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); for (const n of news) if (!n.eid) n.eid = n.id; } catch { news = []; }
  const pub = path.join(__dirname, 'public');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/news') return json({ news, lastPoll, nextPoll, pollMin: POLL_MIN, status });
    if (url.pathname === '/api/alerts') return json(alerts);
    if (url.pathname === '/api/settings' && req.method === 'GET') return json(publicSettings());
    if (url.pathname === '/api/settings' && req.method === 'POST') {
      try {
        const b = await readBody(req); const feedsBefore = JSON.stringify(settings.customFeeds);
        if (typeof b.deeplKey === 'string') settings.deeplKey = b.deeplKey.trim().slice(0, 100);
        if (typeof b.translate === 'boolean') settings.translate = b.translate;
        if (Array.isArray(b.watch)) settings.watch = b.watch.map(String).map(s => s.trim()).filter(Boolean).slice(0, 50);
        if (Array.isArray(b.customFeeds)) settings.customFeeds = b.customFeeds.filter(f => f && /^https:\/\//.test(f.url)).slice(0, 40).map(f => ({ src: String(f.src || '').slice(0, 40), url: String(f.url).slice(0, 300) }));
        if (isFinite(b.dailyChars)) settings.dailyChars = Math.max(1000, Math.min(200000, +b.dailyChars));
        saveSettings();
        for (const n of news) n.watch = watchHits(n);
        if (feedsBefore !== JSON.stringify(settings.customFeeds) || (b.deeplKey && settings.translate)) setTimeout(poll, 100);
        broadcast('update', { added: [], news, lastPoll, nextPoll, status });
        return json(publicSettings());
      } catch (e) { return json({ error: e.message }, 400); }
    }
    if (url.pathname === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${JSON.stringify({ lastPoll, nextPoll })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (url.pathname === '/api/refresh' && req.method === 'POST') { poll(); pollAlerts(); res.writeHead(202); return res.end(); }
    const file = path.normalize(path.join(pub, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(pub)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Ikke funnet'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      console.log(`Nyhetskloden kjører på http://localhost:${actual}  (henter hvert ${POLL_MIN}. minutt)`);
      poll(); pollAlerts();
      setInterval(poll, POLL_MIN * 60e3); setInterval(pollAlerts, 10 * 60e3);
      resolve(actual);
    });
  });
}

module.exports = { start, poll, events, parseRss, parseUsgs, findPlace, findPlaces, categorize, severity, tokens, sameEvent };
if (require.main === module) start();
