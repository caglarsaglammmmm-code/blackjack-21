import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, RULES, buildShoe, handValue, isBlackjackCards, shuffle } from '../js/engine.js';

const c = (text) => {
  const suit = text.at(-1);
  return { rank: text.slice(0, -1), suit };
};
const cards = (...list) => list.map((t) => c(`${t}S`));
const nextSettle = (events) => events.find((e) => e.type === 'settle');

// Kartlar verilen sırayla çekilir. Dağıtım: oyuncu, krupiye açık, oyuncu, krupiye kapalı.
function rigged(order, { money = 500, bet = 100 } = {}) {
  const game = new Game({ money, rng: () => 0.5 });
  game.shoe = [...cards(...Array(120).fill('2')), ...cards(...order).reverse()];
  game.bet = bet;
  return game;
}

test('deste: 6 deste 312 kart, her karttan 6 adet', () => {
  const shoe = buildShoe();
  assert.equal(shoe.length, 312);
  assert.equal(shoe.filter((k) => k.rank === 'A' && k.suit === 'S').length, 6);
  const shuffled = shuffle(buildShoe());
  assert.equal(shuffled.length, 312);
  assert.notDeepEqual(shuffled.slice(0, 20), shoe.slice(0, 20));
});

test('deste: yaklaşık %25 kalınca el başında karıştırılır', () => {
  const game = new Game();
  game.shoe = game.shoe.slice(0, 79);
  game.bet = 10;
  assert.equal(game.deal().some((e) => e.type === 'shuffle'), false);

  const low = new Game();
  low.shoe = low.shoe.slice(0, 78);
  low.bet = 10;
  const events = low.deal();
  assert.equal(events[0].type, 'shuffle');
  assert.equal(low.shoe.length, 312 - 4);
});

test('el değeri: hard toplamlar', () => {
  assert.deepEqual(handValue(cards('10', '7')), { total: 17, soft: false });
  assert.deepEqual(handValue(cards('K', 'Q', '5')), { total: 25, soft: false });
  assert.deepEqual(handValue(cards('J', 'Q')), { total: 20, soft: false });
});

test('el değeri: soft toplamlar ve As geçişi', () => {
  assert.deepEqual(handValue(cards('A', '6')), { total: 17, soft: true });
  assert.deepEqual(handValue(cards('A', 'A')), { total: 12, soft: true });
  assert.deepEqual(handValue(cards('A', '6', '10')), { total: 17, soft: false });
  assert.deepEqual(handValue(cards('A', 'A', '9')), { total: 21, soft: true });
  assert.deepEqual(handValue(cards('A', 'A', 'K', 'Q')), { total: 22, soft: false });
});

test('blackjack: yalnızca iki kartlı 21', () => {
  assert.equal(isBlackjackCards(cards('A', 'K')), true);
  assert.equal(isBlackjackCards(cards('7', '7', '7')), false);
});

test('blackjack 3:2 öder, krupiye kartı çekmez', () => {
  const game = rigged(['A', '9', 'K', '7']);
  const s = nextSettle(game.deal());
  assert.equal(game.hands[0].result, 'blackjack');
  assert.equal(s.net, 150);
  assert.equal(game.money, 650);
  assert.equal(game.dealer.length, 2);
});

test('25 bahiste blackjack küsuratlı öder', () => {
  const game = rigged(['A', '9', 'K', '7'], { bet: 25 });
  game.deal();
  assert.equal(game.money, 537.5);
});

test('her iki blackjack beraberlik, bahis iade', () => {
  const game = rigged(['A', 'K', 'Q', 'A']);
  game.deal();
  assert.equal(game.phase, 'settled');
  assert.equal(game.hands[0].result, 'push');
  assert.equal(game.money, 500);
});

test('peek: açık 10 ve kapalı As, oyuncu oynamadan kaybeder', () => {
  const game = rigged(['9', 'K', '9', 'A']);
  const events = game.deal();
  assert.equal(events.find((e) => e.type === 'peek').blackjack, true);
  assert.equal(game.phase, 'settled');
  assert.equal(game.hands[0].result, 'lose');
  assert.equal(game.money, 400);
});

test('peek: açık 10 ve blackjack yok, sigorta sorulmaz, oyun sürer', () => {
  const game = rigged(['9', 'K', '9', '7']);
  const events = game.deal();
  assert.equal(events.some((e) => e.type === 'insurance-offer'), false);
  assert.equal(events.find((e) => e.type === 'peek').blackjack, false);
  assert.equal(game.phase, 'player');
});

test('peek: açık küçük kartta bakılmaz', () => {
  const game = rigged(['9', '6', '9', '7']);
  assert.equal(game.deal().some((e) => e.type === 'peek'), false);
});

test('sigorta: yalnızca açık As, bahsin yarısı, krupiye blackjack ise 2:1', () => {
  const game = rigged(['10', 'A', '9', 'K']);
  game.deal();
  assert.equal(game.phase, 'insurance');
  assert.equal(game.money, 400);
  game.insure(true);
  assert.equal(game.phase, 'settled');
  // 100 bahis kaybedildi, 50 sigorta +100 kazandı: net -0
  assert.equal(game.money, 500);
  assert.equal(game.insuranceWon, true);
});

