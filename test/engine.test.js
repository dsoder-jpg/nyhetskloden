// Tester for nyhetsmotoren. Kjør med: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'nk-test-')));
const e = require('../server.js');

const CATS = [
  ['krim', 'To skadd etter knivstikking i Bergen sentrum'],
  ['krim', 'Brann i bolighus i Bø'],
  ['krim', 'Fire destroys apartment block in Oslo'],
  ['krim', 'Mann siktet for drap i Trondheim'],
  ['forsvar', 'India and Pakistan trade fire across Kashmir border'],
  ['forsvar', 'Russian drone strike kills 12 in Kharkiv'],
  ['forsvar', 'NATO sender flere soldater til Finnmark'],
  ['politikk', 'Workers strike at Ford plant in Germany'],
  ['politikk', 'Putin meets Xi in Beijing'],
  ['politikk', 'Stortinget vedtok statsbudsjettet'],
  ['marked', 'Gullprisen stiger kraftig'],
  ['marked', 'Interest rates cut by Fed'],
  ['marked', 'Equinor stiger etter sterke kvartalstall'],
  ['teknologi', 'Apple unveils new iPhone'],
  ['teknologi', 'OpenAI lanserer ny chatbot'],
  ['helse', 'Nytt utbrudd av fugleinfluensa, sier FHI'],
  ['vitenskap', 'SpaceX rocket launch delayed'],
  ['vitenskap', 'Forskere fant fossil av ukjent dinosaur'],
  ['energi', 'Strømmen blir dyrere i Sør-Norge i vinter'],
  ['vaer', 'Kraftig snøvær stenger E6 over Saltfjellet'],
  ['vaer', 'Earthquake of magnitude 6.1 strikes off Japan'],
  ['samferdsel', 'Toget mellom Oslo og Bergen innstilt'],
  ['kultur', 'Paris Hilton launches new album'],
  ['kongehus', 'Kongen besøker Tromsø'],
  ['sport', 'Molde slo Rosenborg 3-1'],
  ['sport', 'Klæbo vant igjen'],
  ['sport', 'Liverpool beat Real Madrid 2-0'],
];
for (const [cat, title] of CATS) test(`kategori: ${title}`, () => assert.equal(e.categorize(title, ''), cat));

const PLACES = [
  ['Brann i bolighus i Bø', 'Bø'],
  ['Explosion in Paris kills two', 'Paris'],
  ['Storm i Bergen', 'Bergen'],
  ['Trump says tariffs will rise', 'USA'],
  ['Kim Jong Un tester rakett', 'Nord-Korea'],
  ['Michael Jordan buys new team', null],
  ['Paris Hilton launches new album', null],
  ['Washington Post reports layoffs', null],
  ['Ulykke på E18 ved Gvarv', 'Gvarv'],
  ['Georgia protesters clash with police in Tbilisi', 'Tbilisi'],
];
for (const [title, want] of PLACES) test(`sted: ${title}`, () => assert.equal(e.findPlace(title, '')?.place ?? null, want));

test('samme hendelse fra to kilder', () => {
  const tok = t => ({ title: t, _tok: e.tokens(t), date: new Date().toISOString() });
  assert.ok(e.sameEvent(tok('Minst 12 drept i russisk angrep på Kharkiv'), tok('Kharkiv: 12 drept i russisk droneangrep')));
  assert.ok(!e.sameEvent(tok('Minst 12 drept i russisk angrep på Kharkiv'), tok('Norge vant VM-gull i stafett')));
});

test('samme hendelse på tvers av språk', () => {
  const tok = t => ({ title: t, _tok: e.tokens(t), date: new Date().toISOString() });
  assert.ok(e.sameEvent(tok('Russian attack on Kharkov kills 12'), tok('Minst 12 drept i russisk angrep på Kharkiv')));
  assert.ok(e.sameEvent(tok('Powerful earthquake hits Japan, tsunami warning issued'), tok('Kraftig jordskjelv i Japan – tsunamivarsel')));
  assert.ok(!e.sameEvent(tok('Russian attack on Kharkiv kills 12'), tok('Ceasefire talks resume in Cairo')));
  assert.ok(!e.sameEvent(tok('Storm hits Bergen'), tok('Election in Germany')));
});

