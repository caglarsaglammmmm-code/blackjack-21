// Gerçek tarayıcıda (Edge) uçtan uca deneme. Sunucu açıkken: npm run e2e
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'e2e-out';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.E2E_URL || 'http://localhost:8080/';
const EXE = process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const log = [];
const ok = (cond, text) => {
  log.push(`${cond ? 'GEÇTİ' : 'KALDI'}: ${text}`);
  console.log(log.at(-1));
  if (!cond) process.exitCode = 1;
};

async function open(w, h) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`console: ${m.text()}`); });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'load' });
  return { page, errors };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const phase = (page) => page.evaluate(() => __bj.game.phase);
const money = (page) => page.evaluate(() => __bj.game.money);
const tap = (page, sel) => page.$eval(sel, (el) => el.click());
const idle = (page) => page.waitForFunction(() => !document.body.classList.contains('busy'), { timeout: 15000 });
const press = async (page, sel) => { await tap(page, sel); await sleep(100); await idle(page); };

async function enter(page) {
  await page.$eval('#name', (e) => { e.value = 'Deneme'; });
  await tap(page, '#play');
  await page.waitForSelector('#game.active');
}

async function setShoe(page, order) {
  await page.evaluate((list) => {
    const g = __bj.game;
    const cards = list.map((t) => ({ rank: t.slice(0, -1), suit: t.at(-1) }));
    g.shoe = [...g.shoe.slice(0, 200), ...cards.reverse()];
  }, order);
}

async function round(page, order, moves, name) {
  await setShoe(page, order);
  await tap(page, '[data-chip="100"]');
  await sleep(380);
  if (name) await shot(page, `${name}-bahis`);
  await press(page, '#deal');
  if (name) await shot(page, `${name}-el`);
  for (const id of moves) await press(page, id);
  if (name) await shot(page, `${name}-son`);
}

const next = async (page) => { await tap(page, '#new-bet'); await sleep(320); await idle(page); };

{
  const { page, errors } = await open(390, 844);
  await sleep(2200);
  await shot(page, 'giris');
  ok(await page.$eval('#title', (e) => e.getAttribute('aria-label')) === 'Tam Tokatlık 21', 'başlık tek yerden geliyor');
  await page.$eval('#name', (e) => { e.value = 'amk'; });
  await tap(page, '#play');
  ok((await page.$eval('#name-error', (e) => e.textContent)).length > 0, 'küfürlü ad reddedildi');
  await enter(page);
  await sleep(300);
  await shot(page, 'masa-bos');

  await round(page, ['10S', '6H', '9D', '10C', 'KD'], ['#stand'], 'kazanma');
  ok(await money(page) === 600, 'kazanma 1:1 (600)');
  await page.waitForFunction(() => document.getElementById('money').textContent === '600', { timeout: 3000 });
  ok(true, 'para sayacı 600 gösterdi');
  await next(page);

  await round(page, ['AS', '9H', 'KD', '7C'], [], 'blackjack');
  ok(await money(page) === 750, 'blackjack 3:2 (750)');
  ok(await page.evaluate(() => __bj.store.best) === 750, 'rekor güncellendi');
  await next(page);

  await round(page, ['10S', 'AH', '9D', 'KC'], [], null);
  ok(await phase(page) === 'insurance', 'açık As sigorta sordu');
  await shot(page, 'sigorta');
  await press(page, '#ins-yes');
  ok(await money(page) === 750, 'sigorta kazandı, para aynı');
  await next(page);

  await round(page, ['8S', '6H', '8D', '10C', '3H', '2D', 'KS', '5C'], [], null);
  ok(await page.$eval('#split', (e) => !e.disabled), 'Böl açık');
  await press(page, '#split');
  await shot(page, 'bolme');
  await press(page, '#double');
  await press(page, '#stand');
  await sleep(200);
  await shot(page, 'bolme-son');
  ok(await phase(page) === 'settled', 'bölünen eller bitti');
  const afterSplit = await money(page);
  await next(page);

  await round(page, ['10S', '5H', '6D', '10C', 'KH'], ['#hit'], 'batma');
  ok(await money(page) === afterSplit - 100, 'bust bahsi kaybettirdi');

  await next(page);
  await setShoe(page, ['10S', '5H', '6D', '10C', '3S']);
  await tap(page, '[data-chip="50"]');
  await sleep(350);
  await press(page, '#deal');
  await page.reload({ waitUntil: 'load' });
  await sleep(300);
  await tap(page, '#play');
  await sleep(300);
  ok(await phase(page) === 'player', 'yenileme eli geri yükledi');
  ok(await page.$$eval('#card-layer .card', (c) => c.length) === 4, 'kartlar yeniden çizildi');
  await shot(page, 'geri-yukleme');
  await press(page, '#stand');
  await next(page);

  await page.evaluate(() => { __bj.game.money = 100; });
  await round(page, ['10S', '10H', '6D', '10C', '5D'], ['#stand'], null);
  await sleep(100);
  ok(await page.$eval('#bankrupt', (e) => e.classList.contains('open')), 'iflas ekranı açıldı');
  await shot(page, 'iflas');
  const before = await page.evaluate(() => __bj.store.best);
  await tap(page, '#restart');
  await sleep(450);
  ok(await money(page) === 500, 'iflas sonrası 500');
  ok(await page.evaluate(() => __bj.store.best) === before, 'rekor iflastan sonra korundu');

  await tap(page, '#open-settings-2');
  await sleep(250);
  await shot(page, 'ayarlar');
  await tap(page, '#set-fast');
  ok(await page.evaluate(() => __bj.store.settings.fast), 'hızlandırma kaydedildi');
  await tap(page, '#close-settings');
  ok(errors.length === 0, `konsol hatası yok ${errors.join(' | ')}`);
}

for (const [w, h, name] of [[360, 640, 'kucuk'], [1280, 800, 'masaustu']]) {
  const { page, errors } = await open(w, h);
  await sleep(1800);
  await shot(page, `giris-${name}`);
  await enter(page);
  await sleep(200);
  await round(page, ['KS', '9H', '4D', '6C', 'AH', '3D', '10S'], ['#hit'], name);
  const overflow = await page.evaluate(() => {
    const t = document.getElementById('table').getBoundingClientRect();
    return [...document.querySelectorAll('#card-layer .card, .hand-badge.show')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.bottom > t.bottom + 1 || r.right > t.right + 1 || r.left < t.left - 1;
    }).length;
  });
  ok(overflow === 0, `${name}: masadan taşan öğe yok`);
  const fits = await page.evaluate(() => [...document.querySelectorAll('.panel.open .btn')].every((b) => b.getBoundingClientRect().bottom <= innerHeight));
  ok(fits, `${name}: düğmeler ekranda`);
  ok(errors.length === 0, `${name}: konsol hatası yok ${errors.join(' | ')}`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'rapor.txt'), log.join('\n'));
