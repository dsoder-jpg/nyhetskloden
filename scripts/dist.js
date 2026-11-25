// Bygger Windows-appen og installasjonsprogrammet.
//   npm run dist:win   → dist/Nyhetskloden-win32-x64 og dist/installer/Nyhetskloden-Setup-<versjon>.exe
//   npm run release    → det samme, og publiserer installasjonsprogrammet som en GitHub-utgivelse (krever GitHub CLI: gh)
// Krever NSIS (makensis) installert: https://nsis.sourceforge.io (på Windows legges det i PATH).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const root = path.join(__dirname, '..');
const run = cmd => { console.log('> ' + cmd); execSync(cmd, { stdio: 'inherit', cwd: root }); };

run('npx electron-packager . Nyhetskloden --platform=win32 --arch=x64 --icon=build/icon.ico --out=dist --asar --overwrite ' +
    '--ignore="^/dist" --ignore="^/data" --ignore="^/scripts" --app-copyright=Daniel --win32metadata.CompanyName=Nyhetskloden ' +
    '--win32metadata.FileDescription=Nyhetskloden --win32metadata.ProductName=Nyhetskloden');
fs.mkdirSync(path.join(root, 'dist', 'installer'), { recursive: true });
const sep = process.platform === 'win32' ? '/' : '-';
run(`makensis ${sep}DVERSION=${pkg.version} ${sep}DSRC=../dist/Nyhetskloden-win32-x64 build/installer.nsi`);
const exe = `dist/installer/Nyhetskloden-Setup-${pkg.version}.exe`;
// liten oppdatering: bare appkoden, merket med Electron-hovedversjonen den passer til
const electronMajor = require('../node_modules/electron/package.json').version.split('.')[0];
const asar = `dist/installer/nyhetskloden-app-${pkg.version}-e${electronMajor}.asar`;
fs.copyFileSync(path.join(root, 'dist/Nyhetskloden-win32-x64/resources/app.asar'), path.join(root, asar));
console.log('\nFerdig:\n  ' + exe + '\n  ' + asar);
if (process.argv.includes('--release')) {
  run(`gh release create v${pkg.version} "${exe}" "${asar}" --repo ${pkg.nyhetskloden.updateRepo} --title "Nyhetskloden ${pkg.version}" --notes "Ny versjon av Nyhetskloden."`);
}
