// Oppdaterer channels.json: hvilken versjon som er nyest i stabil og beta, med filnavn, størrelse og sha256.
// Appen leser denne fila fra GitHub (releases/download/updates/channels.json) i stedet for GitHub-API-et,
// som bare tillater 60 forespørsler i timen per nettverk.
// Bruk: node scripts/channels.js <channels.json> <versjon> <repo> <fil> [fil …]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [file, ver, repo, ...assets] = process.argv.slice(2);
if (!file || !ver || !repo || !assets.length) { console.error('Bruk: node scripts/channels.js <channels.json> <versjon> <repo> <fil> …'); process.exit(1); }
const cmp = (a, b) => {
  const [ma, pa] = a.split('-'), [mb, pb] = b.split('-');
  const x = ma.split('.').map(Number), y = mb.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  if (!pa && !pb) return 0; if (!pa) return 1; if (!pb) return -1;
  return (+(pa.match(/\d+/) || [0])[0]) - (+(pb.match(/\d+/) || [0])[0]);
};
let ch = {}; try { ch = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
const entry = { ver, at: new Date().toISOString(), files: assets.map(f => { const buf = fs.readFileSync(f), name = path.basename(f);
  return { name, size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), url: `https://github.com/${repo}/releases/download/${ver}/${name}` }; }) };
if (/-/.test(ver)) ch.beta = entry;
else { ch.stable = entry; if (!ch.beta || cmp(ch.beta.ver, ver) < 0) ch.beta = entry; }
fs.writeFileSync(file, JSON.stringify(ch, null, 2) + '\n');
console.log('stabil:', ch.stable && ch.stable.ver, 'beta:', ch.beta && ch.beta.ver);
