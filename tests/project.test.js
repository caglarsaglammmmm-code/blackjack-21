import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assetList, contentHash } from '../tools/stamp-sw.mjs';

test('sw.js önbelleği güncel: dosyalar değişince npm run stamp çalıştırılmış', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes(`tokatlik-${contentHash()}`), 'npm run stamp çalıştırın');
  for (const asset of assetList()) assert.ok(sw.includes(`'${asset}'`), asset);
});

test('depoda gizli anahtar dosyası yok', () => {
  assert.equal(fs.existsSync('serviceAccount.json'), false);
  assert.equal(fs.existsSync('android/app/google-services.json'), false);
});
