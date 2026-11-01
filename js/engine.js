// Blackjack oyun mantığı. Arayüzden bağımsızdır: DOM, ses veya zamanlama içermez.
// Her hamle arayüzün sırayla oynatacağı olay listesi döndürür.

export const RULES = Object.freeze({
  decks: 6,
  reshuffleAt: 0.25,
  startMoney: 500,
  minBet: 10,
  chips: Object.freeze([10, 25, 50, 100, 500]),
  blackjackPays: 1.5,
  insurancePays: 2,
  maxHands: 2,
  // Tek elde bakiyenin ulaşabileceği en yüksek kat: tüm parayla blackjack.
  maxHandGrowth: 2.5,
});

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export const cardValue = (card) => {
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return Number(card.rank);
};

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjackCards = (cards) => cards.length === 2 && handValue(cards).total === 21;

const cryptoRandom = () => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

export function buildShoe(decks = RULES.decks) {
  const shoe = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  }
  return shoe;
}

export function shuffle(cards, rng = cryptoRandom) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const newHand = (cards, bet, fromSplit = false) => ({
  cards,
  bet,
  fromSplit,
  doubled: false,
  done: false,
  result: null,
  net: 0,
});

export class Game {
  constructor({ rng = cryptoRandom, money = RULES.startMoney, snapshot = null } = {}) {
    this.rng = rng;
    if (snapshot) {
      Object.assign(this, snapshot);
      return;
    }
    this.money = money;
    this.bet = 0;
    this.lastBet = 0;
    this.phase = 'betting';
    this.hands = [];
    this.active = 0;
    this.dealer = [];
    this.holeHidden = false;
    this.insurance = 0;
    this.insuranceWon = false;
    this.shoe = shuffle(buildShoe(), rng);
  }

  toJSON() {
    const { rng, ...state } = this;
    return state;
  }

  // --- Bahis ---------------------------------------------------------------

  get available() {
    return this.phase === 'betting' ? this.money - this.bet : this.money;
  }

  get bankrupt() {
    return this.phase === 'betting' && this.money < RULES.minBet;
  }

  canAddChip(value) {
    return this.phase === 'betting' && RULES.chips.includes(value) && this.available >= value;
  }

  addChip(value) {
    if (!this.canAddChip(value)) return false;
    this.bet += value;
    return true;
  }

  clearBet() {
    if (this.phase !== 'betting') return false;
    this.bet = 0;
    return true;
  }

  // Son bahsi geri koyar; para yetmiyorsa koyulabilecek en yüksek tutara iner.
  restoreLastBet() {
    if (this.phase !== 'betting' || this.lastBet < RULES.minBet) return false;
    const bet = Math.min(this.lastBet, Math.floor(this.money));
    if (bet < RULES.minBet) return false;
    this.bet = bet;
    return true;
  }

  nextRound() {
    if (this.phase !== 'settled') return false;
    this.phase = 'betting';
    this.hands = [];
    this.dealer = [];
    this.active = 0;
    this.bet = 0;
    this.insurance = 0;
    this.insuranceWon = false;
    this.holeHidden = false;
    return true;
  }

  restart() {
    if (!this.bankrupt) return false;
    this.money = RULES.startMoney;
    this.bet = 0;
    this.lastBet = 0;
    return true;
  }

  // --- Dağıtım -------------------------------------------------------------

  get needsShuffle() {
    return this.shoe.length <= Math.floor(RULES.decks * 52 * RULES.reshuffleAt);
  }

  draw() {
    return this.shoe.pop();
  }

  deal() {
    if (this.phase !== 'betting' || this.bet < RULES.minBet || this.bet > this.money) return null;
    const events = [];
    if (this.needsShuffle) {
      this.shoe = shuffle(buildShoe(), this.rng);
      events.push({ type: 'shuffle' });
    }
    this.money -= this.bet;
    this.lastBet = this.bet;
    this.hands = [newHand([], this.bet)];
    this.active = 0;
    this.dealer = [];
    this.insurance = 0;
    this.insuranceWon = false;
    this.holeHidden = true;

    const hand = this.hands[0];
    const give = (to) => {
      const card = this.draw();
      if (to === 'player') hand.cards.push(card);
      else this.dealer.push(card);
      const hidden = to === 'dealer' && this.dealer.length === 2;
      events.push({ type: 'card', to, hand: 0, card, hidden });
    };
    give('player');
    give('dealer');
    give('player');
    give('dealer');

    if (this.dealer[0].rank === 'A' && this.money >= this.insuranceCost) {
      this.phase = 'insurance';
      events.push({ type: 'insurance-offer' });
      return events;
    }
    return events.concat(this.afterOpening());
  }

  get insuranceCost() {
    return this.hands.length ? this.hands[0].bet / 2 : 0;
  }

  // Sigorta kararı. Açık kart As ise bu karardan sonra krupiye blackjack'e bakar.
  insure(accept) {
    if (this.phase !== 'insurance') return null;
    const events = [];
    if (accept) {
      this.insurance = this.insuranceCost;
      this.money -= this.insurance;
      events.push({ type: 'insurance', amount: this.insurance, money: this.money });
    }
    return events.concat(this.afterOpening());
  }

  afterOpening() {
    const events = [];
    const up = this.dealer[0];
    const peeks = up.rank === 'A' || cardValue(up) === 10;
    const dealerBlackjack = isBlackjackCards(this.dealer);
    if (peeks) events.push({ type: 'peek', blackjack: dealerBlackjack });
    if ((peeks && dealerBlackjack) || isBlackjackCards(this.hands[0].cards)) {
      this.hands[0].done = true;
      return events.concat(this.reveal(), this.settle());
    }
    this.phase = 'player';
    events.push({ type: 'turn', hand: 0 });
    return events;
  }

