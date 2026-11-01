// Skor tablosu denemesi. Emülatör içinde çalışır: npm run test:score
// 1) Güvenlik kuralları gerçek istemci SDK'sıyla zorlanır.
// 2) İki ayrı tarayıcı oturumu aynı tabloda yarışır, biri çevrimdışı rekor biriktirir.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, setLogLevel, updateDoc,
} from 'firebase/firestore';
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_URL || 'http://localhost:8091/';
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
let failed = 0;
const ok = (cond, text) => {
  console.log(`${cond ? 'GEÇTİ' : 'KALDI'}: ${text}`);
  if (!cond) failed += 1;
};

function client(tag) {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-tokatlik', appId: tag }, tag);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  return { auth, db };
}
const denied = async (promise) => {
  try {
    await promise;
    return false;
  } catch (e) {
    return e.code === 'permission-denied';
  }
};

async function rulesTest() {
  setLogLevel('silent');
  const a = client('a');
  const b = client('b');
  const anon = client('anon');
  const ua = (await signInAnonymously(a.auth)).user.uid;
  const ub = (await signInAnonymously(b.auth)).user.uid;
  const mine = doc(a.db, 'scores', ua);
  const row = (best, name = 'Ali') => ({ name, best, updatedAt: serverTimestamp() });

  ok(await denied(setDoc(doc(anon.db, 'scores', 'x'), row(500))), 'girişsiz yazılamaz');
  ok(await denied(setDoc(mine, row(1251))), 'ilk kayıt 1250 üstü reddedilir');
  ok(await denied(setDoc(mine, row(400))), 'ilk kayıt 500 altı reddedilir');
  ok(await denied(setDoc(mine, row(500, 'x'.repeat(17)))), '17 karakterli ad reddedilir');
  ok(await denied(setDoc(mine, { name: 'Ali', best: 500, updatedAt: new Date(0) })), 'sahte zaman reddedilir');
  ok(await denied(setDoc(mine, { ...row(500), hack: 1 })), 'fazladan alan reddedilir');
  await setDoc(mine, row(1000));
  ok(true, 'geçerli ilk kayıt yazıldı');
  ok(await denied(setDoc(mine, row(1200))), '1 saniyeden sık yazılamaz');
  await sleep(1200);
  ok(await denied(setDoc(mine, row(2501))), 'tek elde 2,5 kattan fazla artış reddedilir');
  await sleep(1200);
  ok(await denied(setDoc(mine, row(900))), 'rekor düşürülemez');
  await setDoc(mine, row(2500, 'Ali Yeni'));
  ok(true, '2,5 kat sınırındaki yazım kabul edildi');
  ok(await denied(setDoc(doc(b.db, 'scores', ua), row(9999, 'Sahte'))), 'başkasının kaydı değiştirilemez');
  ok(await denied(updateDoc(doc(b.db, 'scores', ua), { best: 500 })), 'başkasının kaydı düşürülemez');
  ok(await denied(deleteDoc(doc(b.db, 'scores', ua))), 'başkasının kaydı silinemez');
  ok(await denied(deleteDoc(mine)), 'kendi kaydı da silinemez');
  ok(await denied(setDoc(doc(a.db, 'scores2', ua), row(500))), 'başka koleksiyona yazılamaz');
  ok(await denied(setDoc(doc(a.db, 'scores', ub), row(500))), 'başkasının kimliğiyle kayıt açılamaz');
  ok((await getDoc(doc(anon.db, 'scores', ua))).data().best === 2500, 'herkes okuyabilir');
}

const money = (page, value) => page.evaluate((v) => {
  const { store, board } = __bj;
  __bj.game.money = v;
  store.best = v;
  store.pending = [...store.pending, v];
  __bj.game.money = v;
  board.flush();
}, value);
const rows = (page) => page.$$eval('#board-list li', (list) => list.map((li) => li.textContent));

async function player(browser, name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?emu=1`, { waitUntil: 'load' });
  await page.$eval('#name', (e, n) => { e.value = n; }, name);
  await page.$eval('#play', (e) => e.click());
  await page.$eval('#back', (e) => e.click());
  return { page, errors };
}

async function until(fn, text, ms = 12000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) { ok(true, text); return; }
    await sleep(200);
  }
  ok(false, text);
}

async function liveTest() {
  const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new' });
  const one = await player(browser, 'Birinci');
  const two = await player(browser, 'İkinci');
  await until(async () => (await rows(one.page)).some((r) => r.includes('İkinci')), 'ikinci oyuncu birincinin ekranına düştü');
  await until(async () => (await one.page.$eval('#board-status', (e) => e.textContent)) === 'Canlı', 'durum Canlı');

  await sleep(1300);
  await money(two.page, 1250);
  await until(async () => (await rows(one.page)).some((r) => r.includes('İkinci') && r.includes('1.250')), 'rekor diğer ekranda anında göründü');
  await one.page.screenshot({ path: 'e2e-out/skor-canli.png' });
  ok(await two.page.$eval('#board-list li.me', (e) => e.textContent.includes('İkinci')), 'kendi satırı vurgulu');

  // Çevrimdışıyken arka arkaya rekorlar, bağlanınca basamak basamak gider.
  await one.page.setOfflineMode(true);
  await one.page.evaluate(() => dispatchEvent(new Event('offline')));
  await until(async () => (await one.page.$eval('#board-status', (e) => e.textContent)) === 'Bağlantı yok', 'çevrimdışı uyarısı');
  await one.page.screenshot({ path: 'e2e-out/skor-baglanti-yok.png' });
  for (const value of [1200, 2900, 7000, 17000]) await money(one.page, value);
  await sleep(600);
  await one.page.setOfflineMode(false);
  await one.page.evaluate(() => dispatchEvent(new Event('online')));
  await until(async () => (await rows(two.page))[0]?.includes('17.000'), 'çevrimdışı rekor bağlantı gelince tabloya yazıldı', 25000);

  // İlk 10 dışında kalan oyuncu sırasını görür.
  const bots = [];
  for (let i = 0; i < 10; i += 1) {
    const c = client(`bot${i}`);
    const { uid } = (await signInAnonymously(c.auth)).user;
    await setDoc(doc(c.db, 'scores', uid), { name: `Bot ${i}`, best: 1250, updatedAt: serverTimestamp() });
    bots.push(c);
  }
  await until(async () => (await one.page.$$eval('#board-list li', (l) => l.length)) === 10, 'tablo 10 satır');
  const third = await player(browser, 'Üçüncü');
  await until(async () => (await third.page.$eval('#board-me', (e) => e.textContent)).includes('Senin sıran: 14.'), 'listede olmayan oyuncu sırasını görüyor');
  await third.page.screenshot({ path: 'e2e-out/skor-sira.png' });
  ok(one.errors.concat(two.errors, third.errors).length === 0, 'sayfa hatası yok');
  await browser.close();
}

await rulesTest();
await liveTest();
console.log(failed ? `${failed} KALDI` : 'HEPSİ GEÇTİ');
process.exit(failed ? 1 : 0);
