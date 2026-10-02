// Lists "plain" units (only numbers on timers, no special rules) that share a shape.
// Run: node tools/audit.mjs
import { CARDS } from '../src/content.js';

const BASIC = new Set(['k', 'n']);
const FLAGS = ['perm', 'permWin', 'permLoss', 'gold', 'haste', 'creatureHaste', 'lowCreatureHaste', 'startShield', 'startLuck', 'startBless',
  'lowHp', 'aura', 'auraHaste', 'eats', 'onCrit', 'onEnemyMiss', 'onFreeze', 'onHeal', 'onShieldHit', 'onBigHit', 'onNeighbourAct',
  'onEnemyHeal', 'onEnemyPoisonTick', 'onEnemyBurnTick', 'warden', 'thorns', 'noFreeze', 'firstStrike', 'accel', 'ahead', 'burningHaste',
  'emptyHaste', 'overheal', 'revive', 'ashborn', 'ifrit', 'queen', 'venom', 'mirror', 'once', 'shopSlot', 'sellBonus', 'chest', 'banker',
  'oracle', 'rareOdds', 'tombKing', 'critMult', 'freezeMult', 'startEnemy', 'startNeighbourBonus'];
const groups = new Map();
for (const c of Object.values(CARDS)) {
  if (c.kind !== 'unit') continue;
  if (FLAGS.some((f) => c[f])) continue;
  const acts = c.t.flatMap(([, ...a]) => a);
  if (acts.some((a) => Object.keys(a).some((k) => !BASIC.has(k)))) continue;
  const sig = c.t.map(([, ...a]) => a.map((x) => x.k).sort().join('+')).sort().join(' | ') || '(none)';
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(c.id);
}
let dupes = 0;
for (const [sig, ids] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  if (ids.length < 2) continue;
  dupes += ids.length - 1;
  console.log(`${sig.padEnd(28)} ${ids.join(', ')}`);
}
console.log(`\n${dupes} cards share a plain shape with another card.`);
