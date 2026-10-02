import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/sim.js';
import { TRINKETS, TK_BY, TRINKET_IDS, aggregate } from '../src/trinkets.js';
import { INGREDIENTS } from '../src/content.js';
import * as run from '../src/run.js';

const side = (wall, trinkets = [], extra = {}) => ({ name: 'x', hp: 100, gold: 0, slots: 6, wall: wall.map((id) => (id ? { id } : null)), trinkets, ...extra });

test('every resource has 3 trinkets at each stack size 2-5', () => {
  for (const ing of INGREDIENTS) for (let n = 2; n <= 5; n++) assert.equal(TK_BY[ing.id]?.[n]?.length, 3, `${ing.id} x${n}`);
  assert.equal(TRINKET_IDS.length, INGREDIENTS.length * 12);
  for (const t of Object.values(TRINKETS)) assert.ok(t.name && t.text, t.id);
});

test('aggregate adds numbers and keeps the strongest of exclusive keys', () => {
  const m = aggregate(['whittledArrowhead', 'heartwoodBow', 'lichPhylactery', 'deathlessSigil']);
  assert.equal(m.add.dmg, 1);
  assert.equal(m.leftAdd.dmg, 2);
  assert.equal(m.revive, Math.max(TRINKETS.lichPhylactery.m.revive, TRINKETS.deathlessSigil.m.revive));
});

test('start-of-fight trinkets apply', () => {
  const b = createBattle({ left: side(['villager'], ['riverStone', 'tinderbox']), right: side(['villager']), seed: 1 });
  assert.equal(b.sides[0].shield, 15);
  assert.equal(b.sides[1].burn, 4);
});

test('a revive trinket brings a fortress back once', () => {
  const left = side(['villager'], ['deathlessSigil'], { hp: 10 });
  const b = createBattle({ left, right: side(['hunter', 'hunter', 'hunter']), seed: 2 });
  b.runToEnd();
  assert.ok(b.events.some((e) => e.type === 'revive' && e.side === 0 && e.by === 'trinket'));
});

test('confusion turns enemy actions on themselves', () => {
  const b = createBattle({ left: side(['villager'], ['ruinedKingCrown']), right: side(['archer', 'archer']), seed: 3 });
  for (let i = 0; i < 600; i++) b.step();
  assert.ok(b.events.some((e) => e.type === 'confused' && e.side === 1));
  assert.ok(b.events.some((e) => e.type === 'dmg' && e.side === 1 && e.src?.side === 1));
});

test('every trinket survives full fights', () => {
  for (const id of TRINKET_IDS) {
    const b = createBattle({ left: side(['knight', 'fireMage', 'scorpionSwarm', 'healer', 'frostFairy'], [id]), right: side(['archer', 'guard', 'druid', 'sandcaster'], ['mirrorOfEternity']), seed: 4 });
    b.runToEnd();
    assert.ok(b.over, id);
  }
});

test('ingredients bundle up to 5 and forge into a trinket of that size', () => {
  const s = run.newRun(42);
  s.table = [];
  s.gold = 20;
  const berries = Array.from({ length: 6 }, () => { const c = run.makeInst(s, 'berry'); s.table.push(c); return c; });
  for (let i = 1; i < 4; i++) assert.ok(run.bundle(s, berries[i].uid, berries[0].uid).ok);
  assert.equal(berries[0].stack, 4);
  assert.equal(run.bundle(s, berries[4].uid, berries[0].uid).ok, true);
  assert.equal(run.bundleInfo(s, berries[5].uid, berries[0].uid).ok, false); // would be 6
  assert.equal(run.sellPrice(s, berries[0]), 5);
  const res = run.forge(s, berries[0].uid, 2);
  assert.ok(res.ok);
  assert.equal(TRINKETS[s.trinkets[2].id].res, 'berry');
  assert.equal(TRINKETS[s.trinkets[2].id].size, 5);
  assert.equal(s.gold, 20 - 4);
  assert.deepEqual(run.snapshot(s).trinkets, [s.trinkets[2].id]);
  assert.equal(run.combine(s, berries[5].uid, berries[5].uid).ok, false);
});

test('coin trinkets pay out after a fight', () => {
  const s = run.newRun(7);
  s.trinkets[0] = { uid: 999, id: 'gildedRing' };
  const g = s.gold;
  const r = run.finishFight(s, false, 'x');
  assert.ok(r.lines.some(([l, n]) => l === 'Trinkets' && n === 2));
  assert.equal(s.gold, g + r.total);
});

test('opening a track binds the shrine and seals the others', () => {
  const s = run.newRun(5);
  s.table = [];
  const feed = (id) => { const c = run.makeInst(s, id); s.table.push(c); return run.feed(s, c.uid); };
  for (let i = 0; i < 3; i++) assert.ok(feed('bone').ok); // can sample before committing
  for (let i = 0; i < 4; i++) assert.ok(feed('ice').ok);
  const r = feed('ice');
  assert.equal(r.unlocked, 'frost');
  assert.equal(s.bound, 'frost');
  assert.equal(feed('bone').ok, false);
  assert.ok(feed('ice').ok);
  assert.ok(run.availablePacks(s).includes('frost'));
});

test('holding gold earns interest, +1 per 10 up to +3', () => {
  for (const [held, want] of [[9, 0], [10, 1], [27, 2], [80, 3]]) {
    const s = run.newRun(3);
    s.gold = held;
    const r = run.finishFight(s, false, 'x');
    assert.equal(r.lines.find(([l]) => l === 'Interest')?.[1] || 0, want, `holding ${held}`);
  }
});
