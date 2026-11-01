import { APK_URL, BRAND, VERSION } from './brand.js';
import { CHIP_DEFS, SVG_DEFS, cardFace, CARD_BACK, chipBreakdown, chipSVG } from './art.js';
import { play, setSound, unlockAudio } from './audio.js';
import { Game, RULES } from './engine.js';
import { Sparks, leatherTexture, makeClock, ripple, tweenNumber } from './fx.js';
import { Leaderboard } from './leaderboard.js';
import { addPending, cleanName, formatMoney, medalOf, nameProblem, prunePending } from './score-core.js';
import { load, save } from './storage.js';
import { Table } from './table.js';

const $ = (id) => document.getElementById(id);
const native = Boolean(globalThis.Capacitor?.isNativePlatform?.());

const store = load();
const clock = makeClock();
const sparks = new Sparks($('sparks'));
let game = store.game ? new Game({ snapshot: store.game }) : new Game({ money: RULES.startMoney });
let busy = false;

const vibrate = (pattern) => {
  if (store.settings.vibrate) navigator.vibrate?.(pattern);
};

const persist = () => {
  store.game = game.toJSON();
  save(store);
};

// --- Görsel kurulum ----------------------------------------------------------

function setupBrand() {
  document.title = BRAND.name;
  $('tagline').textContent = BRAND.tagline;
  const title = $('title');
  title.setAttribute('aria-label', BRAND.name);
  title.innerHTML = BRAND.name.split(' ').map((word) => (
    `<span class="word" aria-hidden="true">${[...word].map((ch) => `<span class="ch">${ch}</span>`).join('')}</span>`
  )).join(' ');
  title.querySelectorAll('.ch').forEach((el, i) => el.style.setProperty('--n', i));
}

function setupArt() {
  $('defs').innerHTML = SVG_DEFS + CHIP_DEFS;
  document.documentElement.style.setProperty('--leather', `url(${leatherTexture()})`);
  $('shoe').querySelectorAll('i').forEach((el) => { el.innerHTML = CARD_BACK; });
  const orbit = [{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }, { rank: 'Q', suit: 'D' }, { rank: '10', suit: 'C' }];
  document.querySelectorAll('.orbit i').forEach((el, i) => { el.innerHTML = cardFace(orbit[i]); });
  $('chips').innerHTML = RULES.chips.map((value) => (
    `<button class="chip-btn" data-chip="${value}" aria-label="${value} fiş">${chipSVG(value)}</button>`
  )).join('');
  $('version').textContent = `Sürüm ${VERSION}`;
  $('apk').href = APK_URL;
  $('apk').hidden = native;
}

// --- Masa ---------------------------------------------------------------------

const showMoney = tweenNumber($('money'), formatMoney, clock);
const showBest = tweenNumber($('best'), formatMoney, clock);

const table = new Table({
  root: $('table'),
  game,
  clock,
  sparks,
  vibrate,
  onMoney: (value) => showMoney(value),
});

function setPanel(id) {
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('open', panel.id === id));
}

function refresh() {
  const { phase } = game;
  if (phase === 'betting') {
    setPanel('p-bet');
    document.querySelectorAll('[data-chip]').forEach((button) => {
      button.disabled = !game.canAddChip(Number(button.dataset.chip));
    });
    $('clear').disabled = game.bet === 0;
    $('deal').disabled = game.bet < RULES.minBet;
    $('rebet').disabled = game.lastBet < RULES.minBet || game.money < RULES.minBet;
    showMoney(game.available);
  } else if (phase === 'insurance') {
    setPanel('p-insurance');
    $('ins-cost').textContent = `(${formatMoney(game.insuranceCost)})`;
  } else if (phase === 'player') {
    setPanel('p-play');
    $('double').disabled = !game.canDouble;
    $('split').disabled = !game.canSplit;
  } else if (phase === 'settled') {
    setPanel('p-done');
    $('again').disabled = game.lastBet < RULES.minBet || game.money < RULES.minBet;
    const net = game.hands.reduce((sum, hand) => sum + hand.net, 0)
      + (game.insurance ? (game.insuranceWon ? game.insurance * RULES.insurancePays : -game.insurance) : 0);
    $('summary').textContent = net > 0 ? `Kazanç: +${formatMoney(net)}`
      : net < 0 ? `Kayıp: -${formatMoney(-net)}` : 'Para değişmedi';
    $('summary').className = `ask ${net > 0 ? 'up' : net < 0 ? 'down' : ''}`;
    if (game.money < RULES.minBet) openBankrupt();
  }
  showBest(store.best);
}