  // --- Oyuncu hamleleri ----------------------------------------------------

  get currentHand() {
    return this.phase === 'player' ? this.hands[this.active] : null;
  }

  get canHit() {
    return this.phase === 'player';
  }

  get canStand() {
    return this.phase === 'player';
  }

  get canDouble() {
    const hand = this.currentHand;
    return Boolean(hand) && hand.cards.length === 2 && this.money >= hand.bet;
  }

  get canSplit() {
    const hand = this.currentHand;
    return Boolean(hand)
      && this.hands.length < RULES.maxHands
      && hand.cards.length === 2
      && cardValue(hand.cards[0]) === cardValue(hand.cards[1])
      && this.money >= hand.bet;
  }

  hit() {
    if (!this.canHit) return null;
    const hand = this.currentHand;
    const card = this.draw();
    hand.cards.push(card);
    const events = [{ type: 'card', to: 'player', hand: this.active, card, hidden: false }];
    const { total } = handValue(hand.cards);
    if (total > 21) {
      hand.done = true;
      hand.result = 'bust';
      hand.net = -hand.bet;
      events.push({ type: 'bust', hand: this.active });
    } else if (total === 21) {
      hand.done = true;
    }
    return hand.done ? events.concat(this.advance()) : events;
  }

  stand() {
    if (!this.canStand) return null;
    this.currentHand.done = true;
    return this.advance();
  }

  double() {
    if (!this.canDouble) return null;
    const hand = this.currentHand;
    this.money -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    const card = this.draw();
    hand.cards.push(card);
    const events = [
      { type: 'double', hand: this.active, bet: hand.bet, money: this.money },
      { type: 'card', to: 'player', hand: this.active, card, hidden: false },
    ];
    hand.done = true;
    if (handValue(hand.cards).total > 21) {
      hand.result = 'bust';
      hand.net = -hand.bet;
      events.push({ type: 'bust', hand: this.active });
    }
    return events.concat(this.advance());
  }

  split() {
    if (!this.canSplit) return null;
    const hand = this.hands[this.active];
    const aces = hand.cards[0].rank === 'A';
    this.money -= hand.bet;
    const moved = hand.cards.pop();
    hand.fromSplit = true;
    const second = newHand([moved], hand.bet, true);
    this.hands.splice(this.active + 1, 0, second);
    const events = [{ type: 'split', hand: this.active, money: this.money }];

    this.hands.forEach((h, index) => {
      const card = this.draw();
      h.cards.push(card);
      events.push({ type: 'card', to: 'player', hand: index, card, hidden: false });
      if (aces || handValue(h.cards).total === 21) h.done = true;
    });
    return events.concat(this.advance());
  }

  // Sıradaki oynanabilir ele geçer; el kalmadıysa krupiye oynar.
  advance() {
    while (this.active < this.hands.length && this.hands[this.active].done) this.active += 1;
    if (this.active < this.hands.length) return [{ type: 'turn', hand: this.active }];
    return this.playDealer();
  }

  // --- Krupiye ve ödeme ----------------------------------------------------

  reveal() {
    this.holeHidden = false;
    return [{ type: 'flip', card: this.dealer[1] }];
  }

  playDealer() {
    this.phase = 'dealer';
    const events = this.reveal();
    if (this.hands.some((hand) => hand.result !== 'bust')) {
      while (handValue(this.dealer).total < 17) {
        const card = this.draw();
        this.dealer.push(card);
        events.push({ type: 'card', to: 'dealer', hand: 0, card, hidden: false });
      }
    }
    return events.concat(this.settle());
  }

  settle() {
    const dealer = handValue(this.dealer).total;
    const dealerBust = dealer > 21;
    const dealerBlackjack = isBlackjackCards(this.dealer);
    let payout = 0;

    for (const hand of this.hands) {
      const blackjack = !hand.fromSplit && isBlackjackCards(hand.cards);
      const { total } = handValue(hand.cards);
      if (hand.result === 'bust') {
        hand.net = -hand.bet;
      } else if (blackjack && dealerBlackjack) {
        hand.result = 'push';
        hand.net = 0;
      } else if (blackjack) {
        hand.result = 'blackjack';
        hand.net = hand.bet * RULES.blackjackPays;
      } else if (dealerBlackjack) {
        hand.result = 'lose';
        hand.net = -hand.bet;
      } else if (dealerBust || total > dealer) {
        hand.result = 'win';
        hand.net = hand.bet;
      } else if (total === dealer) {
        hand.result = 'push';
        hand.net = 0;
      } else {
        hand.result = 'lose';
        hand.net = -hand.bet;
      }
      payout += hand.bet + hand.net;
    }

    let insuranceNet = 0;
    if (this.insurance > 0) {
      this.insuranceWon = dealerBlackjack;
      if (dealerBlackjack) {
        payout += this.insurance * (1 + RULES.insurancePays);
        insuranceNet = this.insurance * RULES.insurancePays;
      } else {
        insuranceNet = -this.insurance;
      }
    }

    this.money += payout;
    this.phase = 'settled';
    this.bet = 0;
    const net = this.hands.reduce((sum, hand) => sum + hand.net, 0) + insuranceNet;
    return [{
      type: 'settle',
      money: this.money,
      net,
      payout,
      insuranceNet,
      dealerBust,
      dealerBlackjack,
      hands: this.hands.map((hand) => ({ result: hand.result, net: hand.net })),
    }];
  }
}
