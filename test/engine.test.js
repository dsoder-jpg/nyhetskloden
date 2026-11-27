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
