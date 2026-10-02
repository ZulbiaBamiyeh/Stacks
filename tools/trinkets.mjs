// Trinket balance: how much each trinket lifts a board's win rate. Each sample
// plays the same two boards twice, with and without the trinket, so the lift is
// paired and low-noise. Reports the best-fit archetype and the average.
// Run: node tools/trinkets.mjs [samples] [filter]
import { createBattle } from '../src/sim.js';
import { createRng } from '../src/rng.js';
import { TRINKETS } from '../src/trinkets.js';
import { POOLS, STAGES, sampleWall } from './balance.mjs';

// Run-level trinkets (gold, odds, growth between fights) have no fight effect.
const ECONOMY = ['gold', 'sellBonus', 'rareOdds', 'interest', 'combineDiscount', 'freeForge', 'permAfter', 'permOnWin'];
const fightless = (t) => Object.keys(t.m).every((k) => ECONOMY.includes(k));
// Which stage each size shows up in, and the lift it should give its best archetype.
const STAGE_BY_SIZE = { 2: 'early', 3: 'mid', 4: 'mid', 5: 'late' };
// Power = the larger of the average lift and half the best archetype's lift
// (so build-specific trinkets count). For scale: +10 fortress HP is about
// +8pp early, +8pp mid and +4pp late.
export const BAND = { 2: [0.04, 0.11], 3: [0.07, 0.15], 4: [0.1, 0.2], 5: [0.13, 0.27] };
export const power = (m) => Math.max(m.avg, m.bestLift * 0.5);

export function measure(id, samples = 30) {
  const t = TRINKETS[id];
  const st = STAGES[STAGE_BY_SIZE[t.size]];
  const names = Object.keys(POOLS);
  const lift = {};
  for (const a of names) {
    let d = 0;
    for (let s = 0; s < samples; s++) {
      const r = createRng(s * 7919 + a.length * 101 + t.size);
      const A = sampleWall(a, st, r);
      const B = sampleWall(names[(s + a.length) % names.length], st, r);
      const left = s % 2 === 0;
      const play = (tk) => {
        const me = { ...A, trinkets: tk };
        const f = createBattle({ left: left ? me : B, right: left ? B : me, seed: s + 11 });
        return (f.runToEnd() === 0) === left ? 1 : 0;
      };
      d += play([id]) - play([]);
    }
    lift[a] = d / samples;
  }
  const best = names.reduce((x, y) => (lift[y] > lift[x] ? y : x));
  const avg = names.reduce((x, n) => x + lift[n], 0) / names.length;
  return { id, size: t.size, res: t.res, best, bestLift: lift[best], avg, lift, fightless: fightless(t) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const samples = Number(process.argv[2]) || 30;
  const filter = process.argv[3];
  const ids = Object.keys(TRINKETS).filter((id) => !filter || id.includes(filter) || TRINKETS[id].res === filter);
  const flags = [];
  for (const id of ids) {
    const m = measure(id, samples);
    const [lo, hi] = BAND[m.size];
    const p = power(m);
    const tag = m.fightless ? 'econ' : p < lo ? 'WEAK' : p > hi ? 'STRONG' : 'ok';
    if (tag === 'WEAK' || tag === 'STRONG') flags.push(id);
    console.log(`${m.res.padEnd(9)} x${m.size} ${id.padEnd(22)} best ${m.best.padEnd(9)} ${(m.bestLift * 100).toFixed(0).padStart(4)}pp  avg ${(m.avg * 100).toFixed(0).padStart(4)}pp  power ${(p * 100).toFixed(0).padStart(3)}  ${tag}`);
  }
  console.log(`\n${flags.length} outside their band: ${flags.join(', ')}`);
}