test('sigorta: krupiye blackjack değilse sigorta kaybeder, oyun sürer', () => {
  const game = rigged(['10', 'A', '9', '7', '3']);
  game.deal();
  game.insure(true);
  assert.equal(game.phase, 'player');
  assert.equal(game.money, 350);
  game.stand();
  // Krupiye soft 18: oyuncu 19 kazanır, 200 geri alır.
  assert.equal(game.hands[0].result, 'win');
  assert.equal(game.money, 550);
});

test('sigorta: reddedilir ve krupiye blackjack yaparsa bahis gider', () => {
  const game = rigged(['10', 'A', '9', 'K']);
  game.deal();
  game.insure(false);
  assert.equal(game.money, 400);
  assert.equal(game.phase, 'settled');
});

test('sigorta: oyuncu blackjack iken alınıp krupiye blackjack yoksa 3:2 sürer', () => {
  const game = rigged(['A', 'A', 'K', '7']);
  game.deal();
  assert.equal(game.phase, 'insurance');
  game.insure(true);
  assert.equal(game.hands[0].result, 'blackjack');
  assert.equal(game.money, 500 - 50 + 150);
});

test('sigorta: para yetmiyorsa teklif edilmez', () => {
  const game = rigged(['10', 'A', '9', '7'], { money: 100, bet: 100 });
  game.deal();
  assert.equal(game.phase, 'player');
});

test('krupiye soft 17 dahil tüm 17 lerde durur', () => {
  const game = rigged(['10', 'A', '8', '6']);
  game.deal();
  game.insure(false);
  game.stand();
  assert.equal(game.dealer.length, 2);
  assert.equal(game.hands[0].result, 'win');
});

test('krupiye 16 da çeker ve batarsa kalan el kazanır', () => {
  const game = rigged(['10', '10', '2', '6', 'K']);
  game.deal();
  game.stand();
  assert.equal(game.dealer.length, 3);
  assert.equal(game.hands[0].result, 'win');
  assert.equal(game.money, 600);
});

test('kart çek: 21 otomatik durur, bust kaybeder ve krupiye çekmez', () => {
  const game = rigged(['10', '5', '6', '10', '5', '9']);
  game.deal();
  game.hit();
  assert.equal(game.phase, 'settled');
  assert.equal(game.hands[0].result, 'win');

  const bust = rigged(['10', '5', '6', '10', 'K']);
  bust.deal();
  const events = bust.hit();
  assert.equal(bust.hands[0].result, 'bust');
  assert.equal(events.filter((e) => e.type === 'card' && e.to === 'dealer').length, 0);
  assert.equal(bust.dealer.length, 2);
  assert.equal(bust.money, 400);
});

test('beraberlikte bahis iade', () => {
  const game = rigged(['10', '10', '9', '9']);
  game.deal();
  game.stand();
  assert.equal(game.hands[0].result, 'push');
  assert.equal(game.money, 500);
});

test('ikiye katla: tek kart, bahis iki kat, sonra el biter', () => {
  const game = rigged(['6', '6', '5', '10', 'K', 'K']);
  game.deal();
  assert.equal(game.canDouble, true);
  game.double();
  assert.equal(game.hands[0].cards.length, 3);
  assert.equal(game.hands[0].doubled, true);
  assert.equal(game.hands[0].result, 'win');
  assert.equal(game.money, 700);
});

test('ikiye katla: üçüncü kartta yasak, para yetmezse yasak', () => {
  const game = rigged(['2', '6', '3', '10', '2']);
  game.deal();
  game.hit();
  assert.equal(game.canDouble, false);
  assert.equal(game.double(), null);

  const poor = rigged(['5', '6', '6', '10'], { money: 150, bet: 100 });
  poor.deal();
  assert.equal(poor.canDouble, false);
});

test('böl: aynı değerli kartlar, K ve 10 da bölünür', () => {
  const game = rigged(['K', '6', '10', '10']);
  game.deal();
  assert.equal(game.canSplit, true);
  const other = rigged(['K', '6', '9', '10']);
  other.deal();
  assert.equal(other.canSplit, false);
});

test('böl: iki el ayrı oynanır, bir kez bölünür', () => {
  const game = rigged(['8', '6', '8', '10', '8', '3', 'K']);
  game.deal();
  game.split();
  assert.equal(game.hands.length, 2);
  assert.equal(game.money, 300);
  assert.deepEqual(game.hands[0].cards.map((k) => k.rank), ['8', '8']);
  assert.equal(game.canSplit, false);
  assert.equal(game.split(), null);
  game.stand();
  assert.equal(game.active, 1);
  game.hit();
  // 8+3+K = 21, krupiye 16 + 2 = 18: ilk el 16 kaybeder, ikinci el kazanır.
  assert.equal(game.hands[0].result, 'lose');
  assert.equal(game.hands[1].result, 'win');
  assert.equal(game.money, 500);
});

