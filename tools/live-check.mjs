// Yayındaki sayfayı denetler: PWA, çevrimdışı açılış, APK düğmesi.
import puppeteer from 'puppeteer-core';

const URL_LIVE = 'https://caglarsaglammmmm-code.github.io/blackjack-21/';
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL_LIVE, { waitUntil: 'networkidle2' });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle2' });

const apk = await page.$eval('#apk', (a) => ({ href: a.href, visible: a.offsetHeight > 0 }));
console.log('APK düğmesi:', apk);
const manifest = await page.evaluate(() => fetch('manifest.json').then((r) => r.json()));
console.log('Manifest:', manifest.name, manifest.display, manifest.icons.length, 'simge');
await new Promise((r) => { setTimeout(r, 1800); });
await page.screenshot({ path: 'e2e-out/canli-giris.png' });

await page.setOfflineMode(true);
await page.reload({ waitUntil: 'load' });
await new Promise((r) => { setTimeout(r, 800); });
await page.$eval('#name', (e) => { e.value = 'Cevrimdisi'; });
await page.$eval('#play', (e) => e.click());
await page.$eval('[data-chip="50"]', (e) => e.click());
await new Promise((r) => { setTimeout(r, 400); });
await page.$eval('#deal', (e) => e.click());
await new Promise((r) => { setTimeout(r, 2200); });
console.log('Çevrimdışı oyun aşaması:', await page.evaluate(() => __bj.game.phase), '| başlık:', await page.title());
console.log('Sayfa hatası:', errors.length ? errors : 'yok');
await browser.close();
