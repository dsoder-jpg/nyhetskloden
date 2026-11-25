# Nyhetskloden

Nyhetskloden er en gratis Windows-app som viser nyheter fra hele verden på en 3D-klode. Hver sak plasseres der den skjer, og kloden oppdateres automatisk hvert 5. minutt.

## Last ned

1. Gå til [siste utgivelse](https://github.com/dsoder-jpg/nyhetskloden/releases/latest).
2. Last ned `Nyhetskloden-Setup-<versjon>.exe` og kjør filen.
3. Windows kan vise «Windows beskyttet PCen». Det skjer fordi appen ikke er signert. Trykk **Mer info → Kjør likevel**.

Appen installeres bare for din bruker, uten administratortilgang. Den får snarvei i startmenyen og på skrivebordet, og kan avinstalleres fra **Innstillinger → Apper** i Windows.

Appen holder seg oppdatert selv. Du trenger ikke laste ned nye versjoner manuelt.

## Funksjoner

**Kloden**
- Satellittbilde eller kart, med natt-skygge der det er mørkt akkurat nå.
- Land farges etter hvor mye de er omtalt, og buer viser land som nevnes i samme sak.
- Saker om det samme fra flere kilder slås sammen til én markør. Store saker får større markør.
- Tidslinje for siste time, 6 timer, døgn eller uke, med avspilling.

**Nyheter**
- Kategorier: krim og ulykker, krig og sikkerhet, politikk, natur og vær, samferdsel, marked, teknologi, helse, vitenskap, energi, kultur, kongehus og sport.
- Faner for alle saker, de viktigste siste døgn, saker nær deg, saker du følger og saker du har lagret.
- Følg ord eller steder og få varsel når de dukker opp.
- Del en sak med lenke eller QR-kode til mobilen.
- Norske titler på utenlandske saker med en gratis DeepL-nøkkel (valgfritt).
- Legg til egne RSS-kilder.

**Marked**
- Børsindekser (Oslo Børs, S&P 500, Nasdaq, DAX m.fl.), valuta, olje, gull og bitcoin.
- Dagens største vinnere og tapere på Oslo Børs.
- Egen liste over aksjer du vil følge.

**Vær og varsler**
- Værvarsel for hjemstedet ditt fra Yr/MET og farevarsler fra MET.
- Varsel på skrivebordet ved store saker, med stille timer.
- Daglig oppsummering om morgenen med døgnets viktigste saker.

**Annet**
- Ticker-stripe som ligger øverst eller nederst på skjermen.
- Flytrafikk på kloden, og skipstrafikk langs norskekysten (krever gratis BarentsWatch-konto).
- Mobilvisning: åpne kloden på mobilen når den er på samme nettverk som PC-en.
- Mørkt og lyst tema, og større tekst.

Alt kan slås av og på under **Innstillinger**.

## Personvern

Appen har ingen konto og sender ingen data om deg noe sted. Den henter bare nyheter og data fra kildene under. Innstillinger, lagrede saker og eventuelle nøkler lagres lokalt i `%APPDATA%\Nyhetskloden`.

## Kilder

- Nyheter: RSS-strømmer fra blant annet NRK, VG, Aftenposten, E24, BBC, The Guardian, Al Jazeera, The Verge, NASA og WHO.
- Jordskjelv: [USGS](https://earthquake.usgs.gov/). Naturkatastrofer: [GDACS](https://www.gdacs.org/).
- Vær og farevarsler: [MET Norge / Yr](https://api.met.no/).
- Kurser: Yahoo Finance. Fly: [adsb.lol](https://adsb.lol/). Skip: [BarentsWatch](https://www.barentswatch.no/).
- Kart: [OpenFreeMap](https://openfreemap.org/) og OpenStreetMap. Satellitt: Esri World Imagery.

Kursene kan være forsinket og er ikke ment som investeringsråd.

## Bygge selv

Krever [Node.js](https://nodejs.org/) 20 eller nyere. For installasjonsfilen trengs også [NSIS](https://nsis.sourceforge.io/).

```
npm install
npm start          # start appen
npm run server     # bare nyhetsmotoren, åpne http://localhost:3000 i nettleseren
npm run dist:win   # lag installasjonsfil i dist/installer/
```

Nye utgivelser lages automatisk av GitHub Actions når versjonsnummeret i `package.json` endres på `main`.

| Fil | Innhold |
|---|---|
| `main.js` | Electron: vinduer, ticker, varsler, oppdateringer |
| `server.js` | Nyhetsmotoren: henter og grupperer saker, finner steder, sanntid |
| `extras.js` | Marked, vær, fly og skip |
| `public/index.html` | Kloden og sidepanelet (MapLibre GL) |
| `build/installer.nsi` | Installasjonsprogrammet (NSIS) |

## Lisens

MIT