function noteRecord() {
  if (game.money > store.best) {
    store.best = game.money;
    store.pending = addPending(store.pending, game.money);
    $('best').classList.add('pop');
    setTimeout(() => $('best').classList.remove('pop'), 700);
  }
}

// Motor hamleyi anında uygular ve kaydeder, sonra arayüz olayları sırayla oynatır.
async function act(move) {
  if (busy) return;
  busy = true;
  document.body.classList.add('busy');
  const events = move();
  if (events) {
    noteRecord();
    persist();
    await table.run(events);
    if (game.phase === 'settled') board.flush();
  }
  busy = false;
  document.body.classList.remove('busy');
  refresh();
}

function addChip(value, source) {
  if (busy || !game.addChip(value)) return;
  play('chip');
  table.flyChips(table.centerOf(source), table.centerOf(table.betSpot), [value], { duration: 300 }).then(() => {
    table.drawStack(game.phase === 'betting' ? game.bet : table.game.hands.reduce((s, h) => s + h.bet, 0));
  });
  persist();
  refresh();
}

async function dealNow() {
  if (busy) return;
  await act(() => game.deal());
}

async function replay() {
  if (busy) return;
  if (game.phase === 'settled') {
    busy = true;
    game.nextRound();
    await table.sweep();
    busy = false;
  }
  if (!game.restoreLastBet()) {
    refresh();
    return;
  }
  play('chips');
  table.drawStack(game.bet);
  await dealNow();
}

async function newBet() {
  if (busy || game.phase !== 'settled') return;
  busy = true;
  game.nextRound();
  persist();
  await table.sweep();
  table.drawStack(0);
  busy = false;
  refresh();
}

function openBankrupt() {
  $('bankrupt-best').textContent = formatMoney(store.best);
  $('bankrupt').classList.add('open');
}

async function restart() {
  game.nextRound();
  game.restart();
  persist();
  await table.sweep();
  table.drawStack(0);
  $('bankrupt').classList.remove('open');
  showMoney(game.money);
  refresh();
}

// --- Ekranlar -----------------------------------------------------------------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === id));
  if (id === 'game') {
    table.rebuild();
    showMoney(game.phase === 'betting' ? game.available : game.money);
    refresh();
  }
}

function enterGame() {
  const name = cleanName($('name').value);
  const problem = nameProblem(name);
  $('name-error').textContent = problem ?? '';
  if (problem) {
    $('name').focus();
    return;
  }
  if (store.name !== name) {
    store.name = name;
    save(store);
    board.flush();
  }
  showScreen('game');
}

function applySettings() {
  const { sound, vibrate: vib, fast } = store.settings;
  $('set-sound').checked = sound;
  $('set-vibrate').checked = vib;
  $('set-fast').checked = fast;
  setSound(sound);
  clock.factor = fast ? 0.4 : 1;
  document.documentElement.style.setProperty('--speed', clock.factor);
}

// --- Skor tablosu görünümü ------------------------------------------------------

const STATUS_TEXT = { connecting: 'Bağlanıyor…', online: 'Canlı', offline: 'Bağlantı yok', off: 'Henüz kurulmadı' };