test('søk tåler skrivefeil, bøyning og stavemåter', () => {
  const F = require('../public/js/fuzzy.js');
  assert.ok(F.match('karkiv', 'Angrep i Kharkiv'));
  assert.ok(F.match('kharkov', 'Angrep i Kharkiv'));
  assert.ok(F.match('angrepene', 'Nytt angrep mot Kyiv'));
  assert.ok(F.match('kiev', 'Droner over Kyiv'));
  assert.ok(F.match('peking', 'Toppmøte i Beijing'));
  assert.ok(F.match('jordskelv', 'Kraftig jordskjelv i Japan'));
  assert.ok(F.match('ukraine', 'Krigen i Ukraina'));
  assert.ok(!F.match('fotball', 'Kraftig jordskjelv i Japan'));
  assert.ok(!F.match('bergen', 'Brann i Bodø'));
});

test('bilde hentes fra RSS (bare https)', () => {
  const x = '<rss><channel>' +
    '<item><title>A</title><link>https://a.no/1</link><media:content url="https://img.a.no/s.jpg" width="100" medium="image"/><media:content url="https://img.a.no/b.jpg" width="800" medium="image"/></item>' +
    '<item><title>B</title><link>https://a.no/2</link><description><![CDATA[<p><img src="http://x.no/p.jpg"/> tekst</p>]]></description></item>' +
    '<item><title>C</title><link>https://a.no/3</link><enclosure url="https://x.no/e.png" type="image/png"/></item>' +
    '<item><title>D</title><link>https://a.no/4</link><enclosure url="https://x.no/lyd.mp3" type="audio/mpeg"/></item>' +
    '</channel></rss>';
  assert.deepEqual(e.parseRss(x).map(i => i.img || null), ['https://img.a.no/b.jpg', 'https://x.no/p.jpg', 'https://x.no/e.png', null]);
});

test('kildelister og portefølje valideres', () => {
  e.applySettings({ srcLists: [{ name: '  Morgen ', srcs: ['NRK', 'BBC', 'NRK'] }, { name: '', srcs: ['x'] }, { name: 'Morgen', srcs: [] }], portfolio: [{ sym: 'eqnr.ol', qty: 10, price: 280 }, { sym: 'bad sym', qty: 1 }, { sym: 'NVDA', qty: 0 }], priceAlertPct: 99 });
  const s = e.getSettings();
  assert.deepEqual(s.srcLists, [{ name: 'Morgen', srcs: ['NRK', 'BBC'] }]);
  assert.deepEqual(s.portfolio, [{ sym: 'EQNR.OL', qty: 10, price: 280 }]);
  assert.equal(s.priceAlertPct, 50);
});

test('lesemodus henter ut selve teksten', () => {
  const R = require('../reader');
  const html = '<html><head><title>Tittel | Avis</title><meta property="og:title" content="Stor brann i Bergen"><meta property="og:image" content="https://img.no/a.jpg"></head><body>' +
    '<nav><p>Meny med mange lenker som ikke skal være med i teksten</p></nav><article><h1>Stor brann i Bergen</h1>' +
    '<p>Brannvesenet rykket ut til et bolighus i Bergen sentrum natt til lørdag, og flere ble evakuert.</p><p>Les også: noe annet som ikke hører hjemme her i det hele tatt</p>' +
    '<h2>Ingen skadd</h2><p>Ifølge politiet ble ingen personer skadd i brannen, men huset er totalskadet etter natten.</p><script>var x = "<p>skript skal bort fra teksten her</p>";</script></article><footer><p>Kontakt oss på telefon og e-post i dag</p></footer></body></html>';
  const a = R.extract(html, 'https://avis.no/1');
  assert.equal(a.title, 'Stor brann i Bergen');
  assert.equal(a.img, 'https://img.no/a.jpg');
  assert.deepEqual(a.blocks.map(b => b.t), ['p', 'h', 'p']);
  assert.ok(!JSON.stringify(a.blocks).includes('Meny') && !JSON.stringify(a.blocks).includes('skript') && !JSON.stringify(a.blocks).includes('Les også'));
  const ld = R.extract('<script type="application/ld+json">{"@type":"NewsArticle","headline":"H","articleBody":"' + 'Første avsnitt med tekst. '.repeat(20) + '\\n' + 'Andre avsnitt. '.repeat(30) + '"}</script>', 'https://x.no');
  assert.equal(ld.title, 'H'); assert.equal(ld.blocks.length, 2);
});

test('kjøp og salg gir riktig beholdning og gevinst', () => {
  const X = require('../extras');
  const h = X.holdings([
    { sym: 'EQNR.OL', side: 'buy', qty: 10, price: 200, date: '2026-01-05' },
    { sym: 'EQNR.OL', side: 'buy', qty: 10, price: 300, date: '2026-03-01' },
    { sym: 'EQNR.OL', side: 'sell', qty: 5, price: 400, date: '2026-06-01' },
    { sym: 'NVDA', side: 'buy', qty: 2, price: 100, date: null },
    { sym: 'NVDA', side: 'sell', qty: 2, price: 150, date: '2026-02-01' },
  ]);
  const e = h.find(x => x.sym === 'EQNR.OL'), n = h.find(x => x.sym === 'NVDA');
  assert.equal(e.qty, 15); assert.equal(e.price, 250); assert.equal(e.realized, 750); assert.ok(e.open);
  assert.equal(n.qty, 0); assert.equal(n.realized, 100); assert.ok(!n.open);
});

