// Simge ve açılış görsellerini koddan üretir (Edge ile çizip PNG alır): npm run icons
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { BRAND } from '../js/brand.js';

const EXE = process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await puppeteer.launch({ executablePath: EXE, headless: 'new' });
const page = await browser.newPage();
await page.goto('about:blank');

// Sayfa içi çizim: S birimlik karede kartlı "21" amblemi
await page.evaluate(() => {
  globalThis.emblem = (g, S) => {
    const u = S / 200;
    const card = (x, y, rot, fill, stroke) => {
      g.save();
      g.translate(x * u, y * u);
      g.rotate(rot);
      g.shadowColor = 'rgba(0,0,0,.55)';
      g.shadowBlur = 10 * u;
      g.shadowOffsetY = 4 * u;
      g.fillStyle = fill;
      g.beginPath();
      g.roundRect(-46 * u, -66 * u, 92 * u, 132 * u, 9 * u);
      g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = stroke;
      g.lineWidth = 2.5 * u;
      g.beginPath();
      g.roundRect(-38 * u, -58 * u, 76 * u, 116 * u, 5 * u);
      g.stroke();
      g.restore();
    };
    card(78, 100, -0.3, '#6d1420', '#c89b3c');
    card(122, 100, 0.3, '#f5ecd8', '#a4182a');
    const gold = g.createLinearGradient(0, 62 * u, 0, 140 * u);
    gold.addColorStop(0, '#fff3cc');
    gold.addColorStop(0.5, '#e7c56e');
    gold.addColorStop(1, '#9c6f27');
    g.font = `800 ${86 * u}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9 * u;
    g.strokeStyle = '#1a0608';
    g.strokeText('21', 100 * u, 104 * u);
    g.fillStyle = gold;
    g.fillText('21', 100 * u, 104 * u);
  };
  globalThis.backdrop = (g, W, H) => {
    g.fillStyle = '#0b0606';
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.62);
    glow.addColorStop(0, '#5a1019');
    glow.addColorStop(1, '#0b0606');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
  };
});

async function icon(size, scale, file, { round = false, clear = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = await page.evaluate((S, k, circle, transparent) => {
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    if (circle) { g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip(); }
    if (!transparent) backdrop(g, S, S);
    g.translate(S / 2, S / 2);
    g.scale(k, k);
    g.translate(-S / 2, -S / 2);
    emblem(g, S);
    return c.toDataURL('image/png').split(',')[1];
  }, size, scale, round, clear);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

async function splash(file) {
  const dims = fs.readFileSync(file);
  const width = dims.readUInt32BE(16);
  const height = dims.readUInt32BE(20);
  const data = await page.evaluate((W, H, title) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    backdrop(g, W, H);
    const S = Math.min(W, H) * 0.42;
    g.save();
    g.translate((W - S) / 2, H / 2 - S * 0.72);
    emblem(g, S);
    g.restore();
    g.fillStyle = '#e7c56e';
    g.font = `800 ${Math.min(W, H) * 0.065}px Georgia, serif`;
    g.textAlign = 'center';
    g.fillText(title, W / 2, H / 2 + S * 0.5);
    return c.toDataURL('image/png').split(',')[1];
  }, width, height, BRAND.name);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

await icon(192, 1, 'icons/icon-192.png');
await icon(512, 1, 'icons/icon-512.png');
await icon(512, 0.72, 'icons/icon-maskable-512.png');

const res = 'android/app/src/main/res';
if (fs.existsSync(res)) {
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [name, s] of Object.entries(sizes)) {
    await icon(s, 1, `${res}/mipmap-${name}/ic_launcher.png`);
    await icon(s, 1, `${res}/mipmap-${name}/ic_launcher_round.png`, { round: true });
    await icon(Math.round(s * 2.25), 0.62, `${res}/mipmap-${name}/ic_launcher_foreground.png`, { clear: true });
  }
  for (const entry of fs.readdirSync(res)) {
    const file = path.join(res, entry, 'splash.png');
    if (fs.existsSync(file)) await splash(file);
  }
  const background = path.join(res, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(background)) {
    fs.writeFileSync(background, fs.readFileSync(background, 'utf8').replace(/#[0-9A-Fa-f]{6}/, '#2C080E'));
  }
}
await browser.close();
