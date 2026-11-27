// Lokalaviser: appen legger til avisa nærmest hjemstedet ditt.
// Adressen til RSS-strømmen prøves i rekkefølge, og den første som virker brukes.
'use strict';

// [navn, lat, lon, domene, finnes allerede blant de faste kildene]
const PAPERS = [
  ['Telemarksavisa', 59.21, 9.61, 'ta.no'], ['Varden', 59.14, 9.66, 'varden.no'], ['Laagendalsposten', 59.67, 9.65, 'laagendalsposten.no'],
  ['Fædrelandsvennen', 58.15, 8.0, 'fvn.no'], ['Agderposten', 58.46, 8.77, 'agderposten.no'],
  ['Stavanger Aftenblad', 58.97, 5.73, 'aftenbladet.no', true], ['Haugesunds Avis', 59.41, 5.27, 'h-avis.no'],
  ['Bergens Tidende', 60.39, 5.32, 'bt.no', true], ['Firda', 61.45, 5.85, 'firda.no'],
  ['Sunnmørsposten', 62.47, 6.15, 'smp.no'], ['Romsdals Budstikke', 62.74, 7.16, 'rbnett.no'], ['Tidens Krav', 63.11, 7.73, 'tk.no'],
  ['Adresseavisen', 63.43, 10.39, 'adressa.no', true], ['Trønder-Avisa', 64.01, 11.5, 't-a.no'],
  ['Rana Blad', 66.31, 14.14, 'ranablad.no'], ['Avisa Nordland', 67.28, 14.4, 'an.no'], ['Harstad Tidende', 68.8, 16.54, 'ht.no'],
  ['iTromsø', 69.65, 18.96, 'itromso.no', true], ['Altaposten', 69.97, 23.27, 'altaposten.no'], ['Finnmark Dagblad', 70.66, 23.68, 'finnmarkdagblad.no'],
  ['Hamar Arbeiderblad', 60.79, 11.07, 'h-a.no'], ['Oppland Arbeiderblad', 60.8, 10.69, 'oa.no'], ['Gudbrandsdølen Dagningen', 61.12, 10.47, 'gd.no'],
  ['Østlendingen', 60.88, 11.56, 'ostlendingen.no'], ['Glåmdalen', 60.19, 12.0, 'glomdalen.no'], ['Ringerikes Blad', 60.17, 10.26, 'ringblad.no'],
  ['Drammens Tidende', 59.74, 10.2, 'dt.no'], ['Tønsbergs Blad', 59.27, 10.41, 'tb.no'], ['Sandefjords Blad', 59.13, 10.22, 'sb.no'],
  ['Fredriksstad Blad', 59.22, 10.93, 'f-b.no'], ['Sarpsborg Arbeiderblad', 59.28, 11.11, 'sa.no'], ['Moss Avis', 59.43, 10.66, 'moss-avis.no'],
  ['Halden Arbeiderblad', 59.12, 11.39, 'ha-halden.no'], ['Romerikes Blad', 59.96, 11.05, 'rb.no'], ['Budstikka', 59.89, 10.52, 'budstikka.no'],
  ['Aftenposten', 59.91, 10.75, 'aftenposten.no', true],
].map(([name, lat, lon, host, builtin]) => ({ name, lat, lon, host, builtin: !!builtin }));

const km = (a, b, c, d) => { const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
// nærmeste avis innen 150 km (lengre unna er det ikke lokalt)
function nearest(home) {
  if (!home || !isFinite(home.lat)) return null;
  let best = null;
  for (const p of PAPERS) { const d = km(home.lat, home.lon, p.lat, p.lon); if (!best || d < best.km) best = { ...p, km: Math.round(d) }; }
  return best && best.km <= 150 ? best : null;
}
const candidates = p => [`https://www.${p.host}/rss`, `https://www.${p.host}/service/rss`, `https://www.${p.host}/rss.xml`];

module.exports = { PAPERS, nearest, candidates };
