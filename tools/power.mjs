// Solo output of every unit against a dummy fortress for 45s (no enemy units).
// value = damage dealt + 0.8 x (healing + shield). Run: node tools/power.mjs [tier]
import { createBattle } from '../src/sim.js';
import { CARDS } from '../src/content.js';

export function power(id, { secs = 45, perm = 0 } = {}) {
  const mk = (ids) => ({ name: 'x', day: 6, hp: 100000, gold: 12, slots: 6, wall: ids.map((i) => (i ? { id: i, perm } : null)) });
  const dummy = { name: 'd', day: 6, hp: 100000, gold: 0, slots: 1, wall: [{ id: 'villager' }] };
  const b = createBattle({ left: mk([id]), right: dummy, seed: 3 });
  // the dummy's villager gives freeze/delay a target; its damage is ignored
  let heal = 0, shield = 0;
  while (b.t < secs) {
    b.step();
    for (const e of b.events.splice(0)) {
      if (e.type === 'heal' && e.side === 0) heal += e.amount;
      if (e.type === 'shield' && e.side === 0) shield += e.amount;
    }
  }
  const dmg = 100000 - b.sides[1].hp;
  return { dmg, heal, shield, value: dmg + 0.8 * (heal + shield) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? Number(process.argv[2]) : null;
  const rows = Object.values(CARDS).filter((c) => c.kind === 'unit' && (only == null || c.tier === only))
    .map((c) => ({ id: c.id, tier: c.rare ? 'R' : c.tier, ...power(c.id) }))
    .sort((a, b) => String(a.tier).localeCompare(String(b.tier)) || b.value - a.value);
  for (const r of rows) console.log(`${String(r.tier).padEnd(2)} ${r.id.padEnd(18)} ${Math.round(r.value / 45 * 10) / 10} /s   (dmg ${r.dmg}, heal ${r.heal}, shield ${r.shield})`);
}