test('kjøp og salg lagres og gir porteføljen', () => {
  e.applySettings({ trades: [{ sym: 'kog.ol', side: 'buy', qty: 4, price: 300, date: '2026-02-01' }, { sym: 'KOG.OL', side: 'sell', qty: 1, price: 350, date: '2026-04-01' }, { sym: 'X', side: 'buy', qty: 0 }, { sym: 'bad sym', qty: 1 }] });
  const s = e.getSettings();
  assert.equal(s.trades.length, 2); assert.equal(s.trades[0].sym, 'KOG.OL');
  assert.deepEqual(s.portfolio, [{ sym: 'KOG.OL', qty: 3, price: 300 }]);
});

test('lokalavis velges etter hjemsted', () => {
  const L = require('../local');
  assert.equal(L.nearest({ lat: 59.41, lon: 9.07 }).name, 'Telemarksavisa'); // Bø
  assert.equal(L.nearest({ lat: 60.39, lon: 5.32 }).builtin, true); // Bergen har BT fra før
  assert.equal(L.nearest({ lat: 48.85, lon: 2.35 }), null); // Paris
  assert.ok(L.candidates(L.PAPERS[0]).every(u => u.startsWith('https://')));
});

test('kalenderen er gyldig', () => {
  const k = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'kalender.json'), 'utf8'));
  assert.ok(k.events.length > 10);
  for (const ev of k.events) { assert.match(ev.date, /^\d{4}-\d\d-\d\d$/); assert.ok(ev.title); assert.ok(!ev.url || ev.url.startsWith('https://')); if (ev.time) assert.match(ev.time, /^\d\d:\d\d$/); }
});

test('prisområde for strøm og billigste timer', () => {
  const M = require('../more');
  assert.equal(M.zoneFor({ lat: 59.41, lon: 9.07 }), 'NO2'); // Bø
  assert.equal(M.zoneFor({ lat: 59.91, lon: 10.75 }), 'NO1'); // Oslo
  assert.equal(M.zoneFor({ lat: 60.39, lon: 5.32 }), 'NO5'); // Bergen
  assert.equal(M.zoneFor({ lat: 63.43, lon: 10.39 }), 'NO3'); // Trondheim
  assert.equal(M.zoneFor({ lat: 69.65, lon: 18.96 }), 'NO4'); // Tromsø
  const h = [1.2, 1.1, 0.4, 0.2, 0.3, 0.9, 2.8, 1.5].map((kr, i) => ({ t: new Date(Date.UTC(2026, 0, 1, i)).toISOString(), kr }));
  const s = M.powerSummary(h);
  assert.equal(s.cheap.from, h[2].t); assert.ok(Math.abs(s.cheap.avg - 0.3) < 1e-9); assert.equal(s.dear.kr, 2.8);
});

test('børsmeldinger, flyplasser og luftkvalitet tolkes riktig', async () => {
  const M = require('../more'), real = global.fetch, now = Date.now();
  global.fetch = async url => {
    url = String(url);
    if (url.includes('newsreader')) return { ok: true, json: async () => ({ data: { messages: [
      { messageId: 1, title: 'Equinor ASA: Notifiable trading', category: [{ category_no: 'MELDEPLIKTIG HANDEL' }], issuerSign: 'EQNR', issuerName: 'Equinor ASA', publishedTime: new Date(now).toISOString() },
      { messageId: 2, title: 'Equinor ASA: Meldepliktig handel', category: [{ category_no: 'MELDEPLIKTIG HANDEL' }], issuerSign: 'EQNR', issuerName: 'Equinor ASA', publishedTime: new Date(now + 400).toISOString() },
      { messageId: 3, title: 'Equinor ASA: Kvartalsrapport', category: [{ category_no: 'FINANSIELL RAPPORTERING' }], issuerSign: 'EQNR', issuerName: 'Equinor ASA', publishedTime: new Date(now - 864e5).toISOString() }] } }) };
    if (url.includes('avinor')) return { ok: true, text: async () => '<flights>' + [['C', 0], ['E', 50], ['D', 5], [null, 0]].map(([c, d], i) => `<flight uniqueID="${i}"><flight_id>SK${i}</flight_id><schedule_time>${new Date(now).toISOString()}</schedule_time><airport>BGO</airport>${c ? `<status code="${c}" time="${new Date(now + d * 6e4).toISOString()}"/>` : ''}</flight>`).join('') + '</flights>' };
    if (url.includes('airquality')) return { ok: true, json: async () => ({ data: { time: [{ from: new Date(now - 6e5).toISOString(), to: new Date(now + 6e5).toISOString(), variables: { AQI: { value: 2.4 }, AQI_no2: { value: 2.4 }, AQI_pm10: { value: 1.2 } } }] } }) };
    return { ok: false, status: 404 };
  };
  try {
    const nw = await M.getNewsweb('EQNR.OL');
    assert.equal(nw.length, 2); assert.equal(nw[0].title, 'Equinor ASA: Meldepliktig handel'); assert.match(nw[0].url, /newsweb\.oslobors\.no\/message\/2$/);
    const ap = (await M.getAirports()).airports[0];
    assert.equal(ap.total, 4); assert.equal(ap.canc, 1); assert.equal(ap.late, 1);
    const aq = (await M.getAirQuality(null)).cities[0];
    assert.equal(aq.main, 'no2'); assert.ok(Math.abs(aq.aqi - 2.4) < 1e-9);
  } finally { global.fetch = real; }
});

