// Tüm sesler WebAudio ile üretilir; dosya kullanılmaz.
let ctx = null;
let master = null;
let noiseBuffer = null;
let enabled = true;

export const setSound = (on) => { enabled = on; };

function ensure() {
  if (ctx) return ctx;
  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// Tarayıcılar sesi ilk dokunuştan sonra açar.
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

function noise({ at = 0, dur = 0.07, freq = 2400, q = 1, type = 'bandpass', gain = 0.5, sweep = 0 }) {
  const start = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, start);
  if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, start + dur);
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(start);
  src.stop(start + dur + 0.02);
}

function tone({ at = 0, dur = 0.2, freq = 440, to = 0, type = 'sine', gain = 0.25, attack = 0.005 }) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

const SOUNDS = {
  click() {
    tone({ dur: 0.05, freq: 880, to: 520, type: 'triangle', gain: 0.14 });
  },
  card() {
    noise({ dur: 0.09, freq: 3200, sweep: 900, q: 0.8, gain: 0.5 });
    noise({ at: 0.05, dur: 0.03, freq: 1500, q: 2, gain: 0.3 });
  },
  flip() {
    noise({ dur: 0.05, freq: 1800, q: 1.2, gain: 0.4 });
    noise({ at: 0.09, dur: 0.07, freq: 3000, sweep: 1200, q: 1, gain: 0.45 });
  },
  chip() {
    tone({ dur: 0.05, freq: 3300, type: 'triangle', gain: 0.16 });
    tone({ at: 0.012, dur: 0.07, freq: 4700, type: 'sine', gain: 0.1 });
    noise({ dur: 0.02, freq: 6000, q: 2, gain: 0.2 });
  },
  chips() {
    for (let i = 0; i < 5; i += 1) {
      tone({ at: i * 0.05, dur: 0.05, freq: 3000 + i * 260, type: 'triangle', gain: 0.12 });
      noise({ at: i * 0.05, dur: 0.02, freq: 6000, q: 2, gain: 0.13 });
    }
  },
  win() {
    [523, 659, 784].forEach((freq, i) => tone({ at: i * 0.09, dur: 0.28, freq, type: 'triangle', gain: 0.2 }));
  },
  lose() {
    tone({ dur: 0.34, freq: 311, to: 196, type: 'sawtooth', gain: 0.07 });
    tone({ at: 0.14, dur: 0.4, freq: 233, to: 131, type: 'triangle', gain: 0.17 });
  },
  push() {
    tone({ dur: 0.16, freq: 494, type: 'triangle', gain: 0.14 });
    tone({ at: 0.13, dur: 0.2, freq: 494, type: 'triangle', gain: 0.12 });
  },
  bust() {
    noise({ dur: 0.3, freq: 600, sweep: 120, type: 'lowpass', gain: 0.65 });
    tone({ dur: 0.34, freq: 150, to: 60, type: 'sine', gain: 0.38 });
  },
  blackjack() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      tone({ at: i * 0.075, dur: 0.42, freq, type: 'triangle', gain: 0.2 });
      tone({ at: i * 0.075, dur: 0.3, freq: freq * 2, type: 'sine', gain: 0.05 });
    });
  },
  shuffle() {
    for (let i = 0; i < 9; i += 1) noise({ at: i * 0.05, dur: 0.05, freq: 2600 + (i % 3) * 500, q: 1, gain: 0.32 });
  },
};

export function play(name) {
  if (!enabled || !ensure() || ctx.state !== 'running') return;
  SOUNDS[name]?.();
}
