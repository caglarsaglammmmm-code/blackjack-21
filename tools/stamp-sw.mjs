// sw.js dosyasının önbellek listesini ve sürümünü içerikten üretir: npm run stamp
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = `${dir}/${entry.name}`;
  return entry.isDirectory() ? walk(rel) : [rel];
});

export function assetList() {
  const files = ['css', 'js', 'fonts', 'icons'].flatMap(walk).filter((f) => !f.endsWith('.txt'));
  return ['index.html', 'manifest.json', ...files].sort();
}

export function contentHash() {
  const hash = crypto.createHash('sha256');
  for (const name of assetList()) hash.update(name).update(fs.readFileSync(path.join(root, name)));
  return hash.digest('hex').slice(0, 12);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sw = path.join(root, 'sw.js');
  const text = fs.readFileSync(sw, 'utf8')
    .replace(/const CACHE = '[^']*';/, `const CACHE = 'tokatlik-${contentHash()}';`)
    .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = ${JSON.stringify(['./', ...assetList()], null, 2).replace(/"/g, "'")};`);
  fs.writeFileSync(sw, text);
  console.log(`sw.js: tokatlik-${contentHash()}`);
}