test('http-lenker gjøres om til https', () => {
  const items = e.parseRss('<rss><channel><item><title>Flom</title><link>http://www.gdacs.org/report.aspx?x=1</link></item></channel></rss>');
  assert.equal(items.length, 1);
  assert.equal(items[0].link, 'https://www.gdacs.org/report.aspx?x=1');
});

test('RSS leses', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Hei &amp; hå</title><link>https://x.no/1</link><description>&lt;p&gt;Tekst&lt;/p&gt;</description><pubDate>Wed, 25 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const items = e.parseRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Hei & hå');
  assert.equal(items[0].link, 'https://x.no/1');
});

const PUB = path.join(__dirname, '..', 'public');
const pageScripts = () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="\/js\/([\w-]+\.js)"><\/script>/g)].map(m => ({ f: m[1], js: fs.readFileSync(path.join(PUB, 'js', m[1]), 'utf8') }));
};
test('sidekoden har ingen syntaksfeil', () => {
  const vm = require('vm');
  const files = pageScripts();
  assert.ok(files.length >= 5, 'fant ikke skriptene i index.html');
  for (const { f, js } of files) assert.doesNotThrow(() => new vm.Script(js, { filename: f }));
  for (const f of ['ticker.html', 'widget.html']) {
    if (!fs.existsSync(path.join(PUB, f))) continue;
    const html = fs.readFileSync(path.join(PUB, f), 'utf8');
    const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    assert.doesNotThrow(() => new vm.Script(js, { filename: f }));
  }
});

test('ingen navn er deklarert to ganger på tvers av skriptene', () => {
  const acorn = require('acorn');
  const seen = new Map();
  for (const { f, js } of pageScripts()) {
    for (const n of acorn.parse(js, { ecmaVersion: 'latest' }).body) {
      const names = n.type === 'VariableDeclaration' ? n.declarations.flatMap(d => d.id.type === 'Identifier' ? [d.id.name] : []) : (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') ? [n.id.name] : [];
      for (const x of names) { assert.ok(!seen.has(x), `«${x}» finnes både i ${seen.get(x)} og ${f}`); seen.set(x, f); }
    }
  }
});

test('ingen id er brukt to ganger i HTML-en', () => {
  for (const f of ['index.html', 'ticker.html', 'widget.html']) {
    if (!fs.existsSync(path.join(PUB, f))) continue;
    const ids = [...fs.readFileSync(path.join(PUB, f), 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, [], `${f}: doble id-er`);
  }
});

test('alle id-er som skriptene slår opp finnes', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const missing = new Set();
  // id-er som lages av skriptene selv (kartknapper og innhold i paneler)
  for (const { js } of pageScripts()) for (const m of js.matchAll(/id="([\w-]+)"|\bmk\('([\w-]+)'/g)) ids.add(m[1] || m[2]);
  for (const { js } of pageScripts()) for (const m of js.matchAll(/\$\('([\w-]+)'\)/g)) if (!ids.has(m[1])) missing.add(m[1]);
  assert.deepEqual([...missing], [], 'id-er som mangler i index.html');
});

test('stedslista er gyldig', () => {
  const p = require('../places.json');
  assert.ok(p.length > 3000);
  for (const x of p) assert.ok(typeof x[0] === 'string' && Math.abs(x[1]) <= 90 && Math.abs(x[2]) <= 180, JSON.stringify(x));
});
