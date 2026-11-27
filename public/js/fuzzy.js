/* global module */
// Felles ordnormalisering: brukes av motoren (slå sammen saker på tvers av språk)
// og av appen (søk som tåler skrivefeil, bøyninger og ulike stavemåter).
const FUZZY = (() => {
  // samme sted, ulike stavemåter → én form
  const PLACE = {
    kharkov: 'kharkiv', charkiv: 'kharkiv', kharkiw: 'kharkiv', charkov: 'kharkiv',
    kiev: 'kyiv', kijev: 'kyiv', kyjiv: 'kyiv', odessa: 'odesa', lvov: 'lviv',
    zaporizjzja: 'zaporizhzhia', zaporozhye: 'zaporizhzhia', zaporizhia: 'zaporizhzhia',
    mykolajiv: 'mykolaiv', nikolaev: 'mykolaiv', bachmut: 'bakhmut', donetsk: 'donetsk', donetsjk: 'donetsk',
    cherson: 'kherson', dnepr: 'dnipro', dnipropetrovsk: 'dnipro', tsjernihiv: 'chernihiv', sumi: 'sumy',
    peking: 'beijing', beijing: 'beijing', bombay: 'mumbai', burma: 'myanmar', moskva: 'moskva', moscow: 'moskva',
    ukraine: 'ukraina', russia: 'russland', china: 'kina', germany: 'tyskland', france: 'frankrike',
    sweden: 'sverige', norway: 'norge', denmark: 'danmark', finland: 'finland', iceland: 'island',
    poland: 'polen', spain: 'spania', italy: 'italia', greece: 'hellas', turkey: 'tyrkia', turkiye: 'tyrkia',
    syria: 'syria', lebanon: 'libanon', egypt: 'egypt', iraq: 'irak', saudi: 'saudi', japan: 'japan',
    korea: 'korea', india: 'india', pakistan: 'pakistan', afghanistan: 'afghanistan', taiwan: 'taiwan',
    brazil: 'brasil', mexico: 'mexico', canada: 'canada', australia: 'australia', netherlands: 'nederland',
    belgium: 'belgia', switzerland: 'sveits', austria: 'osterrike', hungary: 'ungarn', romania: 'romania',
    britain: 'storbritannia', england: 'england', scotland: 'skottland', ireland: 'irland',
    america: 'usa', american: 'usa', amerikansk: 'usa', amerikanske: 'usa', russian: 'russland', russisk: 'russland', russiske: 'russland',
    ukrainian: 'ukraina', ukrainsk: 'ukraina', ukrainske: 'ukraina', israeli: 'israel', israelsk: 'israel', israelske: 'israel',
    chinese: 'kina', kinesisk: 'kina', kinesiske: 'kina', iranian: 'iran', iransk: 'iran', iranske: 'iran',
    palestinian: 'palestina', palestinsk: 'palestina', palestinske: 'palestina', palestinians: 'palestina',
  };
  const PVALS = new Set(Object.values(PLACE));
  // samme begrep på engelsk og norsk → én form
  const SYN = {};
  const grp = (to, words) => { for (const w of words.split(' ')) SYN[w] = to; };
  grp('angrep', 'attack attacks attacked angrep angrepet angrepene angriper angrepa strike strikes airstrike airstrikes luftangrep luftangrepet bombing bombed bombe bomber bombet');
  grp('drept', 'killed kills kill killing dead death deaths drept drepte dreper drepes omkom omkommet døde dode død dod dødstall dodstall');
  grp('skadet', 'injured wounded hurt skadet skadde såret saret');
  grp('drone', 'drone drones droner dronene droneangrep');
  grp('rakett', 'missile missiles rocket rockets rakett raketter missil missiler');
  grp('jordskjelv', 'earthquake earthquakes quake jordskjelv jordskjelvet skjelv');
  grp('flom', 'flood floods flooding flom flommen oversvømmelse oversvommelse');
  grp('brann', 'fire fires wildfire wildfires blaze brann brannen skogbrann skogbrannen');
  grp('storm', 'storm storms hurricane typhoon cyclone orkan orkanen tyfon tyfonen syklon uvær uvaer');
  grp('valg', 'election elections vote voting valg valget valgene stemmer');
  grp('våpenhvile', 'ceasefire truce våpenhvile vapenhvile våpenhvilen vapenhvilen');
  grp('fredsavtale', 'peace fred freden fredsavtale fredssamtaler');
  grp('forhandling', 'talks negotiations negotiation forhandlinger forhandling samtaler');
  grp('sanksjon', 'sanction sanctions sanksjon sanksjoner sanksjonene');
  grp('krig', 'war wars krig krigen');
  grp('streik', 'walkout streik streiken streiker');
  grp('protest', 'protest protests protesters demonstration demonstrations protester demonstrasjon demonstrasjoner demonstranter');
  grp('gissel', 'hostage hostages gissel gisler gislene');
  grp('regjering', 'government regjering regjeringen');
  grp('statsminister', 'premier statsminister statsministeren');
  grp('president', 'president presidenten presidents');
  grp('politi', 'police politi politiet');
  grp('skyting', 'shooting shootings gunman skyting skytingen skyteepisode');
  grp('eksplosjon', 'explosion explosions blast eksplosjon eksplosjonen');
  grp('ulykke', 'crash accident collision ulykke ulykken krasj kollisjon');
  grp('fly', 'plane aircraft airliner flight flyet flystyrt');
  grp('tog', 'train trains toget togulykke');
  grp('rente', 'renten rente rentene');
  grp('sentralbank', 'central sentralbank sentralbanken norges');
  grp('tollsats', 'tariff tariffs toll tollsats tollsatser');
  grp('arrestert', 'arrested arrest arrestert arrestasjon pågrepet pagrepet siktet charged');
  grp('dømt', 'sentenced convicted dømt domt dommen');
  grp('evakuert', 'evacuated evacuation evakuert evakuering');
  grp('vulkan', 'volcano eruption vulkan vulkanen utbrudd');
  grp('tsunami', 'tsunami tsunamivarsel');
  grp('soldat', 'soldier soldiers troops soldat soldater styrker');
  grp('flyktning', 'refugee refugees flyktning flyktninger');
  grp('sykehus', 'hospital hospitals sykehus sykehuset');
  grp('skole', 'school schools skole skolen');
  grp('kirke', 'church kirke kirken');
  const STOP = new Set(('this that with from have will been were their after over into about than what when where which while would could says said ' +
    'amid more most also just only first year years week news live update updates video watch under være vaere etter mellom eller blir ble skal kan vil ' +
    'ikke dette denne disse også ogsa både bade mens fordi mange flere sier mener nytt nyhet nyheter følge folge minst least nrk').split(' '));
  const SUF = ['ingene', 'ingen', 'ene', 'ane', 'ers', 'ing', 'ens', 'ets', 'en', 'et', 'er', 'ed', 'es', 'a', 'e', 's'];
  const fold = s => (s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const raw = s => (s || '').toLowerCase().normalize('NFC').match(/[\p{L}0-9]+/gu) || [];
  // stamme: dropper vanlige endelser så «angrepet», «angrepene» og «angrep» blir like
  function stem(w) { if (/^\d/.test(w)) return w; for (const s of SUF) if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length); return w; }
  // ett ord → normal form
  function norm(w0) {
    const w = w0.toLowerCase();
    if (SYN[w]) return fold(SYN[w]);
    const f = fold(w);
    if (SYN[f]) return fold(SYN[f]);
    if (PLACE[f]) return PLACE[f];
    if (PVALS.has(f)) return f;
    const st = stem(f);
    if (SYN[st]) return fold(SYN[st]);
    if (PLACE[st]) return PLACE[st];
    return st;
  }
  // ordsett for sammenslåing av saker
  function tokens(s) {
    const out = new Set();
    for (const w of raw(s)) {
      if (/^\d+$/.test(w)) { if (w.length >= 2 && w.length <= 4 && !/^(19|20)\d\d$/.test(w)) out.add(w); continue; }
      const f = fold(w);
      if (STOP.has(w) || STOP.has(f)) continue;
      const known = SYN[w] || SYN[f] || PLACE[f];
      if (!known && f.length < 4) continue;
      out.add(norm(w));
    }
    return out;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  // tekst → ord klare for søk (lagres gjerne på saken)
  const prep = s => raw(s).map(w => { const f = fold(w); return { f, n: norm(w) }; });
  // ett søkeord mot ett tekstord
  function wordHit(q, t) {
    if (t.f === q.f || t.n === q.n) return true;
    if (q.f.length >= 3 && t.f.startsWith(q.f)) return true;
    if (q.f.length >= 5) { const max = q.f.length >= 9 ? 2 : 1; if (lev(q.f, t.f.slice(0, q.f.length + max), max) <= max || lev(q.n, t.n, max) <= max) return true; }
    return false;
  }
  // alle søkeordene må finnes i teksten (tåler skrivefeil og bøyning)
  function match(query, text) {
    const qs = prep(query).filter(q => q.f.length >= 2);
    if (!qs.length) return true;
    const ts = Array.isArray(text) ? text : prep(text);
    return qs.every(q => ts.some(t => wordHit(q, t)));
  }
  return { tokens, norm, fold, prep, match, lev };
})();
if (typeof module === 'object') module.exports = FUZZY;
