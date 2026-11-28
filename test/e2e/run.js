/* eslint-disable no-undef -- koden i page.evaluate kjører i nettleseren */
// Skjermtest: starter motoren med testdata, åpner appen i Chromium og sjekker at de viktigste delene virker.
// Skjermbildene lagres i test/e2e/bilder, og GitHub lagrer dem sammen med hver bygging.
// Kjør med: npm run e2e   (lokalt kan du peke på en Chrome med CHROME_PATH=...)
'use strict';
require('./mock.js');
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const http = require('http');
// motoren nås med http direkte (fetch er byttet ut med testdata)
const post = (p, body) => new Promise(res => { const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'POST', headers: { 'Content-Type': 'application/json' } }, x => { x.resume(); x.on('end', res); }); r.on('error', res); r.end(body ? JSON.stringify(body) : ''); });
const engine = require('../../server.js');

const OUT = path.join(__dirname, 'bilder');
const PORT = 3999, URL = `http://127.0.0.1:${PORT}/`;
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FEIL ') + what); if (!ok) fails.push(what); };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nk-e2e-'));
  engine.start({ port: PORT, dataDir });
  await new Promise(r => setTimeout(r, 2500));
  await post('/api/settings', { onboarded: true, home: { name: 'Bø', lat: 59.41, lon: 9.07 }, trades: [{ sym: 'EQNR.OL', side: 'buy', qty: 50, price: 240, date: '2025-01-10' }] });
  await post('/api/refresh');
  await new Promise(r => setTimeout(r, 2500));

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.route('https://img.test/**', r => r.fulfill({ status: 404, body: '' }));
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });

  await page.goto(URL); await page.waitForTimeout(9000);
  check(await page.evaluate(() => EVENTS.length > 5), 'sakene lastes');
  check(await page.evaluate(() => typeof ready !== 'undefined' && ready === true), 'kartet lastes');
  await shot('1-start');

  const ev = await page.evaluate(() => (EVENTS.find(e => /Kharkiv/.test(e.title)) || EVENTS[0]).id);
  await page.evaluate(id => select(id, true), ev); await page.waitForTimeout(2000);
  check(await page.evaluate(() => !document.getElementById('card').hidden), 'saken åpnes');
  check(await page.evaluate(() => /ulike tall/.test(document.getElementById('cDis').textContent)), 'ulike tall vises');
  await shot('2-sak');

  await page.click('#cStory'); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.querySelectorAll('#stBody ol.story li li').length >= 2), 'tidslinjen for saken');
  await page.click('#stX');

  await page.evaluate(() => { select(null); setSide('market'); }); await page.waitForTimeout(3500);
  check(await page.evaluate(() => /Min portefølje/.test(document.getElementById('mBody').textContent)), 'porteføljen vises');
  await shot('3-marked');
  await page.evaluate(() => openDetail('EQNR.OL')); await page.waitForTimeout(2500);
  check(await page.evaluate(() => /Børsmeldinger/.test(document.getElementById('mBody').textContent)), 'børsmeldinger vises');
  await shot('4-aksje');

  await page.evaluate(() => { MDET = null; setSide('news'); openSettings('notify'); }); await page.waitForTimeout(1200);
  check(await page.evaluate(() => document.getElementById('dlg').open), 'innstillinger åpnes');
  await shot('5-innstillinger');
  await page.keyboard.press('Escape');

  // lyst tema og engelsk
  await page.evaluate(() => { localStorage.setItem('nk-look', JSON.stringify({ theme: 'light', zoom: 1, lang: 'en' })); });
  await page.reload(); await page.waitForTimeout(8000);
  check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), 'lyst tema');
  check(await page.evaluate(() => /Settings/.test(document.body.innerText) && /Map layers/.test(document.body.innerText)), 'engelsk grensesnitt');
  await shot('6-lyst-engelsk');

  check(errors.length === 0, 'ingen feil i siden' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log(fails.length ? `\n${fails.length} feil` : '\nAlt virker');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
