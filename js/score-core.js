// Skor tablosunun arayüzden ve Firebase'den bağımsız kuralları.
import { RULES } from './engine.js';

export const NAME_MAX = 16;

// Basit filtre: büyük harf, Türkçe harf ve araya konan işaretler sadeleştirilip aranır.
const BAD_WORDS = [
  'amcik', 'amck', 'amina', 'aminak', 'amk', 'aq', 'orospu', 'orspu', 'pic', 'pezevenk',
  'sik', 'sikik', 'sikerim', 'sikeyim', 'siktir', 'yarrak', 'yarak', 'gavat', 'kahpe',
  'ibne', 'got', 'gotveren', 'mal', 'salak', 'gerizekali', 'fuck', 'shit', 'bitch',
];
// Masum adların içinde geçebilen parçalar yalnızca tam kelimeyken engellenir.
const WHOLE_ONLY = new Set(['aq', 'amk', 'mal', 'got', 'pic', 'sik']);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
const TURKISH = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u' };

function simplify(text) {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[01345@$7]/g, (ch) => LEET[ch])
    .replace(/[çğıöşü]/g, (ch) => TURKISH[ch])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function isProfane(name) {
  const clean = simplify(name);
  const words = clean.split(/[^a-z]+/).filter(Boolean);
  const joined = words.join('');
  return BAD_WORDS.some((bad) => (
    WHOLE_ONLY.has(bad)
      ? words.includes(bad) || joined === bad
      : joined.includes(bad)
  ));
}

export function cleanName(raw) {
  return [...String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()]
    .slice(0, NAME_MAX)
    .join('')
    .trim();
}

// Hata metni döndürür; ad geçerliyse null.
export function nameProblem(name) {
  if (name.length < 2) return 'Ad en az 2 harf olmalı';
  if (isProfane(name)) return 'Bu adı kullanamazsın';
  return null;
}

export function formatMoney(value) {
  const whole = Math.floor(value);
  const text = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return value === whole ? text : `${text},5`;
}

// Bir el, bakiyeyi en çok maxHandGrowth katına çıkarabildiği için kurallar da
// tek yazımda bu sınırı arar. Çevrimdışı biriken rekorlar bu sınıra uyan
// basamaklar halinde gönderilir.
export function nextStep(serverBest, pending, growth = RULES.maxHandGrowth) {
  const limit = serverBest * growth;
  let step = null;
  for (const value of pending) {
    if (value > serverBest && value <= limit && (step === null || value > step)) step = value;
  }
  return step;
}

export const addPending = (pending, value) => (
  pending.includes(value) ? pending : [...pending, value].sort((a, b) => a - b)
);

export const prunePending = (pending, best) => pending.filter((value) => value > best);

// Tablodaki sıra adı: ilk üç için madalya sınıfı.
export const medalOf = (rank) => ['gold', 'silver', 'bronze'][rank - 1] ?? '';
