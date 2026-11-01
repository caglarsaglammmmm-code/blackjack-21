// Masa görünümü: kartları, fişleri ve olay listesinin animasyonunu yönetir.
import { handValue } from './engine.js';
import { CARD_BACK, cardFace, chipBreakdown, chipSVG } from './art.js';
import { formatMoney } from './score-core.js';
import { play } from './audio.js';

const RESULT_TEXT = {
  blackjack: 'BLACKJACK',
  win: 'KAZANDIN',
  lose: 'KAYBETTİN',
  push: 'BERABERE',
  bust: 'BATTI',
};

export class Table {
  constructor({ root, game, clock, sparks, vibrate, onMoney }) {
    this.root = root;
    this.game = game;
    this.clock = clock;
    this.sparks = sparks;
    this.vibrate = vibrate;
    this.onMoney = onMoney;
    this.layer = root.querySelector('#card-layer');
    this.shoe = root.querySelector('#shoe');
    this.betSpot = root.querySelector('#bet-spot');
    this.betStack = root.querySelector('#bet-stack');
    this.betLabel = root.querySelector('#bet-label');
    this.dealerTotal = root.querySelector('#dealer-total');
    this.banner = root.querySelector('#banner');
    this.cards = { dealer: [], hands: [] };
    this.badges = [];
    this.chipLayers = [];
    this.measure();
  }

  // --- Ölçü ----------------------------------------------------------------

  measure() {
    const { clientWidth: w, clientHeight: h } = this.root;
    this.w = w;
    this.h = h;
    const cardW = Math.min(Math.round(w * 0.235), Math.round(h * 0.16), 124);
    this.cardW = cardW;
    this.cardH = Math.round(cardW * 1.4);
    this.root.style.setProperty('--card-w', `${cardW}px`);
    this.dealerY = Math.round(h * 0.075);
    this.playerY = Math.round(h * 0.6);
    this.shoePos = { x: w - cardW * 0.62, y: 2 - this.cardH * 0.25 };
  }

  // Bir elin kartları; yer darsa kartlar birbirine daha çok biner.
  fanPositions(count, centerX, y, maxWidth) {
    const step = count > 1
      ? Math.min(this.cardW * 0.42, (maxWidth - this.cardW) / (count - 1))
      : 0;
    const width = this.cardW + step * (count - 1);
    const left = centerX - width / 2;
    return Array.from({ length: count }, (_, i) => ({ x: left + step * i, y: y + (count > 1 ? i * 1.5 : 0) }));
  }

  handCenter(index) {
    const count = this.game.hands.length;
    if (count < 2) return this.w / 2;
    return this.w * (index === 0 ? 0.27 : 0.73);
  }

  handWidth() {
    return this.game.hands.length < 2 ? this.w - 24 : this.w * 0.46;
  }

  placeAll() {
    const dealerSpots = this.fanPositions(this.cards.dealer.length, this.w / 2, this.dealerY, this.w * 0.72);
    this.cards.dealer.forEach((el, i) => this.moveTo(el, dealerSpots[i]));
    this.cards.hands.forEach((list, index) => {
      const spots = this.fanPositions(list.length, this.handCenter(index), this.playerY, this.handWidth());
      list.forEach((el, i) => this.moveTo(el, spots[i]));
    });
    this.placeBadges();
  }

  moveTo(el, { x, y }) {
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  }

  placeBadges() {
    this.dealerTotal.style.top = `${this.dealerY + this.cardH + 4}px`;
    this.badges.forEach((badge, index) => {
      badge.style.left = `${this.handCenter(index)}px`;
      badge.style.top = `${this.playerY + this.cardH + 8}px`;
    });
    this.chipLayers.forEach((layer, index) => {
      layer.style.left = `${this.handCenter(index)}px`;
    });
  }

  // --- Kart ----------------------------------------------------------------

