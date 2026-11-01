// Kare süresi ölçümü. CPU 4 kat yavaşlatılarak orta seviye telefon taklit edilir.
import puppeteer from 'puppeteer-core';

const BASE = process.env.E2E_URL || 'http://localhost:8091/';
const EXE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new', args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(BASE, { waitUntil: 'load' });
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });

const record = (ms) => page.evaluate((duration) => new Promise((resolve) => {
  const frames = [];
  let last = performance.now();
  const start = last;
  const tick = (now) => {
    frames.push(now - last);
    last = now;
    if (now - start < duration) requestAnimationFrame(tick);
    else resolve(frames.slice(1));
  };
  requestAnimationFrame(tick);
}), ms);
const stats = (name, f) => {
  const s = [...f].sort((a, b) => a - b);
  const pick = (q) => s[Math.floor(s.length * q)].toFixed(1);
  console.log(`${name}: ${(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(0)} FPS, p50 ${pick(0.5)} ms, p95 ${pick(0.95)} ms, en kötü ${s.at(-1).toFixed(1)} ms, 34 ms üstü ${f.filter((x) => x > 34).length}/${f.length}`);
};

stats('Giriş ekranı', await record(4000));
await page.$eval('#name', (e) => { e.value = 'Olcum'; });
await page.$eval('#play', (e) => e.click());
await new Promise((r) => { setTimeout(r, 300); });

const play = page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const click = (id) => document.getElementById(id).click();
  const idle = async () => { while (document.body.classList.contains('busy')) await wait(30); };
  for (let i = 0; i < 6; i += 1) {
    document.querySelector('[data-chip="10"]').click();
    document.querySelector('[data-chip="25"]').click();
    await wait(380);
    click('deal');
    await wait(60);
    await idle();
    if (__bj.game.phase === 'insurance') { click('ins-no'); await wait(60); await idle(); }
    if (__bj.game.phase === 'player') { click('stand'); await wait(60); await idle(); }
    click('new-bet');
    await wait(60);
    while (__bj.game.phase !== 'betting' || document.body.classList.contains('busy')) await wait(30);
    await wait(320);
  }
});
stats('El oynanışı', await record(9000));
await play;
await browser.close();
