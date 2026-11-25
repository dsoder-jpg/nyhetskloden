# Nyhetskloden 3.0

En Windows-app som viser nyheter fra hele verden på en 3D-klode, oppdatert hvert 5. minutt.

## Installere

Kjør `Nyhetskloden-Setup-3.0.0.exe`. Appen installeres bare for deg (uten administrator) i
`%LOCALAPPDATA%\Programs\Nyhetskloden`, med snarvei i startmenyen og på skrivebordet. Den avinstalleres
fra Innstillinger → Apper. Windows SmartScreen kan advare fordi programmet ikke er signert: velg **Mer info → Kjør likevel**.

## Hva den kan

- **Hendelser:** Saker fra flere kilder om det samme slås sammen til én markør, for eksempel «4 kilder».
- **Viktighetsscore:** Antall kilder, toppsak-status og alvor (dødsfall, jordskjelvstørrelse, røde varsler) gir markørstørrelse. Store saker vises i den røde «Siste nytt»-stripa og gir varsel.
- **Tidslinje:** Spill av siste time, døgn eller uke (▶ eller mellomromstasten).
- **Buer mellom land** som nevnes i samme sak.
- **Landpanel:** Klikk på et land for å se sakene derfra og en kurve over omtale siste 7 døgn.
- **Farevarsler fra MET:** Gule, oransje og røde områder i Norge.
- **Følger:** Ord og steder du vil følge (Innstillinger). Treff merkes og gir varsel.
- **Lest og lagret:** Åpnede saker dimmes. Stjerna lagrer en sak under «Lagret».
- **Ticker:** En stripe øverst på skjermen som alltid ligger over andre vinduer. Slå den av og på med knappen eller fra menyen ved klokka.
- **Norske titler:** Lim inn en gratis DeepL-nøkkel under Innstillinger (DeepL API Free).
- **Egne kilder:** Legg til hvilken som helst RSS-feed under Innstillinger.

## Oppdateringer

Appen ser etter nye versjoner under GitHub Releases i repoet som står i `package.json` → `nyhetskloden.updateRepo`
(nå `dsoder-jpg/nyhetskloden`). Slik publiserer du en ny versjon:

1. Lag repoet på GitHub hvis det ikke finnes. Er brukernavnet ditt et annet, endrer du `updateRepo`.
2. Øk `version` i `package.json`, for eksempel til 3.0.1.
3. Kjør `npm run release`. Dette krever [NSIS](https://nsis.sourceforge.io) og [GitHub CLI](https://cli.github.com) (`gh auth login`).

Appene som er installert, finner versjonen innen 6 timer, eller med en gang via «Se etter oppdateringer» i menyen ved klokka.
Da lastes installasjonsprogrammet ned og installeres stille med ett klikk.

## Utvikle

```
npm install
npm start          # kjør appen
npm run server     # bare nyhetsmotoren, i nettleseren på http://localhost:3000
npm run dist:win   # lag dist/Nyhetskloden-win32-x64 og dist/installer/Nyhetskloden-Setup-<versjon>.exe
```

| Fil | Hva |
|---|---|
| `main.js` | Electron: vindu, ticker, systemstatusfelt, varsler, oppdateringer |
| `server.js` | Nyhetsmotor: kilder, gruppering, score, steder, oversettelse, følger, MET-varsler, sanntid (SSE) |
| `public/index.html` | Kloden og sidepanelet (MapLibre GL) |
| `public/ticker.html` | Tickerstripa |
| `build/installer.nsi` | Installasjonsprogrammet (NSIS) |

Innstillinger og saker lagres i `%APPDATA%\Nyhetskloden`. De blir liggende hvis appen avinstalleres.
