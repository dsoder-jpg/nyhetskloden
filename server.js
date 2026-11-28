// Nyhetskloden – nyhetsmotor og lokal webserver (v3)
// Henter nyhetsfeeder hvert 5. minutt, grupperer saker om samme hendelse, gir dem en
// viktighetsscore, finner sted og land, oversetter engelske titler (valgfritt, DeepL),
// sjekker overvåkede ord, henter farevarsler fra MET og sender alt til appen i sanntid (SSE).
// Brukes av Electron-appen (main.js), men kan også kjøres alene: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const os = require('os');
const crypto = require('crypto');
const X = require('./extras');
const READER = require('./reader');
const LOCAL = require('./local');
const MORE = require('./more');

const events = new EventEmitter();
const POLL_MIN = +process.env.POLL_MIN || 5;
const KEEP_HOURS = +process.env.KEEP_HOURS || 168; // 7 dager, så tidslinjen kan spille av uka
const MAX_ITEMS = 5000;
const UA = 'Nyhetskloden/3.0 (privat hobbyapp)';

// lang: språket i feeden (no/en/sv/da; bare en oversettes). top: toppsaker. region: reserveplassering.
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
  { src: 'Dagbladet', url: 'https://www.dagbladet.no/?lab_viewport=rss', lang: 'no' },
  { src: 'Faktisk.no', url: 'https://www.faktisk.no/?lab_viewport=rss', lang: 'no' },
  { src: 'Regjeringen', url: 'https://www.regjeringen.no/no/rss/Rss/2581966/?documentType=aktuelt/nyheter', lang: 'no', cat: 'politikk' },
  { src: 'Stortinget', url: 'https://www.stortinget.no/no/Stottemeny/RSS/Stortingsvedtak/', lang: 'no', cat: 'politikk' },
  { src: 'E24', url: 'https://e24.no/rss2/', lang: 'no', cat: 'marked' },
  { src: 'NRK Kultur', url: 'https://www.nrk.no/kultur/toppsaker.rss', lang: 'no', cat: 'kultur' },
  // Verden
  { src: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', top: true, lang: 'en' },
  { src: 'The Guardian', url: 'https://www.theguardian.com/world/rss', lang: 'en' },
  { src: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en' },
  { src: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', lang: 'en' },
  { src: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world', lang: 'en' },
  { src: 'France 24', url: 'https://www.france24.com/en/rss', lang: 'en' },
  { src: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', lang: 'en' },
  { src: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml', lang: 'en' },
  // flere verdenskilder, så Norge ikke dominerer
  { src: 'BBC Afrika', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', lang: 'en' },
  { src: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', lang: 'en' },
  { src: 'BBC Latin-Amerika', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', lang: 'en' },
  { src: 'BBC Midtøsten', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', lang: 'en' },
  { src: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/world', lang: 'en' },
  { src: 'ABC News', url: 'https://abcnews.go.com/abcnews/internationalheadlines', lang: 'en' },
  { src: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/world', lang: 'en' },
  { src: 'CBC', url: 'https://rss.cbc.ca/lineup/world.xml', lang: 'en' },
  { src: 'The Independent', url: 'https://www.independent.co.uk/news/world/rss', lang: 'en' },
  { src: 'Euronews', url: 'https://www.euronews.com/rss?level=theme&name=news', lang: 'en' },
  { src: 'Politico Europe', url: 'https://www.politico.eu/feed/', lang: 'en' },
  { src: 'Le Monde', url: 'https://www.lemonde.fr/en/rss/une.xml', lang: 'en' },
  { src: 'RFI', url: 'https://www.rfi.fr/en/rss', lang: 'en' },
  { src: 'Kyiv Independent', url: 'https://kyivindependent.com/news-archive/rss/', lang: 'en' },
  { src: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', lang: 'en' },
  { src: 'AllAfrica', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', lang: 'en' },
  { src: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', lang: 'en' },
  { src: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', lang: 'en' },
  { src: 'CNA', url: 'https://www.channelnewsasia.com/rssfeeds/8395884', lang: 'en' },
  { src: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/', lang: 'en' },
  { src: 'Yonhap', url: 'https://en.yna.co.kr/RSS/news.xml', lang: 'en' },
  { src: 'ABC Australia', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', lang: 'en' },
  { src: 'MercoPress', url: 'https://en.mercopress.com/rss/', lang: 'en' },
  { src: 'SVT', url: 'https://www.svt.se/nyheter/rss.xml', lang: 'sv' },
  { src: 'DR', url: 'https://www.dr.dk/nyheder/service/feeds/allenyheder', lang: 'da' },
  { src: 'Yle', url: 'https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_NEWS', lang: 'en' },
  // 3.6: flere kilder. Kilder som ikke virker settes på pause av seg selv og vises under Innstillinger → Kilder.
  { src: 'Nettavisen', url: 'https://www.nettavisen.no/service/rss', lang: 'no' },
  { src: 'Bergens Tidende', url: 'https://www.bt.no/rss', lang: 'no' },
  { src: 'Stavanger Aftenblad', url: 'https://www.aftenbladet.no/rss', lang: 'no' },
  { src: 'Adresseavisen', url: 'https://www.adressa.no/rss', lang: 'no' },
  { src: 'iTromsø', url: 'https://www.itromso.no/rss', lang: 'no' },
  { src: 'Forskning.no', url: 'https://forskning.no/rss', lang: 'no', cat: 'vitenskap' },
  { src: 'Digi.no', url: 'https://www.digi.no/rss', lang: 'no', cat: 'teknologi' },
  { src: 'NRK Urix', url: 'https://www.nrk.no/urix/toppsaker.rss', lang: 'no' },
  { src: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/world', lang: 'en' },
  { src: 'CNBC', url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', lang: 'en' },
  { src: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/world.xml', lang: 'en' },
  { src: 'Los Angeles Times', url: 'https://www.latimes.com/world-nation/rss2.0.xml', lang: 'en' },
  { src: 'Axios', url: 'https://api.axios.com/feed/', lang: 'en' },
  { src: 'Financial Times', url: 'https://www.ft.com/world?format=rss', lang: 'en' },
  { src: 'The Economist', url: 'https://www.economist.com/international/rss.xml', lang: 'en' },
  { src: 'Euractiv', url: 'https://www.euractiv.com/feed/', lang: 'en' },
  { src: 'The Moscow Times', url: 'https://www.themoscowtimes.com/rss/news', lang: 'en' },
  { src: 'Meduza', url: 'https://meduza.io/rss/en/all', lang: 'en' },
  { src: 'Notes from Poland', url: 'https://notesfrompoland.com/feed/', lang: 'en' },
  { src: 'Balkan Insight', url: 'https://balkaninsight.com/feed/', lang: 'en' },
  { src: 'Arab News', url: 'https://www.arabnews.com/rss.xml', lang: 'en' },
  { src: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', lang: 'en' },
  { src: 'Anadolu', url: 'https://www.aa.com.tr/en/rss/default?cat=world', lang: 'en' },
  { src: 'Dawn', url: 'https://www.dawn.com/feeds/home', lang: 'en' },
  { src: 'The Hindu', url: 'https://www.thehindu.com/news/international/feeder/default.rss', lang: 'en' },
  { src: 'NDTV', url: 'https://feeds.feedburner.com/ndtvnews-world-news', lang: 'en' },
  { src: 'The Straits Times', url: 'https://www.straitstimes.com/news/world/rss.xml', lang: 'en' },
  { src: 'Taipei Times', url: 'https://www.taipeitimes.com/xml/index.rss', lang: 'en' },
  { src: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss/feed/nar', lang: 'en' },
  { src: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/world.xml', lang: 'en' },
  { src: 'RNZ', url: 'https://www.rnz.co.nz/rss/world.xml', lang: 'en' },
  { src: 'The Guardian Australia', url: 'https://www.theguardian.com/australia-news/rss', lang: 'en' },
  { src: 'Premium Times', url: 'https://www.premiumtimesng.com/feed', lang: 'en' },
  { src: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/dmrss/', lang: 'en' },
  { src: 'The East African', url: 'https://www.theeastafrican.co.ke/rss.xml', lang: 'en' },
  { src: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/feed/', lang: 'en' },
  { src: 'Buenos Aires Times', url: 'https://www.batimes.com.ar/feed', lang: 'en' },
  { src: 'Rio Times', url: 'https://www.riotimesonline.com/feed/', lang: 'en' },
  // Temaer
  { src: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en', cat: 'marked' },
  { src: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', lang: 'en', cat: 'teknologi' },
  { src: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', lang: 'en', cat: 'teknologi' },
  { src: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', lang: 'en', cat: 'teknologi' },
  { src: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', lang: 'en', cat: 'vitenskap' },
  { src: 'NASA', url: 'https://www.nasa.gov/feed/', lang: 'en', cat: 'vitenskap' },
  { src: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', lang: 'en', cat: 'helse' },
  { src: 'STAT News', url: 'https://www.statnews.com/feed/', lang: 'en', cat: 'helse' },
  { src: 'BBC Entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', lang: 'en', cat: 'kultur' },
  // Naturhendelser med nøyaktige koordinater
  { src: 'USGS', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', type: 'usgs', cat: 'vaer', lang: 'no' },
  { src: 'GDACS', url: 'https://www.gdacs.org/xml/rss_24h.xml', cat: 'vaer', lang: 'en' },
];
const MET_ALERTS = 'https://api.met.no/weatherapi/metalerts/2.0/current.json?lang=no';

// ---------- innstillinger ----------
let SETTINGS_FILE = null;
const DEFAULTS = { deeplKey: '', translate: true, watch: [], customFeeds: [], dailyChars: 15000, usage: { day: '', chars: 0 },
  pollMin: POLL_MIN, keepHours: KEEP_HOURS, disabledFeeds: [],
  notify: true, notifyMode: 'big', notifyWatch: true, sound: true, quiet: { on: false, from: 23, to: 7 },
  closeToTray: true, tickerAtStart: false, tickerPos: 'top', tickerSpeed: 1, autoInstall: true, channel: 'stable', onboarded: false, widget: false, widgetOnTop: false,
  catsOff: [], home: null, nearKm: 50, digest: true, digestTime: '07:00',
  features: { market: true, movers: true, marketGlobe: true, tickersInNews: true, weather: true, near: true, flights: false, ships: false, wxmap: true, radar: false, quakes: true, storms: true, lights: true, power: true, traffic: false, images: true, nightImg: true, spin: true, localNews: true, calendar: true, powerSave: false, powerAuto: true, heatArchive: false, fires: false, aurora: false, shakemap: true, airQuality: false, airports: false, varsom: true },
  datex: { user: '', pass: '' },
  muteWords: [], hiddenSrc: [], notifyCats: null, notifyFollow: true, notifyGroup: true, followEids: [],
  srcLists: [], portfolio: [], trades: [], mapHideCats: [], powerAlerts: true, powerZone: null, powerCheap: 0.3, powerDear: 2.5, auroraAlerts: true, notifyNewsweb: true, bigSound: 'chime', widgetShow: ['weather', 'top'], hotkey: 'CommandOrControl+Shift+N', localPaper: null, notifyWeekly: true, notifyCal: true, priceAlerts: true, priceAlertPct: 5, notifyDown: true,
  marketWatch: ['EQNR.OL', 'KOG.OL', 'NVDA'], ships: { clientId: '', clientSecret: '' }, lan: false, lanToken: '' };
let settings = JSON.parse(JSON.stringify(DEFAULTS));
function loadSettings() { try { const s = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); settings = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...s, quiet: { ...DEFAULTS.quiet, ...(s.quiet || {}) }, features: { ...DEFAULTS.features, ...(s.features || {}) }, ships: { ...DEFAULTS.ships, ...(s.ships || {}) }, datex: { ...DEFAULTS.datex, ...(s.datex || {}) } }; } catch {} }
const derivePortfolio = () => X.holdings(settings.trades).filter(h => h.open).map(h => ({ sym: h.sym, qty: h.qty, price: +h.price.toFixed(6) }));
function saveSettings() { try { fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true }); fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); } catch (e) { console.warn('Kunne ikke lagre innstillinger:', e.message); } }
const publicSettings = () => {
  const { deeplKey, usage, ships, lanToken, datex, ...rest } = settings;
  return { ...rest, datexUser: datex && datex.user || '', hasDatexPass: !!(datex && datex.pass), hasKey: !!deeplKey, usedToday: usage.day === today() ? usage.chars : 0,
    shipsClient: ships.clientId || '', hasShipsSecret: !!ships.clientSecret, lanUrls: lanUrls(),
    builtinFeeds: BUILTIN_FEEDS.map(f => ({ url: f.url, src: f.src, lang: f.lang, cat: f.cat || null })) };
};
const clampNum = (v, lo, hi, d) => { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
function applySettings(b) {
  if (typeof b.deeplKey === 'string') settings.deeplKey = b.deeplKey.trim().slice(0, 100);
  for (const k of ['translate', 'notify', 'notifyWatch', 'sound', 'closeToTray', 'tickerAtStart', 'autoInstall', 'onboarded', 'notifyFollow', 'notifyGroup', 'widget', 'widgetOnTop', 'priceAlerts', 'notifyDown', 'notifyWeekly', 'notifyCal', 'powerAlerts', 'auroraAlerts', 'notifyNewsweb']) if (typeof b[k] === 'boolean') settings[k] = b[k];
  if (b.datex && typeof b.datex === 'object') {
    if (typeof b.datex.user === 'string') settings.datex.user = b.datex.user.trim().slice(0, 100);
    if (typeof b.datex.pass === 'string' && b.datex.pass) settings.datex.pass = b.datex.pass.slice(0, 200);
    if (b.datex.clear) settings.datex = { user: '', pass: '' };
  }
  if (b.channel === 'stable' || b.channel === 'beta') { const was = settings.channel; settings.channel = b.channel; if (was !== b.channel) setTimeout(() => events.emit('channel', b.channel), 50); }
  if (Array.isArray(b.watch)) settings.watch = [...new Set(b.watch.map(String).map(s => s.trim()).filter(Boolean))].slice(0, 50);
  if (Array.isArray(b.customFeeds)) settings.customFeeds = b.customFeeds.filter(f => f && /^https:\/\//.test(f.url)).slice(0, 40).map(f => ({ src: String(f.src || '').slice(0, 40), url: String(f.url).slice(0, 300) })).filter((f, i, a) => a.findIndex(x => x.url === f.url) === i);
  if (Array.isArray(b.disabledFeeds)) settings.disabledFeeds = b.disabledFeeds.map(String).slice(0, 100);
  if (b.dailyChars != null) settings.dailyChars = clampNum(b.dailyChars, 1000, 200000, settings.dailyChars);
  if (b.pollMin != null) settings.pollMin = clampNum(b.pollMin, 1, 60, settings.pollMin);
  if (b.keepHours != null) settings.keepHours = clampNum(b.keepHours, 6, 336, settings.keepHours);
  if (['big', 'top', 'watch'].includes(b.notifyMode)) settings.notifyMode = b.notifyMode;
  if (b.quiet && typeof b.quiet === 'object') settings.quiet = { on: !!b.quiet.on, from: clampNum(b.quiet.from, 0, 23, 23), to: clampNum(b.quiet.to, 0, 23, 7) };
  if (['top', 'bottom'].includes(b.tickerPos)) settings.tickerPos = b.tickerPos;
  if (b.tickerSpeed != null) settings.tickerSpeed = clampNum(b.tickerSpeed, 0.3, 3, 1);
  const CATS = ['krim', 'forsvar', 'politikk', 'marked', 'teknologi', 'helse', 'vitenskap', 'energi', 'vaer', 'samferdsel', 'kongehus', 'kultur', 'sport', 'annet'];
  if (Array.isArray(b.catsOff)) settings.catsOff = b.catsOff.filter(c => CATS.includes(c));
  if (b.notifyCats === null) settings.notifyCats = null; else if (Array.isArray(b.notifyCats)) settings.notifyCats = b.notifyCats.filter(c => CATS.includes(c));
  if (Array.isArray(b.muteWords)) settings.muteWords = [...new Set(b.muteWords.map(w => String(w).trim().toLowerCase()).filter(w => w.length >= 2))].slice(0, 100).map(w => w.slice(0, 40));
  if (Array.isArray(b.hiddenSrc)) settings.hiddenSrc = [...new Set(b.hiddenSrc.map(String))].slice(0, 100).map(w => w.slice(0, 60));
  if (Array.isArray(b.followEids)) settings.followEids = [...new Set(b.followEids.map(String).filter(x => /^https?:\/\//.test(x)))].slice(-100);
  if (Array.isArray(b.srcLists)) settings.srcLists = b.srcLists.filter(l => l && typeof l.name === 'string' && l.name.trim() && Array.isArray(l.srcs)).slice(0, 20)
    .map(l => ({ name: l.name.trim().slice(0, 40), srcs: [...new Set(l.srcs.map(String))].slice(0, 200).map(x => x.slice(0, 60)) })).filter((l, i, a) => a.findIndex(x => x.name === l.name) === i);
  const okSym = x => /^[A-Z0-9^.=\-]{1,15}$/.test(String(x || '').toUpperCase());
  // gammel form: hele beholdningen per aksje (blir ett kjøp uten dato)
  if (Array.isArray(b.portfolio)) {
    const list = b.portfolio.filter(h => h && okSym(h.sym) && +h.qty > 0).slice(0, 50).map(h => ({ sym: String(h.sym).toUpperCase(), qty: clampNum(h.qty, 0, 1e9, 0), price: clampNum(h.price, 0, 1e9, 0) }));
    settings.trades = list.map((h, i) => ({ id: 'p' + Date.now().toString(36) + i, sym: h.sym, side: 'buy', qty: h.qty, price: h.price, date: null }));
  }
  if (Array.isArray(b.trades)) settings.trades = b.trades.filter(t => t && okSym(t.sym) && +t.qty > 0).slice(0, 500).map((t, i) => ({
    id: String(t.id || 't' + Date.now().toString(36) + i).slice(0, 24), sym: String(t.sym).toUpperCase(), side: t.side === 'sell' ? 'sell' : 'buy',
    qty: clampNum(t.qty, 0, 1e9, 0), price: clampNum(t.price, 0, 1e9, 0), date: /^\d{4}-\d\d-\d\d$/.test(t.date || '') ? t.date : null }));
  if (Array.isArray(b.portfolio) || Array.isArray(b.trades)) settings.portfolio = derivePortfolio();
  if (Array.isArray(b.mapHideCats)) settings.mapHideCats = b.mapHideCats.map(String).filter(k => /^[a-z]{2,20}$/.test(k)).slice(0, 20);
  if (b.powerZone === null || /^NO[1-5]$/.test(b.powerZone || '')) settings.powerZone = b.powerZone || null;
  if (b.powerCheap != null) settings.powerCheap = clampNum(b.powerCheap, 0, 10, 0.3);
  if (b.powerDear != null) settings.powerDear = clampNum(b.powerDear, 0, 20, 2.5);
  if (typeof b.hotkey === 'string' && (b.hotkey === '' || /^(CommandOrControl|Ctrl|Alt|Shift|Super)(\+(CommandOrControl|Ctrl|Alt|Shift|Super))*\+[A-Z0-9]$/.test(b.hotkey))) settings.hotkey = b.hotkey;
  if (Array.isArray(b.widgetShow)) settings.widgetShow = b.widgetShow.filter(k => ['weather', 'top', 'power', 'portfolio', 'market', 'calendar'].includes(k));
  if (['off', 'chime', 'alarm', 'system'].includes(b.bigSound)) settings.bigSound = b.bigSound;
  if (b.priceAlertPct != null) settings.priceAlertPct = clampNum(b.priceAlertPct, 1, 50, 5);
  if (b.home === null) settings.home = null;
  else if (b.home && isFinite(b.home.lat) && isFinite(b.home.lon)) settings.home = { name: String(b.home.name || '').slice(0, 60), lat: +b.home.lat, lon: +b.home.lon };
  if (b.nearKm != null) settings.nearKm = clampNum(b.nearKm, 5, 500, 50);
  if (typeof b.digest === 'boolean') settings.digest = b.digest;
  if (/^\d{2}:\d{2}$/.test(b.digestTime || '')) settings.digestTime = b.digestTime;
  if (b.features && typeof b.features === 'object') for (const [k, v] of Object.entries(b.features)) if (k in settings.features && typeof v === 'boolean') settings.features[k] = v;
  if (Array.isArray(b.marketWatch)) { settings.marketWatch = [...new Set(b.marketWatch.map(s => String(s).trim().toUpperCase()).filter(s => /^[A-Z0-9^.=\-]{1,15}$/.test(s)))].slice(0, 30); X.resetMarket(); }
  if (b.ships && typeof b.ships === 'object') { if (typeof b.ships.clientId === 'string') settings.ships.clientId = b.ships.clientId.trim().slice(0, 120); if (typeof b.ships.clientSecret === 'string') settings.ships.clientSecret = b.ships.clientSecret.trim().slice(0, 200); X.resetShips(); }
  if (typeof b.lan === 'boolean') { settings.lan = b.lan; if (b.lan && !settings.lanToken) settings.lanToken = crypto.randomBytes(9).toString('base64url'); setLan(); }
  if (b.newLanToken) { settings.lanToken = crypto.randomBytes(9).toString('base64url'); }
  saveSettings(); events.emit('settings', settings);
}
// ---------- mobil på samme nett (LAN) ----------
const LAN_PORT = 37852;
let lanServer = null, mainHandler = null;
function lanIps() { return Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address)).map(i => i.address); }
function lanUrls() { return settings.lan && lanServer && settings.lanToken ? lanIps().map(ip => `http://${ip}:${LAN_PORT}/?t=${settings.lanToken}`) : []; }
function setLan() {
  if (settings.lan && !lanServer && mainHandler) {
    lanServer = http.createServer((req, res) => mainHandler(req, res, true));
    lanServer.on('error', e => { console.warn('Mobilvisning kunne ikke starte:', e.message); lanServer = null; status.lan = { src: 'Mobilvisning', ok: false, err: e.message }; });
    lanServer.listen(LAN_PORT, '0.0.0.0', () => { status.lan = { src: 'Mobilvisning', ok: true, n: lanIps().length }; });
  } else if (!settings.lan && lanServer) { lanServer.close(); lanServer = null; delete status.lan; }
}
const today = () => new Date().toISOString().slice(0, 10);
const localFeed = () => { const lp = settings.localPaper; return settings.features.localNews !== false && lp && lp.url && !settings.disabledFeeds.includes(lp.url) ? [{ src: lp.name, url: lp.url, lang: 'no', local: true }] : []; };
const feeds = () => [...BUILTIN_FEEDS.filter(f => !settings.disabledFeeds.includes(f.url)), ...localFeed(), ...settings.customFeeds.filter(f => !settings.disabledFeeds.includes(f.url)).filter(f => /^https:\/\//.test(f.url)).map(f => ({ src: f.src || new URL(f.url).hostname, url: f.url, custom: true }))];

// ---------- steder ----------
// [navn, lat, lon, type, landkode]  type: c = by/sted, r = region/land, d = adjektiv/person (russisk, Putin …)
const PLACES = JSON.parse(fs.readFileSync(path.join(__dirname, 'places.json'), 'utf8'));
const BASE_PLACES = 1873;
// kommune-/stedsnavn i Norge → koordinater (for varsler fra NVE)
const placeNO = name => { const n = String(name || '').split(/[,(]/)[0].trim().toLowerCase(); const p = PLACES.find(x => x[4] === 'NO' && x[0].toLowerCase() === n); return p ? { lat: p[1], lon: p[2] } : null; }; // de første oppføringene er verdens byer, resten er norske tettsteder (lagt til i 3.3)
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RANK = { c: 0, r: 1, d: 2 };
const PLACE_RE = PLACES.map(p => ({ p, rank: RANK[p[3]], first: p[0].split(/[\s\-/]/)[0], re: new RegExp(`(?<![\\p{L}\\-])${esc(p[0])}(?:s|'s|’s)?(?![\\p{L}])`, p[3] === 'd' ? 'iu' : 'u') }));
// Raskt forfilter: et sted med stor forbokstav kan bare finnes hvis første ord står i teksten
const wordSet = text => { const w = new Set(); for (const m of text.matchAll(/[\p{L}][\p{L}.'’]*/gu)) { const x = m[0].replace(/[.'’]+$/, ''); w.add(m[0]); w.add(x); w.add(x.replace(/(?:'s|’s|s)$/, '')); } return w; };
// Land-navn på norsk (første r-oppføring per landkode). Personer og adjektiver (Putin, russisk) vises som landet.
const COUNTRY = {};
for (const p of PLACES) if (p[3] === 'r' && p[4] && !COUNTRY[p[4]]) COUNTRY[p[4]] = p;
COUNTRY.PS = ['Palestina', ...COUNTRY.PS?.slice(1) || [31.9, 35.2, 'r', 'PS']];
const loc = p => {
  // engelske landnavn (Norway, Russia) og personer vises med norsk landnavn
  if (p[4] && COUNTRY[p[4]] && (p[3] === 'd' || (p[3] === 'r' && p[1] === COUNTRY[p[4]][1] && p[2] === COUNTRY[p[4]][2]))) { const c = COUNTRY[p[4]]; return { place: c[0], lat: c[1], lon: c[2], cc: p[4] }; }
  return { place: p[0], lat: p[1], lon: p[2], cc: p[4] || null };
};
// Stedsnavn som også er vanlige personnavn eller navn på ting: hopp over når de står sammen med et annet navn
// («Michael Jordan», «Paris Hilton», «Washington Post»).
const AMBIG = new Set(['Jordan', 'Paris', 'Georgia', 'Victoria', 'Florence', 'Hamilton', 'Lincoln', 'Kennedy', 'Chelsea', 'Phoenix', 'Austin', 'Dallas', 'Houston', 'Orlando', 'Charlotte', 'Sydney', 'Adelaide', 'Washington', 'Jackson', 'Madison', 'Columbia', 'Santiago', 'Cuba', 'Chad', 'Niger', 'Mali', 'Bergen', 'Moss', 'Lier', 'Gran', 'Nome', 'Vega', 'Luster']);
const NAMEY = /\p{Lu}[\p{Ll}'’.-]+\s+$/u, NAMEY_AFTER = /^(?:s|'s|’s)?\s+\p{Lu}[\p{Ll}]/u;
function personLike(text, m, name) {
  if (!AMBIG.has(name)) return false;
  const before = text.slice(Math.max(0, m.index - 25), m.index), after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
  const prevWord = (before.match(/(\S+)\s+$/) || [])[1] || '';
  if (NAMEY.test(before) && !/^(i|in|to|from|til|fra|ved|near|nær|of|av|at|på|around|outside|utenfor|nord|sør|øst|vest|north|south|east|west|central|greater|sentrale|New|Nye|Sankt|San|St\.?|Lake|Port|Fort|Mount)$/i.test(prevWord) && /\p{Lu}/u.test(prevWord[0] || '')) return true;
  if (NAMEY_AFTER.test(after) && !/^(?:s|'s|’s)?\s+(?:Airport|Lufthavn|County|State|Street|Square|City)/.test(after)) return true;
  return false;
}

// Beste sted + alle land som nevnes (for buer mellom land)
function findPlaces(title, desc, region) {
  let best = null; const ccs = new Set();
  for (const [ti, text] of [title, desc].entries()) {
    if (!text) continue;
    let b = null; const ws = wordSet(text);
    for (const { p, rank, re, first } of PLACE_RE) {
      if (p[3] !== 'd' && !ws.has(first)) continue;
      const m = re.exec(text);
      if (!m || personLike(text, m, p[0])) continue;
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
        'killed kill murder* shot shooting* stabb* arrest* charged convicted sentenced police crash* accident* blaze house_fire fire_at fire_in fire_destroys fire_kills firefighter* explosion* dead died missing rescue* injured gunman hostage* kidnap* trial',
  forsvar: 'forsvar* nato militær* soldat* krig* drone* rakett* angrep* hæren sjøforsvar* fregatt* kampfly* pst våpen* atomvåpen* invasjon* bombe* opprør* terror* våpenhvile* styrker* front* flykt* gissel* ' +
           'war military army troops missile* drone* airstrike* drone_strike* missile_strike* attack* invasion* bomb* ceasefire defence defense nuclear rebel* militant* terror* soldier* weapon* fighting refugee* reinforce* border* flee* hostilit* front* trade_fire exchange_fire shelling artillery gunfire skuddveksling* skyter_mot',
  vaer: 'vær været uvær* storm* orkan* flom* ras skred* snø* regn* vind* farevarsel* met temperatur* varmerekord* kulde* hete* klima* tørke* jordskjelv* vulkan* tsunami* skogbrann* ' +
        'storm* hurricane* typhoon* cyclone* flood* earthquake* quake* wildfire* bushfire* heatwave* climate drought* volcan* tsunami* tornado* snow* landslide* weather',
  samferdsel: 'tog toget togene bane nor vy buss* ferje* fly flyet flyplass* avinor vei veien veier e6 e18 e39 e16 trafikk* tunnel* bru brua bro elsparkesyk* kø ' +
              'train* railway* rail flight* airline* airport* plane traffic road* ferry',
  kongehus: 'kong kongen dronning* kronprins* prinsesse* prins slottet kongehus* kongefamilie* king queen prince princess royal*',
  politikk: 'regjering* storting* statsminister* minister* statsråd* statsbudsjett* budsjett* parti* frp høyre ap sv krf venstre mdg rødt senterpartiet valg* skatt* norges_bank oljefond* økonomi* avgift* lovforslag* eu toll* ' +
            'election* president* minister* parliament* government* vote* voting tariff* economy econom* inflation interest_rate* budget* congress senate summit* sanction* trade_policy meets talks diplomat* treaty strike strikes walkout union* streik* lockout møte* møtes samtaler* diplomat*',
  marked: 'aksje* børs* oslo_børs osebx kurs* kursfall* kurshopp* kvartalsresultat* kvartalstall* utbytte* rente* renteheving* rentekutt* valuta* kronekurs* dollar* euro euroen inflasjon* finans* bank* investor* fond* bitcoin krypto* gullpris* oljepris* brent strømpris* konkurs* ' +
          'stock* shares market* earnings profit* revenue* investor* nasdaq dow s&p wall_street interest_rate* currency bitcoin crypto* ipo merger* acquisition* bank* gold_price* oil_price* bankrupt*',
  teknologi: 'teknologi* ki kunstig_intelligens chatbot* app appen apper apple google microsoft openai anthropic nvidia smarttelefon* mobiltelefon* datasenter* hack* dataangrep* cyber* robot* software programvare* mikrobrikke* ' +
             'technology tech ai artificial_intelligence chatbot* smartphone* iphone android software hack* hacker* cyber* robot* chip* semiconductor* startup*',
  helse: 'helse* sykehus* lege* legevakt* sykdom* virus* vaksine* kreft* pandemi* utbrudd* smitte* fhi medisin* pasient* psykisk* ' +
         'health hospital* doctor* disease* virus* vaccine* cancer pandemic* outbreak* infection* who medicine* patient* mental_health',
  vitenskap: 'forsk* forsker* forskning* romfart* nasa esa romferd* rakett* oppskyting* astronaut* planet* månen mars teleskop* fossil* oppdag* ' +
             'science scientist* research* space spacecraft rocket* rocket_launch space_launch astronaut* planet* moon mars telescope* fossil* archaeolog* species study_finds',
  energi: 'energi* strømmen strømnett* strømbrudd* strømstøtte* kraftpris* kraftverk* kraftselskap* kraftproduksjon* kraftlinje* olje* oljefelt* gass* gassrør* vindkraft* vindmølle* havvind* solkraft* solcelle* vannkraft* atomkraft* opec equinor elbil* batteri* ' +
          'energy oil gas opec renewable* wind_power solar nuclear power electricity grid battery batteries',
  kultur: 'kultur* film* musikk* konsert* festival* artist* bok* forfatter* teater* kjendis* tv-serie* serie* spillfilm* kino* eurovision mgp ' +
          'film movie* music album* concert* festival* celebrit* actor* actress* oscar* grammy* eurovision book* author* theatre theater',
  sport: 'fotball* ski langrenn* skiskyting* skihopp* alpin* håndball* vm ol em nm landslag* eliteserie* obos-liga* toppserie* haaland ødegaard klæbo johaug warholm finale* cupfinale* semifinale* medalje* sølv bronse sjakk* carlsen kamp kampen seier* scoret* scoring* målet trener* tippeligaen rosenborg vålerenga lillestrøm bodø/glimt glimt strømsgodset sarpsborg haugesund kristiansund fredrikstad hamkam tromsø il ' +
         'football soccer world_cup olympic* tennis champions_league premier_league europa_league match goal* medal* tournament nba nfl formula_1 f1 grand_prix golf cricket rugby boxing ufc liverpool arsenal chelsea manchester_united manchester_city real_madrid barcelona bayern juventus psg',
};
const CAT_RE = Object.fromEntries(Object.entries(CAT_WORDS).map(([k, words]) => [k,
  [...new Set(words.split(/\s+/))].filter(Boolean).map(w => new RegExp(`(?<![\\p{L}])${esc(w.replace('*', '')).replace(/_/g, '\\s+')}${w.endsWith('*') ? '' : '(?![\\p{L}])'}`, 'iu'))]));
const SCORE_RE = /(?<![\d.,:])\d{1,2}\s?[-–]\s?\d{1,2}(?![\d.,:%])(?!\s?(?:år|years|mill|prosent))/;
const PRIORITY = ['vaer', 'krim', 'forsvar', 'helse', 'samferdsel', 'marked', 'energi', 'teknologi', 'vitenskap', 'kongehus', 'kultur', 'politikk', 'sport'];
function categorize(title, desc, feedCat) {
  if (feedCat) return feedCat;
  let best = 'annet', score = 0;
  for (const k of PRIORITY) {
    let s = CAT_RE[k].reduce((n, re) => n + (re.test(title) ? 2 : 0) + (re.test(desc) ? 1 : 0), 0);
    if (k === 'sport' && SCORE_RE.test(title)) s += 2;
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
const FUZZY = require('./public/js/fuzzy.js');
const tokens = s => FUZZY.tokens(s);
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
// «Mindre av dette»: skjulte kilder og ord gjelder både lista og varsler
const muted = n => (settings.hiddenSrc || []).includes(n.src) ||
  (settings.muteWords || []).some(w => new RegExp(`(?<![\\p{L}])${esc(w)}`, 'iu').test([n.title, n.titleNo, n.text].filter(Boolean).join(' ')));
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
// bilde til saken: media:content / media:thumbnail / enclosure / første <img> i teksten (kun https)
function pickImage(item) {
  const cands = [];
  for (const m of item.matchAll(/<media:(?:content|thumbnail)\b[^>]*>/gi)) {
    const u = (m[0].match(/\burl="([^"]+)"/i) || [])[1], t = (m[0].match(/\b(?:type|medium)="([^"]+)"/i) || [])[1] || 'image', w = +((m[0].match(/\bwidth="(\d+)"/i) || [])[1] || 0);
    if (u && /image/i.test(t)) cands.push({ u, w });
  }
  for (const m of item.matchAll(/<enclosure\b[^>]*>/gi)) { const u = (m[0].match(/\burl="([^"]+)"/i) || [])[1]; if (u && /type="image/i.test(m[0])) cands.push({ u, w: 0 }); }
  if (!cands.length) {
    const html = (tag(item, 'description') + tag(item, 'content:encoded') + tag(item, 'content')).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i); if (m) cands.push({ u: m[1], w: 0 });
  }
  cands.sort((a, b) => (b.w || 0) - (a.w || 0));
  for (const c of cands) {
    let u = c.u.replace(/&amp;/g, '&').trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (/^http:\/\//i.test(u)) u = 'https://' + u.slice(7);
    if (/^https:\/\/[^\s"'<>]+$/i.test(u) && !/\.(gif|svg)(\?|$)/i.test(u) && !/pixel|tracking|1x1|spacer/i.test(u)) return u.slice(0, 600);
  }
  return null;
}
function parseRss(xml) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(m => m[0]);
  const entries = items.length ? [] : [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(m => m[0]); // Atom
  return [...items, ...entries].map(item => {
    let link = decode(tag(item, 'link'));
    if (!link) { const m = item.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    if (/^http:\/\//i.test(link)) link = 'https://' + link.slice(7); // noen kilder (blant annet GDACS) lenker med http
    const d = decode(tag(item, 'pubDate') || tag(item, 'dc:date') || tag(item, 'updated') || tag(item, 'published'));
    const out = { title: decode(tag(item, 'title')), link, desc: decode(tag(item, 'description') || tag(item, 'summary')).slice(0, 400), date: new Date(d || Date.now()).toISOString() };
    const pt = decode(tag(item, 'georss:point')).split(/\s+/).map(Number);
    const glat = +decode(tag(item, 'geo:lat')), glon = +decode(tag(item, 'geo:long'));
    if (pt.length === 2 && pt.every(isFinite)) { out.lat = pt[0]; out.lon = pt[1]; }
    else if (tag(item, 'geo:lat') && isFinite(glat) && isFinite(glon)) { out.lat = glat; out.lon = glon; }
    const alert = decode(tag(item, 'gdacs:alertlevel')).toLowerCase();
    if (alert) { out.alert = alert; if (alert === 'red' || alert === 'orange') out.top = true; if (alert === 'green') out.minor = true; }
    const img = pickImage(item);
    if (img) out.img = img;
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

// ---------- kildesjekk ----------
// En kilde som feiler 3 ganger på rad settes på pause (30 min, så 1 t, 2 t … maks 12 t) og prøves igjen senere.
// En kilde uten nye saker på 14 dager merkes som «stille».
let FEEDSTATE = {}, FEEDSTATE_FILE = null;
const saveFeedState = () => { try { fs.writeFileSync(FEEDSTATE_FILE, JSON.stringify(FEEDSTATE)); } catch {} };
const ERR_NO = e => e.name === 'AbortError' ? 'svarer ikke (tidsavbrudd)' : /HTTP 404/.test(e.message) ? 'finnes ikke lenger (404)' : /HTTP 403|HTTP 401/.test(e.message) ? 'stenger oss ute (' + e.message.slice(5) + ')' : /HTTP 5\d\d/.test(e.message) ? 'feil hos kilden (' + e.message.slice(5) + ')' : /ingen saker/.test(e.message) ? e.message : 'kan ikke leses (' + e.message.slice(0, 60) + ')';
async function fetchFeed(feed, force) {
  const st = FEEDSTATE[feed.url] || (FEEDSTATE[feed.url] = { fails: 0 });
  const base = { src: feed.src, custom: !!feed.custom, since: st.since || null, lastNew: st.lastNew || null };
  if (!force && st.pausedUntil && Date.now() < st.pausedUntil) {
    status[feed.url] = { ...base, ok: false, paused: true, err: st.err, until: new Date(st.pausedUntil).toISOString() };
    return [];
  }
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(feed.url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const body = await r.text();
    const items = feed.type === 'usgs' ? parseUsgs(body) : parseRss(body);
    if (!items.length && feed.type !== 'usgs') throw new Error('ingen saker i strømmen');
    const newest = items.reduce((m, i) => (i.date > m ? i.date : m), '');
    Object.assign(st, { fails: 0, pausedUntil: 0, err: null, since: null, lastOk: new Date().toISOString(), lastNew: newest || st.lastNew || null });
    const stale = st.lastNew && Date.now() - new Date(st.lastNew) > 14 * 864e5;
    status[feed.url] = { ...base, since: null, lastNew: st.lastNew, ok: true, n: items.length, stale: !!stale };
    return items.map(i => ({ ...i, feed }));
  } catch (e) {
    st.fails = (st.fails || 0) + 1; st.err = ERR_NO(e); st.since = st.since || new Date().toISOString();
    if (st.fails >= 3) st.pausedUntil = Date.now() + Math.min(12 * 60, 30 * 2 ** (st.fails - 3)) * 60e3;
    status[feed.url] = { ...base, net: !/^HTTP |ingen saker/.test(e.message || ''), since: st.since, ok: false, err: st.err, fails: st.fails, paused: !!st.pausedUntil && st.fails >= 3, until: st.pausedUntil ? new Date(st.pausedUntil).toISOString() : null };
    return [];
  } finally { clearTimeout(t); }
}

// ---------- arkiv ----------
// Alle saker lagres kort (uten ingress) i én fil per måned, og ryddes etter 90 dager.
let ARCHIVE_DIR = null;
function archive(items) {
  if (!ARCHIVE_DIR || !items.length) return;
  try {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const by = new Map();
    for (const n of items) { const f = (n.date || '').slice(0, 7) || 'ukjent'; if (!by.has(f)) by.set(f, []); by.get(f).push(JSON.stringify({ id: n.id, eid: n.eid, title: n.title, titleNo: n.titleNo, url: n.url, date: n.date, src: n.src, cat: n.cat, place: n.place, lat: n.lat, lon: n.lon, cc: n.cc, lang: n.lang })); }
    for (const [f, lines] of by) fs.appendFileSync(path.join(ARCHIVE_DIR, f + '.jsonl'), lines.join('\n') + '\n');
    const keep = new Date(Date.now() - 95 * 864e5).toISOString().slice(0, 7);
    for (const f of fs.readdirSync(ARCHIVE_DIR)) if (/^\d{4}-\d{2}\.jsonl$/.test(f) && f.slice(0, 7) < keep) fs.unlinkSync(path.join(ARCHIVE_DIR, f));
  } catch (e) { console.warn('Arkiv:', e.message); }
}
// ---------- innsikt ----------
// Teller hendelser (ikke enkeltsaker) per land, kategori og dag, og finner ord som øker, i denne perioden mot forrige.
const INS_STOP = new Set(('etter mellom eller blir ble skal kan vil ikke dette denne disse også både mens fordi under over mange flere sier mener nytt første siste største norske norge norsk året dager timer uker ' +
  'about after again against amid could first former great into last more most new news over says said says still their there these they three under until video watch were what when where which while will with would years people world report reports').split(' '));
function insights(days) {
  const all = searchArchive('', Math.min(90, days * 2), 100000);
  const now = Date.now(), cut = now - days * 864e5, cut2 = now - 2 * days * 864e5;
  const ev = new Map();
  for (const n of all) { const t = +new Date(n.date); if (t < cut2) continue; const k = n.eid || n.id; if (!ev.has(k)) ev.set(k, { ...n, t, n: 0, srcs: new Set() }); const e = ev.get(k); e.n++; e.srcs.add(n.src); if (t < e.t) e.t = t; }
  const cur = [...ev.values()].filter(e => e.t >= cut), prev = [...ev.values()].filter(e => e.t < cut);
  const count = (arr, key) => { const m = new Map(); for (const e of arr) { const k = key(e); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
  const cc1 = count(cur, e => e.cc), cc0 = count(prev, e => e.cc), cat1 = count(cur, e => e.cat), cat0 = count(prev, e => e.cat);
  const words = arr => { const m = new Map(); for (const e of arr) for (const w of new Set(((e.lang === 'no' ? e.title : (e.titleNo || e.title)) || '').toLowerCase().match(/[a-zæøå][a-zæøå-]{4,}/g) || [])) if (!INS_STOP.has(w)) m.set(w, (m.get(w) || 0) + 1); return m; };
  const w1 = words(cur), w0 = words(prev);
  const rising = [...w1].filter(([, n]) => n >= 3).map(([w, n]) => ({ w, n, prev: w0.get(w) || 0, score: (n + 1) / ((w0.get(w) || 0) + 1) * Math.log(n + 1) })).sort((a, b) => b.score - a.score).slice(0, 12);
  const daysArr = []; for (let i = days - 1; i >= 0; i--) { const d0 = now - (i + 1) * 864e5, d1 = now - i * 864e5; daysArr.push({ day: new Date(d1).toISOString().slice(0, 10), n: cur.filter(e => e.t >= d0 && e.t < d1).length }); }
  const big = cur.filter(e => e.srcs.size >= 3).sort((a, b) => b.srcs.size - a.srcs.size || b.n - a.n).slice(0, 8).map(e => ({ title: e.lang === 'no' ? e.title : (e.titleNo || e.title), date: e.date, srcs: e.srcs.size, place: e.place, cat: e.cat, url: e.url, lat: e.lat, lon: e.lon }));
  return { days, total: cur.length, totalPrev: prev.length, articles: all.filter(n => +new Date(n.date) >= cut).length, since: all.length ? all[all.length - 1].date : null,
    countries: [...cc1].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([cc, n]) => ({ cc, n, prev: cc0.get(cc) || 0 })),
    cats: [...cat1].sort((a, b) => b[1] - a[1]).map(([cat, n]) => ({ cat, n, prev: cat0.get(cat) || 0 })), rising, perDay: daysArr, big };
}
function searchArchive(q, days = 90, limit = 200) {
  if (!ARCHIVE_DIR) return [];
  const words = (q || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => w.length > 1);
  const from = new Date(Date.now() - days * 864e5).toISOString();
  const seen = new Set(), out = [], fuzzy = [];
  const heads = FUZZY.prep(q || '').map(w => FUZZY.norm(w.f).slice(0, 3) === w.f.slice(0, 3) ? w.f.slice(0, 3) : '').filter(Boolean);
  let files = [];
  try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse(); } catch { return []; }
  for (const f of files) {
    if (f.slice(0, 7) < from.slice(0, 7)) break;
    const lines = fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i]) continue;
      let n; try { n = JSON.parse(lines[i]); } catch { continue; }
      if (n.date < from || seen.has(n.id)) continue;
      const hay = (n.title + ' ' + (n.titleNo || '') + ' ' + (n.place || '') + ' ' + n.src).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (words.length && !words.every(w => hay.includes(w))) {
        // tåler skrivefeil, bøyning og andre stavemåter, men bare når begynnelsen av ordene stemmer (raskt filter først)
        if (fuzzy.length >= limit) continue;
        const hf = FUZZY.fold(hay); if (!heads.every(h => hf.includes(h)) || !FUZZY.match(q, hf)) continue;
        seen.add(n.id); fuzzy.push(n); continue;
      }
      seen.add(n.id); out.push(n);
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date)); fuzzy.sort((a, b) => b.date.localeCompare(a.date));
  return out.concat(fuzzy).slice(0, limit);
  // (brukes også av innsikt med stor grense)
}

// ---------- logg til feilrapporten (de siste 200 advarslene) ----------
const LOG = [];
for (const k of ['warn', 'error']) { const orig = console[k].bind(console); console[k] = (...a) => { LOG.push(new Date().toISOString().slice(11, 19) + ' ' + k + ': ' + a.map(x => x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x)).join(' ').slice(0, 400)); if (LOG.length > 200) LOG.shift(); orig(...a); }; }

// ---------- historien bak en sak ----------
// Alle artikler i arkivet om samme hendelse (samme id, eller mange felles ord) de siste ukene.
function archiveScan(days, fn) {
  if (!ARCHIVE_DIR) return;
  const from = new Date(Date.now() - days * 864e5).toISOString();
  let files = []; try { files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl')).sort().reverse(); } catch { return; }
  for (const f of files) {
    if (f.slice(0, 7) < from.slice(0, 7)) break;
    for (const line of fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf8').split('\n')) { if (!line) continue; let n; try { n = JSON.parse(line); } catch { continue; } if (n.date >= from) fn(n); }
  }
}
function story(title, eid, days = 21) {
  const t = tokens(title), seen = new Set(), out = [];
  const add = n => { if (seen.has(n.id)) return; const tb = tokens(n.title + ' ' + (n.titleNo || '')); let sh = 0; for (const w of t) if (tb.has(w)) sh++;
    const jac = sh / (t.size + tb.size - sh || 1); if ((eid && n.eid === eid) || (sh >= 3 && jac >= 0.2) || jac >= 0.4) { seen.add(n.id); out.push({ id: n.id, eid: n.eid, title: n.title, titleNo: n.titleNo, url: n.url, date: n.date, src: n.src, place: n.place }); } };
  archiveScan(days, add); for (const n of news) add(n);
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(-300);
}
// varmekart: hvor det har skjedd mest, fra arkivet (ruter på 1 grad, én telling per hendelse)
let HEAT = { key: '', at: 0, data: null };
function heatGrid(days, hide) {
  const key = days + '|' + hide.join(',');
  if (HEAT.key === key && Date.now() - HEAT.at < 15 * 60e3) return HEAT.data;
  const grid = new Map(), ev = new Set();
  archiveScan(days, n => { if (n.lat == null || hide.includes(n.cat)) return; const k = n.eid || n.id; if (ev.has(k)) return; ev.add(k);
    const lat = Math.round(n.lat), lon = Math.round(n.lon), g = lat + ',' + lon; grid.set(g, (grid.get(g) || 0) + 1); });
  const data = { days, pts: [...grid].map(([k, v]) => { const [lat, lon] = k.split(',').map(Number); return [lon, lat, v]; }) };
  HEAT = { key, at: Date.now(), data }; return data;
}
// bakgrunn fra Wikipedia (norsk først, ellers engelsk)
const WIKI = new Map();
async function wiki(q) {
  q = String(q || '').trim().slice(0, 80); if (!q) throw new Error('mangler navn');
  const hit = WIKI.get(q); if (hit && Date.now() - hit.at < 24 * 3600e3) return hit.data;
  let data = null;
  for (const lang of ['no', 'en']) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}?redirect=true`, { headers: { 'User-Agent': UA + ' (https://github.com/dsoder-jpg/nyhetskloden)' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue; const j = await r.json();
      if (j.type === 'disambiguation' || !j.extract) continue;
      data = { lang, title: j.title, extract: j.extract.length > 700 ? j.extract.slice(0, 700).replace(/\s\S*$/, '') + ' …' : j.extract, desc: j.description || '', url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || null, thumb: j.thumbnail && /^https:/.test(j.thumbnail.source) ? j.thumbnail.source : null };
      break;
    } catch {}
  }
  WIKI.set(q, { at: Date.now(), data }); if (WIKI.size > 200) WIKI.delete(WIKI.keys().next().value);
  return data;
}

// ---------- strømvarsel og nordlysvarsel ----------
const powerZone = () => settings.powerZone || MORE.zoneFor(settings.home);
let powerSeen = '', auroraSeen = '', alertTimer = null, NEWSWEB_SEEN = {}, NEWSWEB_FILE = null;
async function checkAlerts() {
  clearTimeout(alertTimer); alertTimer = setTimeout(checkAlerts, 30 * 60e3); if (alertTimer.unref) alertTimer.unref();
  const now = new Date(), oslo = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  // strøm: morgendagens priser kommer rundt kl. 13
  const zone = powerZone();
  if (settings.powerAlerts && zone && oslo.getHours() >= 14) {
    const tm = new Date(now.getTime() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
    if (powerSeen !== tm) {
      try {
        const sum = MORE.powerSummary(await MORE.getPowerDay(zone, tm)); powerSeen = tm;
        const out = [];
        if (sum && sum.cheap && sum.cheap.avg <= settings.powerCheap) out.push({ kind: 'cheap', from: sum.cheap.from, kr: sum.cheap.avg });
        if (sum && sum.dear && sum.dear.kr >= settings.powerDear) out.push({ kind: 'dear', from: sum.dear.t, kr: sum.dear.kr });
        if (out.length) events.emit('powerprice', { zone, name: MORE.POWER_ZONES[zone], day: tm, avg: sum.avg, list: out });
      } catch {}
    }
  }
  // nye børsmeldinger for aksjer du eier på Oslo Børs
  if (settings.notifyNewsweb) {
    const own = (settings.portfolio || []).map(h => h.sym).filter(x => /\.OL$/.test(x));
    for (const sym of own) {
      try {
        const list = await MORE.getNewsweb(sym), seen = NEWSWEB_SEEN[sym];
        NEWSWEB_SEEN[sym] = list.map(m => m.id);
        if (!seen) continue; // første gang: ikke varsle om gamle meldinger
        const fresh = list.filter(m => !seen.includes(m.id) && Date.now() - Date.parse(m.time) < 2 * 864e5);
        if (fresh.length) events.emit('newsweb', { sym, name: fresh[0].name, list: fresh.slice(0, 3) });
      } catch {}
    }
    try { fs.writeFileSync(NEWSWEB_FILE, JSON.stringify(NEWSWEB_SEEN)); } catch {}
  }
  // nordlys: bare når det er mørkt der du bor
  if (settings.auroraAlerts && settings.features.aurora && settings.home && (oslo.getHours() >= 17 || oslo.getHours() < 3)) {
    const night = oslo.getHours() < 3 ? new Date(now.getTime() - 864e5).toDateString() : now.toDateString();
    if (auroraSeen !== night) {
      try { const a = await MORE.getAurora(settings.home); if (a.chance >= 20) { auroraSeen = night; events.emit('aurora', a); } } catch {}
    }
  }
}

// ---------- lokalavis ----------
// Finner avisa nærmest hjemstedet og prøver adressene til RSS-strømmen til én virker.
async function resolveLocal() {
  const want = settings.features.localNews !== false ? LOCAL.nearest(settings.home) : null;
  const lp = settings.localPaper;
  if (!want || want.builtin) { if (lp) { settings.localPaper = null; saveSettings(); } return; }
  if (lp && lp.name === want.name && (lp.url || Date.now() - (lp.triedAt || 0) < 24 * 3600e3)) return;
  let url = null;
  for (const u of LOCAL.candidates(want)) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12000);
    try { const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': UA } }); if (r.ok && parseRss(await r.text()).length) { url = u; break; } } catch {} finally { clearTimeout(t); }
  }
  settings.localPaper = { name: want.name, url, km: want.km, triedAt: Date.now() }; saveSettings();
}

// ---------- kalender ----------
// Kommende hendelser. Lista hentes fra GitHub, så den kan oppdateres uten ny versjon.
const CAL_URL = 'https://raw.githubusercontent.com/dsoder-jpg/nyhetskloden/main/kalender.json';
let CAL = { at: 0, events: [] };
function calBundled() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'kalender.json'), 'utf8')).events || []; } catch { return []; } }
const calOk = e => e && /^\d{4}-\d\d-\d\d$/.test(e.date) && typeof e.title === 'string' && e.title.length < 200;
async function getCalendar() {
  if (Date.now() - CAL.at > 12 * 3600e3) {
    let ev = null;
    try { const r = await fetch(CAL_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }); if (r.ok) { const j = await r.json(); if (Array.isArray(j.events)) ev = j.events; } } catch {}
    CAL = { at: ev ? Date.now() : Date.now() - 11 * 3600e3, events: (ev || calBundled()).filter(calOk).map(e => ({ date: e.date, time: /^\d\d:\d\d$/.test(e.time || '') ? e.time : null, kind: String(e.kind || 'annet').slice(0, 20), title: e.title, cc: String(e.cc || '').slice(0, 2).toUpperCase() || null, url: /^https:\/\//.test(e.url || '') ? e.url : null })) };
  }
  const today = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  // rapporter og utbytte for aksjer du eier eller følger
  const syms = [...new Set([...(settings.portfolio || []).map(h => h.sym), ...(settings.marketWatch || [])])].filter(x => !/^\^|=X$|-USD$|=F$/.test(x)).slice(0, 25);
  const extra = [];
  for (const sym of syms) {
    try { const e = await MORE.getEarnings(sym);
      for (const d of e.earnings.slice(0, 1)) extra.push({ date: d, time: null, kind: 'rapport', title: `Kvartalsrapport fra ${e.name}${e.estimate ? ' (anslått dato)' : ''}`, cc: null, url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`, sym });
      if (e.exDiv && e.exDiv >= today) extra.push({ date: e.exDiv, time: null, kind: 'utbytte', title: `${e.name} går eks. utbytte (kjøper du fra denne dagen, får du ikke utbyttet)`, cc: null, url: null, sym });
    } catch {}
  }
  return [...CAL.events, ...extra.filter(calOk)].filter(e => e.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

let pollTimer = null;
function schedule() { clearTimeout(pollTimer); const ms = settings.pollMin * 60e3; nextPoll = new Date(Date.now() + ms); pollTimer = setTimeout(poll, ms); }
async function poll() {
  if (polling) return; polling = true;
  try {
    await resolveLocal();
    const list = feeds();
    for (const k of Object.keys(status)) if (!['deepl', 'met', 'lan', 'net'].includes(k) && !list.some(f => f.url === k)) delete status[k];
    const force = poll.force; poll.force = false;
    const before = Object.fromEntries(list.map(f => [f.url, { ...(FEEDSTATE[f.url] || {}) }]));
    const results = (await Promise.all(list.map(f => fetchFeed(f, force)))).flat();
    // nesten alle kilder feilet samtidig = PC-en er uten nett. Da skal ingen kilder settes på pause.
    const tried = list.filter(f => !(before[f.url].pausedUntil > Date.now()) || force);
    const failed = tried.filter(f => status[f.url] && !status[f.url].ok && !status[f.url].paused && status[f.url].net);
    const offline = tried.length >= 4 && failed.length / tried.length >= 0.8;
    if (offline) for (const f of failed) { FEEDSTATE[f.url] = before[f.url]; status[f.url] = { ...status[f.url], err: 'uten nett', paused: false }; }
    status.net = offline ? { src: 'Internett', ok: false, err: 'PC-en ser ut til å være uten nett', offline: true, since: (status.net && status.net.since) || new Date().toISOString() } : { src: 'Internett', ok: true, n: tried.length - failed.length, hidden: true };
    // si fra én gang når en kilde har vært nede i et døgn
    if (!offline && settings.notifyDown !== false) {
      const down = list.filter(f => { const st = FEEDSTATE[f.url]; return st && st.since && Date.now() - new Date(st.since) > 24 * 3600e3 && st.downNotified !== st.since && !(settings.disabledFeeds || []).includes(f.url); });
      for (const f of down) FEEDSTATE[f.url].downNotified = FEEDSTATE[f.url].since;
      if (down.length) events.emit('feeddown', down.map(f => ({ src: f.src, url: f.url, err: FEEDSTATE[f.url].err || 'feiler', since: FEEDSTATE[f.url].since })));
    }
    saveFeedState();
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
        sev: severity(i), ccs, ...(i.img ? { img: i.img } : {}), ...(where || {}), ...(isFinite(i.mag) ? { mag: i.mag, tsunami: !!i.tsunami } : {}),
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
    const cutoff = Date.now() - settings.keepHours * 3600e3;
    const isFirst = !lastPoll && !news.length;
    news = [...byId.values()].filter(n => new Date(n.date) > cutoff).sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ITEMS);
    for (const n of news) { if (!n.eid) n.eid = n.id; delete n._tok; }
    archive(added);
    lastPoll = new Date(); schedule();
    save();
    const ok = Object.values(status).filter(s => s.ok).length;
    console.log(`[${lastPoll.toLocaleTimeString('nb-NO')}] ${ok}/${Object.keys(status).length} kilder ok, ${added.length} nye, ${news.length} totalt`);
    broadcast('update', { added: added.map(a => a.id), news, lastPoll, nextPoll, status });
    if (!isFirst) {
      const off = new Set(settings.catsOff || []), ncat = settings.notifyCats;
      const fresh = added.filter(a => Date.now() - new Date(a.date) < 2 * 3600e3 && !off.has(a.cat) && !muted(a) && (!ncat || ncat.includes(a.cat)));
      // ny utvikling i saker brukeren har lagret: en ny kilde eller oppdatering i samme hendelse
      const follow = new Set(settings.followEids || []);
      const followups = settings.notifyFollow ? added.filter(a => follow.has(a.eid) && a.id !== a.eid && Date.now() - new Date(a.date) < 6 * 3600e3 && !muted(a)) : [];
      if (followups.length) events.emit('followup', followups.map(a => ({ ...a, eventTitle: (news.find(n => n.id === a.eid) || {}).titleNo || (news.find(n => n.id === a.eid) || {}).title })));
      const big = fresh.filter(a => a.top || a.sev >= 5);
      const watched = fresh.filter(a => a.watch.length);
      if (big.length) events.emit('top', big);
      if (watched.length) events.emit('watch', watched);
    }
  } catch (e) {
    // en feil i én sak skal aldri stoppe henting: logg den og fortsett neste gang
    console.error('Feil under henting:', e);
    status.engine = { src: 'Nyhetsmotor', ok: false, err: String(e && e.message || e).slice(0, 160) };
    lastPoll = new Date(); schedule();
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

// ---------- kursvarsler ----------
// Aksjer i porteføljen og på følgelista gir ett varsel per dag og retning når dagens endring passerer grensen.
let PRICE_SEEN = {}, PRICE_FILE = null, priceTimer = null;
async function checkPrices() {
  clearTimeout(priceTimer); priceTimer = setTimeout(checkPrices, 10 * 60e3); if (priceTimer.unref) priceTimer.unref();
  if (!settings.priceAlerts || !settings.features.market) return;
  const syms = [...new Set([...(settings.portfolio || []).map(h => h.sym), ...(settings.marketWatch || [])])].slice(0, 40);
  const lim = settings.priceAlertPct || 5, hits = [];
  for (const sym of syms) {
    let q; try { q = await X.quoteCached(sym, 5); } catch { continue; }
    if (q.pct == null || Math.abs(q.pct) < lim || !q.time || Date.now() - new Date(q.time) > 12 * 3600e3) continue;
    const key = sym + (q.pct > 0 ? '+' : '-') + q.time.slice(0, 10);
    if (PRICE_SEEN[key]) continue;
    PRICE_SEEN[key] = Date.now(); hits.push({ sym, name: q.name, pct: q.pct });
  }
  for (const [k, t] of Object.entries(PRICE_SEEN)) if (Date.now() - t > 5 * 864e5) delete PRICE_SEEN[k];
  if (hits.length) { try { fs.writeFileSync(PRICE_FILE, JSON.stringify(PRICE_SEEN)); } catch {} events.emit('price', hits.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))); }
}

// ---------- webserver ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
function readBody(req) { return new Promise((res, rej) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { rej(e); } }); }); }
function start({ port = +process.env.PORT || 3000, dataDir = path.join(__dirname, 'data') } = {}) {
  DATA_FILE = path.join(dataDir, 'news.json'); SETTINGS_FILE = path.join(dataDir, 'settings.json');
  FEEDSTATE_FILE = path.join(dataDir, 'feedstate.json'); ARCHIVE_DIR = path.join(dataDir, 'arkiv');
  try { FEEDSTATE = JSON.parse(fs.readFileSync(FEEDSTATE_FILE, 'utf8')) || {}; } catch { FEEDSTATE = {}; }
  PRICE_FILE = path.join(dataDir, 'kursvarsler.json'); try { PRICE_SEEN = JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8')) || {}; } catch { PRICE_SEEN = {}; }
  priceTimer = setTimeout(checkPrices, 90e3);
  NEWSWEB_FILE = path.join(dataDir, 'borsmeldinger.json'); try { NEWSWEB_SEEN = JSON.parse(fs.readFileSync(NEWSWEB_FILE, 'utf8')) || {}; } catch { NEWSWEB_SEEN = {}; }
  MORE.setUA(UA); alertTimer = setTimeout(checkAlerts, 120e3); if (alertTimer.unref) alertTimer.unref(); if (priceTimer.unref) priceTimer.unref();
  loadSettings();
  if (!(settings.trades || []).length && (settings.portfolio || []).length) settings.trades = settings.portfolio.map((h, i) => ({ id: 'm' + i, sym: h.sym, side: 'buy', qty: h.qty, price: h.price || 0, date: null }));
  try { news = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); for (const n of news) if (!n.eid) n.eid = n.id; } catch { news = []; }
  const pub = path.join(__dirname, 'public');
  mainHandler = async (req, res, lan) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (o, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
    if (lan) {
      // mobil: krever lenken med nøkkel; den lagres som informasjonskapsel. Mobilen kan lese, men ikke endre innstillinger.
      const tok = settings.lanToken, cookie = (req.headers.cookie || '').match(/nk_t=([\w-]+)/);
      if (!settings.lan || !tok) { res.writeHead(403); return res.end('Mobilvisning er slått av.'); }
      if (url.searchParams.get('t') === tok) { res.writeHead(302, { 'Set-Cookie': `nk_t=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`, Location: '/' }); return res.end(); }
      if (!cookie || cookie[1] !== tok) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Åpne lenken fra Nyhetskloden-innstillingene (Mobil) på denne enheten.'); }
      if (req.method !== 'GET' && url.pathname !== '/api/refresh') { res.writeHead(403); return res.end(); }
    }
    if (url.pathname === '/api/country') {
      const cc = String(url.searchParams.get('cc') || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return json({ error: 'ugyldig land' }, 400);
      const c = await X.getCountry(cc); return c ? json(c) : json({ error: 'ukjent land' }, 404);
    }
    if (url.pathname === '/api/power') { if (!settings.features.power) return json({ off: true, zones: [] }); try { return json(await X.getPower()); } catch (e) { return json({ error: e.message, zones: [] }, 502); } }
    if (url.pathname === '/api/traffic') {
      if (!settings.features.traffic) return json({ off: true, items: [] });
      try { return json(await X.getTraffic(settings.datex)); } catch (e) { return json({ error: e.message, items: [] }, 502); }
    }
    if (url.pathname === '/api/podcasts') { try { return json(await X.getPodcasts()); } catch (e) { return json({ error: e.message, pods: [] }, 502); } }
    if (url.pathname === '/api/insights') {
      const days = Math.min(45, Math.max(1, +url.searchParams.get('days') || 7));
      return json(insights(days));
    }
    if (url.pathname === '/api/storms') {
      if (!settings.features.storms) return json({ off: true, type: 'FeatureCollection', features: [] });
      try { return json(await X.getStorms()); } catch (e) { return json({ error: e.message, type: 'FeatureCollection', features: [] }, 502); }
    }
    if (url.pathname === '/api/archive' && url.searchParams.get('date')) {
      const day = String(url.searchParams.get('date'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'ugyldig dato' }, 400);
      const from = new Date(day + 'T00:00:00'), to = new Date(+from + 864e5);
      const days = Math.ceil((Date.now() - from) / 864e5) + 1;
      if (days > 92) return json({ items: [] });
      return json({ day, items: searchArchive('', days, 100000).filter(n => new Date(n.date) >= from && new Date(n.date) < to) });
    }
    if (url.pathname === '/api/archive') {
      const days = Math.min(90, Math.max(1, +url.searchParams.get('days') || 90));
      return json({ items: searchArchive(url.searchParams.get('q') || '', days) });
    }
    if (url.pathname === '/api/retry-feeds' && req.method === 'POST') { for (const st of Object.values(FEEDSTATE)) { st.pausedUntil = 0; } poll.force = true; poll(); return json({ ok: true }); }
    if (url.pathname === '/api/market') {
      if (!settings.features.market && !settings.features.marketGlobe) return json({ off: true });
      try { return json(await X.getMarket({ watch: settings.marketWatch, movers: settings.features.movers, range: url.searchParams.get('range') || '1d' })); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/quote') { // sjekk at en ticker finnes før den legges til
      const sym = String(url.searchParams.get('s') || '').toUpperCase();
      if (!/^[A-Z0-9^.=\-]{1,20}$/.test(sym)) return json({ error: 'ugyldig ticker' }, 400);
      try { return json(await X.quote(sym)); } catch (e) { return json({ error: 'fant ikke' }, 404); }
    }
    if (url.pathname === '/api/mdetail') {
      const sym = String(url.searchParams.get('s') || '').toUpperCase();
      if (!/^[A-Z0-9^.=\-]{1,20}$/.test(sym)) return json({ error: 'ugyldig ticker' }, 400);
      try { return json(await X.getDetail(sym, url.searchParams.get('range'))); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/msearch') {
      const q = String(url.searchParams.get('q') || '').trim().slice(0, 60);
      if (q.length < 1) return json([]);
      try { return json(await X.searchTicker(q)); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/wxmap') {
      if (!settings.features.wxmap) return json({ off: true, cities: [] });
      try { return json(await X.getWxMap(settings.home)); } catch (e) { return json({ error: e.message, cities: [] }, 502); }
    }
    if (url.pathname === '/api/radar') {
      if (!settings.features.radar) return json({ off: true });
      try { return json(await X.getRadar()); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/weather') {
      if (!settings.features.weather || !settings.home) return json({ off: true, home: settings.home });
      try { return json(await X.getWeather(settings.home)); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/flights') {
      if (!settings.features.flights) return json({ off: true });
      const lat = +url.searchParams.get('lat'), lon = +url.searchParams.get('lon');
      if (!isFinite(lat) || !isFinite(lon)) return json({ error: 'mangler posisjon' }, 400);
      try { return json(await X.getFlights(lat, lon)); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/ships') {
      if (!settings.features.ships) return json({ off: true });
      try { return json(await X.getShips(settings.ships)); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/places') return json(PLACES.map((p, i) => [p, i]).filter(([p]) => p[3] === 'c').map(([p, i]) => [p[0], p[1], p[2], p[4], i < BASE_PLACES ? 1 : 0.07]));
    if (url.pathname === '/api/top') return json(X.topEvents(news, 24, 5, settings.catsOff));
    if (url.pathname === '/api/news') return json({ news, lastPoll, nextPoll, pollMin: settings.pollMin, status });
    if (url.pathname === '/api/alerts') return json(alerts);
    if (url.pathname === '/api/settings' && req.method === 'GET') { const ps = publicSettings(); if (lan) { delete ps.portfolio; delete ps.trades; } return json(ps); }
    if (url.pathname === '/api/read') {
      const u = url.searchParams.get('url') || '';
      // bare lenker til saker appen selv har hentet
      if (!/^https:\/\//.test(u) || !news.some(n => n.url === u)) return json({ error: 'ukjent lenke' }, 400);
      try { return json(await READER.read(u, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' + UA)); } catch (e) { return json({ error: e.name === 'AbortError' ? 'siden svarer ikke' : e.message }, 502); }
    }
    if (url.pathname === '/api/diag') {
      if (lan) return json({ error: 'ikke tilgjengelig' }, 403);
      const st = Object.values(status);
      return json({ engine: { polled: lastPoll, next: nextPoll, news: news.length, archive: !!ARCHIVE_DIR, net: status.net || null },
        feeds: { total: st.length, ok: st.filter(x => x.ok).length, failing: st.filter(x => !x.ok && !x.paused).map(x => ({ src: x.src, err: x.err, since: x.since })).slice(0, 60), paused: st.filter(x => x.paused).map(x => x.src) },
        settings: publicSettings(), log: LOG.slice(-200) });
    }
    if (url.pathname === '/api/story') {
      const t = url.searchParams.get('title') || ''; if (!t) return json([]);
      return json(story(t, url.searchParams.get('eid') || null, Math.min(90, +url.searchParams.get('days') || 21)));
    }
    if (url.pathname === '/api/heat') return json(heatGrid(Math.min(90, Math.max(7, +url.searchParams.get('days') || 30)), settings.mapHideCats || []));
    if (url.pathname === '/api/wiki') { try { return json(await wiki(url.searchParams.get('q'))); } catch (e) { return json({ error: e.message }, 502); } }
    if (url.pathname === '/api/shakemap') { const l = url.searchParams.get('url') || ''; if (!news.some(n => n.url === l)) return json({ error: 'ukjent skjelv' }, 400); try { return json(await MORE.getShakemap(l)); } catch (e) { return json({ error: e.message }, 502); } }
    if (url.pathname === '/api/fires') { try { return json(await MORE.getFires()); } catch (e) { return json({ error: e.message, pts: [] }, 502); } }
    if (url.pathname === '/api/aurora') { try { return json(await MORE.getAurora(settings.home, url.searchParams.get('grid') === '1')); } catch (e) { return json({ error: e.message }, 502); } }
    if (url.pathname === '/api/rate') { try { return json(await MORE.getPolicyRate()); } catch (e) { return json({ error: e.message }, 502); } }
    if (url.pathname === '/api/powerday') {
      const zone = /^NO[1-5]$/.test(url.searchParams.get('zone') || '') ? url.searchParams.get('zone') : powerZone(); if (!zone) return json({ error: 'mangler prisområde' }, 400);
      const day = /^\d{4}-\d\d-\d\d$/.test(url.searchParams.get('day') || '') ? url.searchParams.get('day') : new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
      try { const h = await MORE.getPowerDay(zone, day); return json({ zone, name: MORE.POWER_ZONES[zone], day, hours: h, sum: MORE.powerSummary(h) }); } catch (e) { return json({ zone, day, error: e.message.includes('404') ? 'ikke publisert ennå' : e.message }, 502); }
    }
    if (url.pathname === '/api/dividends') { if (lan) return json({ rows: [] }); try { return json(await X.getDividends(settings.trades)); } catch (e) { return json({ error: e.message, rows: [] }, 502); } }
    if (url.pathname === '/api/aq') { try { return json(await MORE.getAirQuality(settings.home)); } catch (e) { return json({ error: e.message, cities: [] }, 502); } }
    if (url.pathname === '/api/airports') { try { return json(await MORE.getAirports()); } catch (e) { return json({ error: e.message, airports: [] }, 502); } }
    if (url.pathname === '/api/varsom') { try { return json(await MORE.getVarsom(placeNO)); } catch (e) { return json({ error: e.message, items: [] }, 502); } }
    if (url.pathname === '/api/newsweb') { try { return json(await MORE.getNewsweb(url.searchParams.get('s') || '')); } catch (e) { return json({ error: e.message }, 502); } }
    if (url.pathname === '/api/calendar') return json(await getCalendar());
    if (url.pathname === '/api/local') return json({ paper: settings.localPaper, near: LOCAL.nearest(settings.home) });
    if (url.pathname === '/api/fx') {
      const f = (url.searchParams.get('from') || '').toUpperCase(), t = (url.searchParams.get('to') || '').toUpperCase();
      if (!/^[A-Z]{3}$/.test(f) || !/^[A-Z]{3}$/.test(t)) return json({ error: 'ugyldig valuta' }, 400);
      try { return json(await X.fxRate(f, t)); } catch (e) { return json({ error: e.message }, 502); }
    }
    if (url.pathname === '/api/portfolio/history') {
      if (lan) return json({ points: [] });
      try { return json(await X.getPortfolioHistory(settings.trades, url.searchParams.get('range'))); } catch (e) { return json({ error: e.message, points: [] }, 502); }
    }
    if (url.pathname === '/api/portfolio') {
      if (lan) return json({ rows: [], lan: true });
      const hs = X.holdings(settings.trades), open = hs.filter(h => h.open); open.closed = hs.filter(h => !h.open && h.realized);
      if (!open.length && !open.closed.length) return json({ rows: [], value: 0 });
      try { return json(await X.getPortfolio(open)); } catch (e) { return json({ error: e.message, rows: [] }, 502); }
    }
    if (url.pathname === '/api/settings' && req.method === 'POST') {
      try {
        const b = await readBody(req);
        const before = JSON.stringify([settings.customFeeds, settings.disabledFeeds]), pollBefore = settings.pollMin;
        applySettings(b);
        for (const n of news) n.watch = watchHits(n);
        if (settings.pollMin !== pollBefore && lastPoll) schedule();
        if (before !== JSON.stringify([settings.customFeeds, settings.disabledFeeds]) || (b.deeplKey && settings.translate)) setTimeout(poll, 100);
        broadcast('update', { added: [], news, lastPoll, nextPoll, status });
        return json(publicSettings());
      } catch (e) { return json({ error: e.message }, 400); }
    }
    if (url.pathname === '/api/clear' && req.method === 'POST') { news = []; save(); setTimeout(poll, 100); broadcast('update', { added: [], news, lastPoll, nextPoll, status }); return json({ ok: true }); }
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
  };
  const server = http.createServer((req, res) => mainHandler(req, res, false));
  setLan();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      console.log(`Nyhetskloden kjører på http://localhost:${actual}  (henter hvert ${settings.pollMin}. minutt)`);
      poll(); pollAlerts();
      setInterval(pollAlerts, 10 * 60e3);
      resolve(actual);
    });
  });
}

module.exports = { start, poll, getSettings: () => settings, applySettings, topEvents: (h = 24, n = 5) => X.topEvents(news, h, n, settings.catsOff), getCalendar, events, parseRss, parseUsgs, findPlace, findPlaces, categorize, severity, tokens, sameEvent };
if (require.main === module) start();
