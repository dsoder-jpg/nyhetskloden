# Nyhetskloden

Nyhetskloden er en gratis Windows-app som viser nyheter fra hele verden på en 3D-klode. Hver sak plasseres der den skjer, og kloden oppdateres automatisk hvert 5. minutt.

## Last ned

1. Gå til [siste utgivelse](https://github.com/dsoder-jpg/nyhetskloden/releases/latest).
2. Last ned `Nyhetskloden-Setup-<versjon>.exe` og kjør filen.
3. Windows kan vise «Windows beskyttet PCen». Det skjer fordi appen ikke er signert. Trykk **Mer info → Kjør likevel**.

Appen installeres bare for din bruker, uten administratortilgang. Den får snarvei i startmenyen og på skrivebordet, og kan avinstalleres fra **Innstillinger → Apper** i Windows.

Appen holder seg oppdatert selv. Du trenger ikke laste ned nye versjoner manuelt. Under **Innstillinger → Oppdateringer** kan du velge betaversjonen for å få nye funksjoner før alle andre.

## Funksjoner

**Kloden**
- Satellittbilde eller kart, med natt-skygge der det er mørkt akkurat nå.
- Land farges etter hvor mye de er omtalt, og buer viser land som nevnes i samme sak.
- Saker om det samme fra flere kilder slås sammen til én markør, også når kildene skriver på ulike språk. Store saker får større markør.
- Tidslinje for siste time, 6 timer, døgn eller uke. Ved avspilling dukker sakene opp på kloden i den rekkefølgen de skjedde.
- Vær i norske byer fra Yr og nedbørsradar som eget lag.
- Jordskjelv vises med ringer etter styrke, og tropiske stormer med bane fra GDACS.
- Byer lyser på nattsiden av kloden. Zoomer du inn der det er natt, vises ekte nattbilder fra NASA.
- Kloden snurrer sakte når du ikke bruker den.
- Klikk på et land for fakta: hovedstad, folketall, klokka og været der.
- Tidsreise: se hvordan kloden så ut en tidligere dag fra arkivet.
- Strømpris i de fem norske prisområdene, og veitrafikk fra Statens vegvesen (krever gratis DATEX-tilgang).

**Nyheter**
- Kategorier: krim og ulykker, krig og sikkerhet, politikk, natur og vær, samferdsel, marked, teknologi, helse, vitenskap, energi, kultur, kongehus og sport.
- Faner for alle saker, de viktigste siste døgn, saker nær deg, saker du følger og saker du har lagret.
- Følg ord eller steder og få varsel når de dukker opp.
- Bilde fra kilden i saken, når kilden har et.
- Del en sak med lenke eller QR-kode til mobilen.
- Norske titler på utenlandske saker med en gratis DeepL-nøkkel (valgfritt).
- Se hvordan en sak har utviklet seg: hvem meldte først, og hvem fulgte opp.
- Se om en sak er bekreftet av flere uavhengige medier, og hvor i verden de er fra.
- Døgnet oppsummert, tråder for saker som varer i flere dager, og en lesekø for saker du vil lese senere.
- Lytt til NRK- og BBC-radio og nyhetspodkaster rett i appen.
- Søk som tåler skrivefeil, bøyninger og ulike stavemåter (Kharkov finner Kharkiv), også i arkivet over saker fra de siste 90 dagene.
- Egne kildelister du kan bytte mellom, for eksempel bare norske kilder eller bare økonomi.
- «Siden sist»: når du åpner appen etter noen timer, ser du det viktigste som skjedde mens du var borte.
- Innsikt: hvilke land, temaer og ord som har fått mest omtale siste uke eller måned.
- «Mindre av dette»: skjul en kilde, et tema eller et ord rett fra en sak.
- Legg til egne RSS-kilder. Kilder som slutter å virke settes på pause og vises i Innstillinger.

**Marked**
- Over 20 børsindekser fra hele verden, valuta, råvarer og krypto, med valgfri periode fra 1 dag til 5 år.
- Søk etter aksjer, fond og indekser, og se graf, nøkkeltall og nyheter om selskapet for hver enkelt.
- Sammenlign to aksjer eller indekser i samme graf.
- Dagens største vinnere og tapere på Oslo Børs.
- Egen liste over aksjer du vil følge, og en portefølje som viser verdi og gevinst i kroner.
- Varsel når en aksje du eier eller følger går mye opp eller ned i løpet av en dag.

**Vær og varsler**
- Værvarsel fra Yr for hjemstedet ditt: nå, time for time og neste dager, med farevarsler fra MET.
- Varsel på skrivebordet ved store saker, valgt per kategori, med stille timer. Flere saker samles i ett varsel.
- Varsel når en sak du har lagret får en ny utvikling, og når en kilde har vært nede i et døgn.
- Daglig oppsummering om morgenen med døgnets viktigste saker.

**Annet**
- Ticker-stripe som ligger øverst eller nederst på skjermen, og en liten widget på skrivebordet.
- Lagre et bilde av kloden eller dagens saker som PDF.
- Flytrafikk på kloden, og skipstrafikk langs norskekysten (krever gratis BarentsWatch-konto).
- Mobilvisning: åpne kloden på mobilen når den er på samme nettverk som PC-en.
- Mørkt, lyst og høykontrast tema, større tekst og hurtigtaster (trykk ? i appen).
- Virker uten nett: viser lagrede saker og sier fra når nettet er borte.

Alt kan slås av og på under **Innstillinger**.

## Personvern

Appen har ingen konto og sender ingen data om deg noe sted. Den henter bare nyheter og data fra kildene under. Innstillinger, lagrede saker, porteføljen og eventuelle nøkler lagres lokalt i `%APPDATA%\Nyhetskloden`.

## Kilder

- Nyheter: rundt 100 RSS-strømmer fra hele verden, blant annet NRK, VG, Aftenposten, Bergens Tidende, BBC, Financial Times, The Guardian, Al Jazeera, Washington Post, CBC, Le Monde, Euronews, SVT, DR, Yle, Times of India, South China Morning Post og ABC Australia.
- Jordskjelv: [USGS](https://earthquake.usgs.gov/). Naturkatastrofer: [GDACS](https://www.gdacs.org/).
- Vær og farevarsler: [MET Norge / Yr](https://api.met.no/).
- Kurser: Yahoo Finance. Fly: [adsb.lol](https://adsb.lol/). Skip: [BarentsWatch](https://www.barentswatch.no/).
- Kart: [OpenFreeMap](https://openfreemap.org/) og OpenStreetMap. Satellitt: Esri World Imagery. Nattbilder: NASA Black Marble via [GIBS](https://earthdata.nasa.gov/gibs).

Kursene kan være forsinket og er ikke ment som investeringsråd.

## Bygge selv

Krever [Node.js](https://nodejs.org/) 20 eller nyere. For installasjonsfilen trengs også [NSIS](https://nsis.sourceforge.io/).

```
npm install
npm start          # start appen
npm run server     # bare nyhetsmotoren, åpne http://localhost:3000 i nettleseren
npm test           # kjør testene
npm run lint       # kodesjekk
npm run dist:win   # lag installasjonsfil i dist/installer/
```

Nye utgivelser lages automatisk av GitHub Actions når versjonsnummeret i `package.json` endres på `main`. Testene (`npm test`) må gå gjennom først. Versjoner som `3.4.0-beta.1` blir betaversjoner.

| Fil | Innhold |
|---|---|
| `main.js` | Electron: vinduer, ticker, varsler, oppdateringer |
| `server.js` | Nyhetsmotoren: henter og grupperer saker, finner steder, sanntid |
| `extras.js` | Marked, vær, fly og skip |
| `public/index.html` | Oppsettet for kloden og sidepanelet |
| `public/js/` | Koden for siden, delt i moduler (kart, panel, marked, vær …) |
| `public/css/app.css` | Utseendet |
| `public/widget.html` | Widgeten på skrivebordet |
| `build/installer.nsi` | Installasjonsprogrammet (NSIS) |

## Lisens

MIT