test('böl: para yetmezse yasak', () => {
  const game = rigged(['8', '6', '8', '10'], { money: 150, bet: 100 });
  game.deal();
  assert.equal(game.canSplit, false);
});

test('böl: Aslara tek kart, 21 blackjack sayılmaz ve 1:1 öder', () => {
  const game = rigged(['A', '6', 'A', '10', 'K', 'Q']);
  game.deal();
  game.split();
  assert.equal(game.phase, 'settled');
  assert.equal(game.hands[0].result, 'win');
  assert.equal(game.hands[0].net, 100);
  assert.equal(game.hands[1].result, 'win');
  assert.equal(game.money, 700);
});

test('böl: krupiye 21 ise bölünmüş 21 beraberlik', () => {
  const game = rigged(['A', '6', 'A', '10', 'K', 'Q', '5']);
  game.deal();
  game.split();
  assert.equal(game.dealer.length, 3);
  assert.equal(game.hands[0].result, 'push');
  assert.equal(game.money, 500);
});

test('böl: Aslarda ek kart yok, bölme sonrası ikiye katlama serbest', () => {
  const game = rigged(['5', '6', '5', '10', '6', '9', 'K', '2']);
  game.deal();
  game.split();
  assert.equal(game.canDouble, true);
  game.double();
  assert.equal(game.hands[0].bet, 200);
  assert.equal(game.active, 1);
});

test('böl: iki el de batarsa krupiye çekmez', () => {
  const game = rigged(['8', '6', '8', '10', '8', '8', 'K', 'K']);
  game.deal();
  game.split();
  game.hit();
  const events = game.hit();
  assert.equal(events.filter((e) => e.type === 'card' && e.to === 'dealer').length, 0);
  assert.equal(game.money, 300);
});

test('bahis: fişler, üst sınır, temizle, tekrar', () => {
  const game = new Game({ money: 60 });
  assert.equal(game.addChip(7), false);
  assert.equal(game.addChip(50), true);
  assert.equal(game.addChip(25), false);
  assert.equal(game.addChip(10), true);
  assert.equal(game.available, 0);
  game.clearBet();
  assert.equal(game.bet, 0);
  assert.equal(game.deal(), null);
});

test('tekrar oyna: para azsa bakiyeye iner, minimumun altında olmaz', () => {
  const game = new Game({ money: 300 });
  game.lastBet = 500;
  game.restoreLastBet();
  assert.equal(game.bet, 300);
  const poor = new Game({ money: 7.5 });
  poor.lastBet = 10;
  assert.equal(poor.restoreLastBet(), false);
});

test('iflas: bahis yapılamayınca, 500 ile yeniden başlar', () => {
  const game = rigged(['10', '10', '6', '10', '5'], { money: 100, bet: 100 });
  game.deal();
  game.stand();
  game.nextRound();
  assert.equal(game.money, 0);
  assert.equal(game.bankrupt, true);
  assert.equal(game.restart(), true);
  assert.equal(game.money, 500);
  assert.equal(game.bankrupt, false);
});

test('kayıt: JSON a yazılıp geri yüklenen el kaldığı yerden sürer', () => {
  const game = rigged(['10', '5', '6', '10', '5', '9']);
  game.deal();
  const restored = new Game({ snapshot: JSON.parse(JSON.stringify(game)) });
  restored.stand();
  assert.equal(restored.phase, 'settled');
  assert.equal(restored.shoe.length, game.shoe.length - 1);
});

test('özellik: rastgele oyunda para tutarlı, tek elde artış 2.5 katı geçmez', () => {
  let seed = 12345;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  let game = new Game({ rng, money: 500 });
  let top = 0;
  for (let round = 0; round < 200000; round += 1) {
    if (game.bankrupt) game.restart();
    const before = game.money;
    const roll = rng();
    const bet = roll < 0.4 ? Math.floor(before) : roll < 0.7 ? Math.max(10, Math.floor(before / 4)) : 10;
    game.bet = Math.min(bet, Math.floor(before));
    game.deal();
    if (game.phase === 'insurance') game.insure(rng() < 0.5);
    while (game.phase === 'player') {
      const options = ['hit', 'stand'];
      if (game.canDouble) options.push('double', 'double');
      if (game.canSplit) options.push('split', 'split', 'split');
      game[options[Math.floor(rng() * options.length)]]();
    }
    assert.equal(game.phase, 'settled');
    assert.ok(game.money >= 0, `para eksiye düştü: ${game.money}`);
    assert.ok(game.money * 2 === Math.floor(game.money * 2), `yarımdan küçük küsurat: ${game.money}`);
    top = Math.max(top, game.money / before);
    assert.ok(game.money <= before * RULES.maxHandGrowth + 1e-9, `${before} -> ${game.money}`);
    game.nextRound();
    if (game.money > 1e7) game = new Game({ rng, money: 500 });
  }
  assert.ok(top > 2, 'test blackjack kazancını hiç denememiş');
});
