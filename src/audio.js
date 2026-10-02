// Tiny synthesized sound effects (no audio files).
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('stackbrawl.muted') === '1'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.1, freq = 800, delay = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

let last = {};
function limited(name, gap, fn) {
  const now = performance.now();
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  fn();
}

export const sfx = {
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('stackbrawl.muted', muted ? '1' : '0'); } catch { /* ignore */ }
    return muted;
  },
  unlock() { ac(); },
  pick: () => tone(520, 0.07, { type: 'triangle', vol: 0.08, slide: 1.4 }),
  drop: () => { tone(220, 0.09, { type: 'triangle', vol: 0.1, slide: 0.6 }); noise(0.05, { vol: 0.05, freq: 600 }); },
  pop: () => { tone(380, 0.1, { type: 'square', vol: 0.05, slide: 2 }); noise(0.06, { vol: 0.05, freq: 2000 }); },
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.04 }); tone(1319, 0.18, { type: 'square', vol: 0.04, delay: 0.07 }); },
  deny: () => tone(160, 0.16, { type: 'sawtooth', vol: 0.05, slide: 0.8 }),
  combine: () => { tone(523, 0.12, { vol: 0.09 }); tone(659, 0.12, { vol: 0.09, delay: 0.08 }); tone(784, 0.25, { vol: 0.09, delay: 0.16 }); },
  rare: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.08, delay: i * 0.07 })); },
  hit: () => limited('hit', 40, () => { noise(0.08, { vol: 0.12, freq: 900 }); tone(140, 0.08, { type: 'sine', vol: 0.1, slide: 0.5 }); }),
  bigHit: () => { noise(0.2, { vol: 0.2, freq: 500 }); tone(90, 0.25, { vol: 0.16, slide: 0.5 }); },
  shoot: () => limited('shoot', 50, () => tone(700, 0.05, { type: 'triangle', vol: 0.03, slide: 0.6 })),
  heal: () => limited('heal', 80, () => tone(660, 0.15, { vol: 0.05, slide: 1.5 })),
  shield: () => limited('shield', 80, () => tone(300, 0.12, { type: 'triangle', vol: 0.06, slide: 1.3 })),
  freeze: () => limited('freeze', 80, () => { tone(1800, 0.12, { vol: 0.04, slide: 0.7 }); tone(2400, 0.1, { vol: 0.03, delay: 0.04 }); }),
  tick: () => limited('tick', 120, () => noise(0.05, { vol: 0.04, freq: 1500 })),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, delay: i * 0.12 })); },
  lose: () => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.08, delay: i * 0.15 })); },
  whoosh: () => noise(0.25, { vol: 0.06, freq: 1200 }),
};
