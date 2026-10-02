import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RECIPES, recipeFor, fortressHp } from '../src/content.js';
import { createBattle } from '../src/sim.js';
import { botGhost } from '../src/ghosts.js';
import * as run from '../src/run.js';

const side = (wall, extra = {}) => ({ name: 'x', hp: 100, gold: 0, slots: 6, wall: wall.map((id) => (id ? { id } : null)), ...extra });

test('every unit fights without throwing', () => {
  for (const def of Object.values(CARDS)) {
    if (def.kind !== 'unit') continue;
    const b = createBattle({ left: side([def.id, 'villager', 'scorpion']), right: side(['knight', 'wisp', 'sandcaster']), seed: 3 });
    b.runToEnd();
    assert.ok(b.over, def.id);
  }
});

test('battles are deterministic for a seed', () => {
  const mk = () => createBattle({ left: side(['gambler', 'rogue', 'luckyFairy']), right: side(['jackal', 'stormCaller', 'duneGuard']), seed: 42 });
  const a = mk(); a.runToEnd();
  const b = mk(); b.runToEnd();
  assert.equal(a.t, b.t);
  assert.equal(a.sides[0].hp, b.sides[0].hp);
});

test('villager deals 2 damage every 3s', () => {
  const b = createBattle({ left: side(['villager']), right: side([]), seed: 1 });
  while (b.t < 3.01) b.step();
  assert.equal(b.sides[1].hp, 98);
});

test('shield absorbs damage, poison ignores it', () => {
  const b = createBattle({ left: side(['villager', 'scorpion']), right: side(['direWolf']), seed: 1 });
  while (b.t < 3.01) b.step();
  assert.equal(b.sides[1].hp, 100);
  assert.equal(b.sides[1].shield, 8);
});

test('sudden death ends stalled fights', () => {
  const b = createBattle({ left: side(['guard']), right: side(['guard']), seed: 1 });
  b.runToEnd();
  assert.ok(b.t < 70);
});

test('recipes are symmetric', () => {
  assert.equal(recipeFor('wood', 'villager').result, 'archer');
  assert.equal(recipeFor('villager', 'wood').result, 'archer');
  assert.ok(RECIPES.size > 100);
});

test('run: pack, open, combine, wall, fight', () => {
  const s = run.newRun(123);
  assert.equal(s.gold, 10);
  assert.equal(s.packs.length, 1, 'free starter pack');
  const p = run.buyPack(s, 'village');
  assert.ok(p.ok);
  assert.equal(s.gold, 7);
  while (s.packs.length) run.openOne(s, s.packs[0].uid);
  assert.equal(s.table.length, 6);
  const v = run.makeInst(s, 'villager'); s.table.push(v);
  const w = run.makeInst(s, 'wood'); s.table.push(w);
  const goldBefore = s.gold;
  const c = run.combine(s, w.uid, v.uid);
  assert.ok(c.ok);
  assert.equal(c.inst.id, 'archer');
  assert.equal(s.gold, goldBefore - 1);
  assert.ok(run.toWall(s, c.inst.uid, 0).ok);
  const res = run.finishFight(s, true, 'bot');
  assert.equal(s.day, 2);
  assert.equal(res.total, 7);
});

test('scaling carries over when combined', () => {
  const s = run.newRun(5);
  const sk = run.makeInst(s, 'skeleton'); s.wall[0] = sk;
  run.finishFight(s, false, 'bot');
  assert.equal(sk.perm, 1);
  const bone = run.makeInst(s, 'bone'); s.table.push(bone);
  s.gold = 20;
  const r = run.combine(s, bone.uid, sk.uid);
  assert.equal(r.inst.id, 'necromancer');
  assert.equal(r.inst.perm, 1);
});

test('bot ghosts fill a sensible wall', () => {
  for (let day = 1; day <= 12; day++) {
    const g = botGhost(day);
    assert.equal(g.hp, fortressHp(day));
    assert.ok(g.wall.filter(Boolean).length >= 2);
  }
});