const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function renderBoard({ status, top, uid, rank }) {
  $('board-status').textContent = STATUS_TEXT[status];
  $('board-status').dataset.state = status;
  if (status === 'online') {
    store.lastTop = top;
    save(store);
  }
  const rows = top.length ? top : (store.lastTop ?? []);
  const myId = uid ?? store.lastUid;
  if (uid) store.lastUid = uid;
  $('board-list').innerHTML = rows.length
    ? rows.map((row, i) => {
      const position = i + 1;
      const crown = position === 1 ? '<span class="crown" aria-hidden="true">♛</span>' : '';
      return `<li class="${medalOf(position)}${row.uid === myId ? ' me' : ''}"><span class="pos">${position}.</span>`
        + `<span class="who">${crown}${escapeHtml(row.name)}</span><span class="amt">${formatMoney(row.best)}</span></li>`;
    }).join('')
    : `<li class="empty">${{ online: 'İlk rekoru sen kır.', off: 'Skor tablosu yakında açılacak.' }[status] ?? 'Tablo bağlantı gelince görünür.'}</li>`;
  const listed = rows.some((row) => row.uid === myId);
  $('board-me').textContent = !listed && rank
    ? `Senin sıran: ${rank.position}. (${formatMoney(rank.best)})`
    : !listed ? `Rekorun: ${formatMoney(store.best)}` : '';
}

const board = new Leaderboard({
  getLocal: () => ({ name: store.name, pending: store.pending }),
  // Yazım sürerken yeni rekor gelmiş olabilir: her zaman güncel kuyruk budanır.
  onPrune: (written) => {
    store.pending = prunePending(store.pending, written);
    save(store);
  },
  onChange: renderBoard,
});

// --- Olaylar ------------------------------------------------------------------

document.addEventListener('pointerdown', (event) => {
  unlockAudio();
  const button = event.target.closest('.btn, .chip-btn');
  if (!button || button.disabled) return;
  if (button.classList.contains('btn')) ripple(button, event);
  vibrate(8);
}, { passive: true });

document.addEventListener('click', (event) => {
  const button = event.target.closest('.btn');
  if (button && !button.disabled) play('click');
});

$('entry').addEventListener('submit', (event) => {
  event.preventDefault();
  enterGame();
});
$('name').addEventListener('input', () => { $('name-error').textContent = ''; });
$('chips').addEventListener('click', (event) => {
  const button = event.target.closest('[data-chip]');
  if (button && !button.disabled) addChip(Number(button.dataset.chip), button);
});
$('clear').addEventListener('click', () => {
  if (busy || !game.clearBet()) return;
  play('chips');
  table.drawStack(0);
  persist();
  refresh();
});
$('deal').addEventListener('click', dealNow);
$('rebet').addEventListener('click', replay);
$('again').addEventListener('click', replay);
$('new-bet').addEventListener('click', newBet);
$('hit').addEventListener('click', () => act(() => game.hit()));
$('stand').addEventListener('click', () => act(() => game.stand()));
$('double').addEventListener('click', () => act(() => game.double()));
$('split').addEventListener('click', () => act(() => game.split()));
$('ins-yes').addEventListener('click', () => act(() => game.insure(true)));
$('ins-no').addEventListener('click', () => act(() => game.insure(false)));
$('restart').addEventListener('click', restart);
$('back').addEventListener('click', () => { if (!busy) showScreen('start'); });

const openSettings = () => $('settings').classList.add('open');
$('open-settings').addEventListener('click', openSettings);
$('open-settings-2').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', () => $('settings').classList.remove('open'));
for (const [id, key] of [['set-sound', 'sound'], ['set-vibrate', 'vibrate'], ['set-fast', 'fast']]) {
  $(id).addEventListener('change', (event) => {
    store.settings[key] = event.target.checked;
    save(store);
    applySettings();
  });
}

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!busy && $('game').classList.contains('active')) table.rebuild();
  }, 120);
});

// --- Başlat -------------------------------------------------------------------

setupBrand();
setupArt();
applySettings();
$('name').value = store.name;
renderBoard({ status: 'connecting', top: [], uid: null, rank: null });
board.connect();
if (game.bankrupt) openBankrupt();

if ('serviceWorker' in navigator && !native && location.protocol === 'https:') {
  // Yeni sürüm hazır olunca bir kez yenilenir; el kayıtlı olduğundan oyun kaybolmaz.
  const updating = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Uçtan uca testler ve hata ayıklama için.
globalThis.__bj = {
  get game() { return game; },
  table,
  store,
  board,
  chipBreakdown,
};