  makeCard(card, hidden) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="flip${hidden ? ' down' : ''}"><div class="face front"></div><div class="face back">${CARD_BACK}</div></div>`;
    if (card) el.querySelector('.front').innerHTML = cardFace(card);
    el.style.transform = `translate3d(${this.shoePos.x}px,${this.shoePos.y}px,0)`;
    this.layer.append(el);
    return el;
  }

  async dealCard(event) {
    const hidden = event.hidden;
    const el = this.makeCard(hidden ? null : event.card, hidden);
    if (event.to === 'dealer') this.cards.dealer.push(el);
    else this.cards.hands[event.hand].push(el);
    // Başlangıç konumunu tarayıcıya işlet ki geçiş çalışsın.
    el.getBoundingClientRect();
    play('card');
    this.placeAll();
    await this.clock.wait(260);
    this.updateTotals();
  }

  async flipHole(card) {
    const el = this.cards.dealer[1];
    el.querySelector('.front').innerHTML = cardFace(card);
    play('flip');
    el.querySelector('.flip').classList.remove('down');
    await this.clock.wait(420);
    this.updateTotals();
  }

  // --- Toplam rozetleri ----------------------------------------------------

  formatTotal(cards) {
    const { total, soft } = handValue(cards);
    if (soft && total < 21) return `${total - 10}/${total}`;
    return String(total);
  }

  updateTotals() {
    const { game } = this;
    const visible = game.holeHidden ? game.dealer.slice(0, 1) : game.dealer;
    this.dealerTotal.textContent = visible.length ? this.formatTotal(visible) : '';
    this.dealerTotal.classList.toggle('show', visible.length > 0);
    game.hands.forEach((hand, index) => {
      const badge = this.badges[index];
      if (!badge) return;
      badge.querySelector('.value').textContent = this.formatTotal(hand.cards);
      badge.querySelector('.stake').textContent = formatMoney(hand.bet);
      badge.classList.toggle('active', game.phase === 'player' && game.active === index);
      badge.classList.add('show');
    });
    this.placeBadges();
  }

  ensureBadges() {
    while (this.badges.length < this.game.hands.length) {
      const badge = document.createElement('div');
      badge.className = 'hand-badge';
      badge.innerHTML = '<span class="value"></span><span class="stake"></span>';
      this.root.append(badge);
      this.badges.push(badge);
    }
    while (this.cards.hands.length < this.game.hands.length) this.cards.hands.push([]);
  }

  // --- Fişler --------------------------------------------------------------

  drawStack(amount) {
    const chips = chipBreakdown(amount).reverse();
    this.betStack.innerHTML = chips
      .map((value, i) => `<span class="chip stacked" style="--i:${i}">${chipSVG(value)}</span>`)
      .join('');
    this.betLabel.textContent = amount > 0 ? formatMoney(amount) : 'BAHİS';
    this.betSpot.classList.toggle('filled', amount > 0);
  }

  // Bir noktadan diğerine uçan fiş: yalnızca transform ve opaklık canlandırılır.
  flyChips(from, to, values, { stagger = 45, duration = 340, fade = false } = {}) {
    const size = this.cardW * 0.62;
    const hostRect = this.root.getBoundingClientRect();
    const jobs = values.map((value, i) => {
      const el = document.createElement('span');
      el.className = 'chip flyer';
      el.style.width = `${size}px`;
      el.innerHTML = chipSVG(value);
      this.root.append(el);
      const start = `translate3d(${from.x - hostRect.left - size / 2}px,${from.y - hostRect.top - size / 2}px,0)`;
      const end = `translate3d(${to.x - hostRect.left - size / 2}px,${to.y - hostRect.top - size / 2}px,0)`;
      const lift = `translate3d(${(from.x + to.x) / 2 - hostRect.left - size / 2}px,${(from.y + to.y) / 2 - hostRect.top - size / 2 - 26}px,0) scale(1.14)`;
      return el.animate(
        [
          { transform: start, opacity: 1 },
          { transform: lift, opacity: 1, offset: 0.55 },
          { transform: `${end} scale(.9)`, opacity: fade ? 0 : 1 },
        ],
        { duration: duration * this.clock.factor, delay: i * stagger * this.clock.factor, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' },
      ).finished.then(() => el.remove());
    });
    return Promise.all(jobs);
  }

  centerOf(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // --- Efekt yazıları ------------------------------------------------------

  async showBanner(text, kind, hold = 900) {
    this.banner.textContent = text;
    this.banner.className = `banner ${kind}`;
    this.banner.getBoundingClientRect();
    this.banner.classList.add('show');
    await this.clock.wait(hold);
  }

  hideBanner() {
    this.banner.classList.remove('show');
  }

  tagHand(index, result, net) {
    const badge = this.badges[index];
    if (!badge) return;
    const tag = document.createElement('div');
    tag.className = `result-tag ${result}`;
    const amount = net > 0 ? ` +${formatMoney(net)}` : '';
    tag.textContent = `${RESULT_TEXT[result]}${amount}`;
    badge.append(tag);
  }

  shakeHand(index) {
    for (const el of this.cards.hands[index] ?? []) {
      el.querySelector('.flip').animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-2deg)' }, { transform: 'translateX(7px) rotate(2deg)' }, { transform: 'translateX(0)' }],
        { duration: 300 * this.clock.factor, iterations: 1 },
      );
      el.classList.add('dim');
    }
  }

  burstAt(index, options) {
    const x = this.handCenter(index);
    this.sparks.burst(x, this.playerY + this.cardH / 2 + this.root.offsetTop, options);
  }

  // --- Olaylar -------------------------------------------------------------

  async run(events) {
    for (const event of events) {
      await this.handle(event);
    }
  }

  async handle(event) {
    switch (event.type) {
      case 'shuffle':
        play('shuffle');
        this.shoe.classList.add('shuffling');
        await this.showBanner('Deste karıştırılıyor', 'info', 800);
        this.hideBanner();
        this.shoe.classList.remove('shuffling');
        break;
      case 'card':
        this.ensureBadges();
        await this.dealCard(event);
        break;
      case 'flip':
        await this.flipHole(event.card);
        break;
      case 'peek':
        if (!event.blackjack) await this.peekCue();
        break;
      case 'insurance':
        play('chip');
        this.onMoney(event.money);
        break;
      case 'double':
        play('chips');
        this.updateTotals();
        this.onMoney(event.money);
        await this.clock.wait(140);
        break;
      case 'split':
        await this.splitCards(event);
        break;
      case 'bust':
        play('bust');
        this.vibrate(40);
        this.root.classList.add('flash-red');
        this.shakeHand(event.hand);
        this.tagHand(event.hand, 'bust', 0);
        this.updateTotals();
        await this.clock.wait(420);
        this.root.classList.remove('flash-red');
        break;
      case 'turn':
        this.updateTotals();
        break;
      case 'settle':
        await this.settle(event);
        break;
      default:
    }
  }

  async peekCue() {
    this.cards.dealer[1]?.classList.add('peeking');
    await this.clock.wait(420);
    this.cards.dealer[1]?.classList.remove('peeking');
  }

  async splitCards({ hand: index, money }) {
    play('chips');
    const moved = this.cards.hands[index].pop();
    this.cards.hands.splice(index + 1, 0, [moved]);
    this.ensureBadges();
    this.placeAll();
    this.updateTotals();
    this.onMoney(money);
    await this.clock.wait(320);
  }

  async settle(event) {
    this.updateTotals();
    const { game } = this;
    event.hands.forEach((hand, index) => {
      if (hand.result !== 'bust') this.tagHand(index, hand.result, hand.net);
    });

    const hasBlackjack = event.hands.some((hand) => hand.result === 'blackjack');
    const won = event.hands.some((hand) => hand.net > 0);
    const allLost = event.hands.every((hand) => hand.net < 0);

    if (hasBlackjack) {
      play('blackjack');
      this.vibrate([30, 40, 60]);
      this.burstAt(0, { count: 130, speed: 9 });
      this.root.classList.add('flash-gold');
      await this.showBanner('BLACKJACK!', 'gold', 1000);
      this.root.classList.remove('flash-gold');
    } else if (event.dealerBust) {
      play('win');
      this.vibrate(25);
      await this.showBanner('KRUPİYE BATTI!', 'gold', 800);
    } else if (event.dealerBlackjack) {
      await this.showBanner('KRUPİYE BLACKJACK', 'red', 800);
    }

    const balance = this.centerOf(document.getElementById('money'));
    const dealerPoint = { x: this.root.getBoundingClientRect().left + this.w / 2, y: this.root.getBoundingClientRect().top + this.dealerY };
    const spot = this.centerOf(this.betSpot);
    const total = game.hands.reduce((sum, hand) => sum + hand.bet, 0);
    this.drawStack(0);

    if (event.payout > 0) {
      if (won && !hasBlackjack && !event.dealerBust) play('win');
      if (!won) play('push');
      if (won) this.burstAt(0, { count: 34, speed: 5 });
      await this.flyChips(spot, balance, chipBreakdown(event.payout).slice(0, 10), { fade: true });
      play('chips');
    } else if (allLost) {
      play('lose');
      await this.flyChips(spot, dealerPoint, chipBreakdown(total).slice(0, 8), { fade: true, stagger: 30 });
    }
    this.onMoney(event.money);
    this.hideBanner();
  }

  // --- Sıfırlama ve geri yükleme -------------------------------------------

  clear() {
    this.layer.innerHTML = '';
    this.cards = { dealer: [], hands: [] };
    for (const badge of this.badges) badge.remove();
    this.badges = [];
    this.dealerTotal.classList.remove('show');
    this.dealerTotal.textContent = '';
    this.hideBanner();
  }

  async sweep() {
    const items = [...this.layer.children];
    for (const el of items) {
      el.style.transition = `transform ${240 * this.clock.factor}ms ease-in, opacity ${240 * this.clock.factor}ms`;
      el.style.transform = `translate3d(-${this.cardW * 1.6}px,${this.dealerY}px,0)`;
      el.style.opacity = '0';
    }
    if (items.length) await this.clock.wait(240);
    this.clear();
  }

  // Sayfa yenilenince ya da ölçü değişince masayı durumdan yeniden kurar.
  rebuild() {
    const { game } = this;
    this.clear();
    this.measure();
    this.ensureBadges();
    game.dealer.forEach((card, i) => {
      const hidden = i === 1 && game.holeHidden;
      this.cards.dealer.push(this.makeCard(hidden ? null : card, hidden));
    });
    game.hands.forEach((hand, index) => {
      this.cards.hands[index] = hand.cards.map((card) => this.makeCard(card, false));
    });
    this.layer.classList.add('no-anim');
    this.placeAll();
    this.layer.getBoundingClientRect();
    this.layer.classList.remove('no-anim');
    if (game.dealer.length) this.updateTotals();
    game.hands.forEach((hand, index) => {
      if (hand.result) this.tagHand(index, hand.result, hand.net);
    });
    const live = game.phase === 'player' || game.phase === 'insurance';
    this.drawStack(game.phase === 'betting' ? game.bet : live ? game.hands.reduce((s, h) => s + h.bet, 0) : 0);
  }
}

