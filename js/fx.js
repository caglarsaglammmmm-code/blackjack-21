// Görsel küçük yardımcılar: bekleme, para sayacı, parçacık, doku.
export function makeClock() {
  const clock = {
    factor: 1,
    wait: (ms) => new Promise((resolve) => { setTimeout(resolve, ms * clock.factor); }),
  };
  return clock;
}

export function tweenNumber(element, format, clock) {
  let shown = null;
  let frame = 0;
  return (target) => {
    cancelAnimationFrame(frame);
    if (shown === null) {
      shown = target;
      element.textContent = format(target);
      return;
    }
    const from = shown;
    const duration = 620 * clock.factor;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 3;
      shown = t === 1 ? target : Math.round(from + (target - from) * ease);
      element.textContent = format(shown);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
}

// Parçacık katmanı yalnızca efekt sürerken çalışır.
export class Sparks {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.items = [];
    this.running = false;
  }

  burst(x, y, { count = 60, colors = ['#e8c466', '#f7e7b0', '#a9823a'], speed = 7, gravity = 0.16 } = {}) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (this.canvas.width !== Math.round(w * ratio)) {
      this.canvas.width = Math.round(w * ratio);
      this.canvas.height = Math.round(h * ratio);
    }
    this.ratio = ratio;
    this.gravity = gravity;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      this.items.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 2,
        size: 2 + Math.random() * 3.5,
        life: 1,
        fade: 0.012 + Math.random() * 0.016,
        color: colors[i % colors.length],
      });
    }
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  frame(now) {
    const k = Math.min(3, (now - this.last) / 16.67);
    this.last = now;
    const { g, ratio } = this;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    let alive = 0;
    for (const p of this.items) {
      p.life -= p.fade * k;
      if (p.life <= 0) continue;
      p.vy += this.gravity * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      g.globalAlpha = p.life;
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size);
      this.items[alive] = p;
      alive += 1;
    }
    this.items.length = alive;
    if (alive > 0) {
      requestAnimationFrame((t) => this.frame(t));
    } else {
      g.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      this.running = false;
    }
  }
}

// Deri dokusu açılışta bir kez üretilir, sonra sabit görsel olarak kullanılır.
export function leatherTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  for (let i = 0; i < 2600; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1.5 + Math.random() * 4;
    g.strokeStyle = Math.random() < 0.55 ? 'rgba(0,0,0,.2)' : 'rgba(255,220,190,.035)';
    g.lineWidth = 0.7;
    g.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const a = (side / 6) * Math.PI * 2 + Math.random() * 0.5;
      const d = r * (0.75 + Math.random() * 0.4);
      // Kenarlardan taşan damarlar karşı kenarda devam etsin diye mod alınır.
      g.lineTo((x + Math.cos(a) * d + size) % size, (y + Math.sin(a) * d + size) % size);
    }
    g.closePath();
    g.stroke();
  }
  return canvas.toDataURL('image/png');
}

// Basılan düğmede dalga efekti.
export function ripple(button, event) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.5;
  const wave = document.createElement('span');
  wave.className = 'ripple';
  wave.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
  button.append(wave);
  wave.addEventListener('animationend', () => wave.remove());
}
