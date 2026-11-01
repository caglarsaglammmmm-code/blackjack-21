import test from 'node:test';
import assert from 'node:assert/strict';
import { addPending, cleanName, formatMoney, isProfane, nameProblem, nextStep, prunePending } from '../js/score-core.js';

test('ad: 16 karaktere kısılır, boşluklar sadeleşir', () => {
  assert.equal(cleanName('  Çağlar   Sağlam  '), 'Çağlar Sağlam');
  assert.equal(cleanName('a'.repeat(30)).length, 16);
  assert.equal(cleanName(null), '');
});

test('ad: kısa ve küfürlü adlar reddedilir', () => {
  assert.ok(nameProblem('A'));
  assert.ok(isProfane('s1kt1r'));
  assert.ok(isProfane('O R O S P U'));
  assert.ok(isProfane('ŞİKTİR'));
  assert.ok(isProfane('amk'));
});

test('ad: masum adlar geçer', () => {
  for (const name of ['Çağlar', 'Sıkı Oyuncu', 'Malatyalı', 'Gökhan', 'Aslı', 'Mert', 'Kemal', 'Tokatçı']) {
    assert.equal(nameProblem(name), null, name);
  }
});

test('para biçimi: binlik nokta ve yarım', () => {
  assert.equal(formatMoney(500), '500');
  assert.equal(formatMoney(1250), '1.250');
  assert.equal(formatMoney(1234567.5), '1.234.567,5');
});

test('rekor basamağı: sınırı aşmayan en yüksek değer seçilir', () => {
  assert.equal(nextStep(500, [600, 1000, 1250, 1300]), 1250);
  assert.equal(nextStep(1250, [1300, 3000, 3125, 9000]), 3125);
  assert.equal(nextStep(500, [450]), null);
  assert.equal(nextStep(500, [5000]), null);
});

test('rekor kuyruğu: çevrimdışı zincir basamak basamak tükenir', () => {
  let server = 500;
  let pending = [];
  for (const value of [700, 1500, 3000, 7000, 16000]) pending = addPending(pending, value);
  const steps = [];
  for (;;) {
    const step = nextStep(server, pending);
    if (step === null) break;
    steps.push(step);
    server = step;
    pending = prunePending(pending, server);
  }
  assert.equal(server, 16000);
  assert.deepEqual(pending, []);
  assert.ok(steps.every((v, i) => v <= (i ? steps[i - 1] : 500) * 2.5));
});