test('burn halves each tick instead of snowballing', () => {
  const b = createBattle({ left: side(['pyromancer']), right: side([], { hp: 1000 }), seed: 1 });
  while (b.t < 3.76) b.step();
  assert.equal(b.sides[1].burn, 4);
  while (b.t < 4.55) b.step();
  assert.equal(b.sides[1].burn, 2);
});

test('tick damage is credited to the units that applied it', () => {
  const b = createBattle({ left: side(['pyromancer', 'scorpion', 'villager']), right: side([], { hp: 100000 }), seed: 1 });
  while (b.t < 40) b.step();
  const dealt = b.roster[0].reduce((a, u) => a + u.dealt, 0);
  const taken = 100000 - b.sides[1].hp;
  assert.ok(Math.abs(dealt - taken) < 1, `${dealt} vs ${taken}`);
  assert.ok(b.roster[0][0].dealt > 0 && b.roster[0][1].dealt > 0);
});

test('neighbour auras only touch adjacent units', () => {
  const near = createBattle({ left: side(['smith', 'villager']), right: side([], { hp: 1000 }), seed: 1 });
  const far = createBattle({ left: side(['smith', null, 'villager']), right: side([], { hp: 1000 }), seed: 1 });
  while (near.t < 3.01) { near.step(); far.step(); }
  assert.equal(1000 - near.sides[1].hp, 1 + 3);
  assert.equal(1000 - far.sides[1].hp, 1 + 2);
});

test('eaters grow and evolve, keeping their meals', () => {
  const s = run.newRun(9);
  const maw = run.makeInst(s, 'cinderMaw'); s.table.push(maw);
  for (let i = 0; i < 5; i++) {
    const e = run.makeInst(s, i % 2 ? 'wood' : 'ember'); s.table.push(e);
    const r = run.eat(s, e.uid, maw.uid);
    assert.ok(r.ok);
  }
  assert.equal(maw.id, 'cinderWyrm');
  assert.equal(maw.meals, 5);
  assert.equal(maw.perm, 5);
  const stone = run.makeInst(s, 'stone'); s.table.push(stone);
  assert.ok(!run.eat(s, stone.uid, maw.uid).ok);
});

test('track packs hold only tier-1 cards, so they cannot be sold for profit', async () => {
  const { PACKS, CARDS } = await import('../src/content.js');
  for (const p of Object.values(PACKS)) {
    for (const [id] of p.pool) assert.ok(CARDS[id].tier <= 1, `${p.id} has ${id}`);
    assert.ok(p.size <= p.price, p.id);
  }
});

test('combining costs gold by result tier and fails when broke', () => {
  const s = run.newRun(4);
  s.gold = 0;
  const v = run.makeInst(s, 'villager'); s.table.push(v);
  const w = run.makeInst(s, 'wood'); s.table.push(w);
  assert.ok(!run.combine(s, w.uid, v.uid).ok);
  assert.equal(s.table.length, 2);
});

test('alpha rallies other wolves every attack', () => {
  const b = createBattle({ left: side(['alpha', 'wolf']), right: side([], { hp: 1000 }), seed: 1 });
  while (b.t < 9.05) b.step();
  assert.equal(b.sides[0].units[1].bonus, 3);
});

test('heals no longer cleanse burn or poison', () => {
  const b = createBattle({ left: side(['scorpion']), right: side(['healer'], { hp: 1000 }), seed: 1 });
  while (b.t < 4.6) b.step();
  assert.equal(b.sides[1].poison, 1);
});

test('archetypes stay within a healthy band mid and late', async () => {
  const { run } = await import('../tools/balance.mjs');
  const res = run(16, { quiet: true, stages: ['mid', 'late'] });
  for (const [stage, m] of Object.entries(res)) {
    for (const [name, row] of Object.entries(m)) {
      assert.ok(row.avg > 0.2 && row.avg < 0.8, `${stage} ${name} averages ${Math.round(row.avg * 100)}%`);
    }
  }
});
