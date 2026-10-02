// Prototype: spawner cards send units down one field to fight (Footman Frenzy style).
// Deterministic fixed-step sim, so async ghost fights would still replay exactly.
import { createRng } from '../rng.js';

export const DT = 1 / 30;
export const SIEGE_AT = 60;

// Field in local coordinates: x runs from the left castle (-HALF) to the right castle (+HALF).
export const FIELD = { half: 13.5, depth: 11, castleX: 13.2, castleR: 1.25, spawnX: 9.4, slotStep: 1.65 };
export const slotZ = (i) => (i - 2.5) * FIELD.slotStep;

export const UNIT_TYPES = {
  // Rock-paper-scissors: warriors grind villagers, arrows ignore warrior armour, villager swarms overrun archers.
  villager: { name: 'Villager', hp: 34, armor: 0, dmg: 4, cd: 0.9, range: 0.45, speed: 2.2, spawn: 3, radius: 0.32, aggro: 5 },
  warrior: { name: 'Warrior', hp: 70, armor: 3, dmg: 8, cd: 1.3, range: 0.5, speed: 1.1, spawn: 8, radius: 0.4, aggro: 5 },
  archer: { name: 'Archer', hp: 16, armor: 0, dmg: 8, cd: 1.5, range: 4.5, speed: 1.4, spawn: 6, radius: 0.3, aggro: 6, pierce: true },
};

export function createLaneBattle({ left, right, seed = 1, castleHp = 400 }) {
  const rng = createRng(seed);
  let nextId = 1;
  const b = {
    t: 0,
    over: false,
    winner: -1,
    events: [],
    units: [],
    projectiles: [],
    castles: [0, 1].map((side) => ({ side, hp: castleHp, max: castleHp, x: side === 0 ? -FIELD.castleX : FIELD.castleX, z: 0 })),
    spawners: [left, right].map((wall, side) => wall.map((entry, slot) => {
      if (!entry) return null;
      const spec = typeof entry === 'string' ? { type: entry } : entry;
      const T = { ...UNIT_TYPES[spec.type], ...(spec.stats || {}) };
      return { ...spec, T, slot, side, timer: T.spawn - 1, sent: 0, kills: 0, dealt: 0 };
    })),
    stats: [0, 1].map(() => ({ spawned: 0, lost: 0, castleDmg: 0 })),
  };
  const emit = (e) => b.events.push({ t: b.t, ...e });
  const dir = (side) => (side === 0 ? 1 : -1);
  const MAX_UNITS = 36;

  function spawn(sp) {
    const T = sp.T;
    if (b.units.filter((u) => u.side === sp.side && u.hp > 0).length >= MAX_UNITS) return;
    const u = {
      id: nextId++, type: sp.type, side: sp.side, T, sp, tier: sp.tier || 1, card: sp.card || null,
      x: -dir(sp.side) * FIELD.spawnX, z: slotZ(sp.slot) * 0.8 + (rng.next() - 0.5) * 0.4,
      hp: T.hp, max: T.hp, atk: T.cd * 0.5, target: null, state: 'walk', facing: dir(sp.side), lastHitBy: null,
    };
    b.units.push(u);
    b.stats[sp.side].spawned += 1;
    sp.sent += 1;
    emit({ type: 'spawn', id: u.id, side: u.side, slot: sp.slot, unit: u.type });
  }

  function hurt(u, dmg, src) {
    const n = src?.T?.pierce ? dmg : Math.max(1, dmg - u.T.armor);
    u.hp -= n;
    if (src?.sp) src.sp.dealt += n;
    emit({ type: 'hit', id: u.id, amount: n, src: src?.id ?? null });
    if (u.hp <= 0 && u.state !== 'dead') {
      u.state = 'dead';
      u.deadAt = b.t;
      b.stats[u.side].lost += 1;
      if (src?.sp) src.sp.kills += 1;
      emit({ type: 'death', id: u.id, side: u.side });
    }
  }

  function hurtCastle(c, dmg, src) {
    c.hp -= dmg;
    b.stats[1 - c.side].castleDmg += dmg;
    if (src?.sp) src.sp.dealt += dmg;
    emit({ type: 'castle', side: c.side, amount: dmg, src: src?.id ?? null });
  }

  function nearestEnemy(u) {
    let best = null;
    let bd = u.T.aggro;
    for (const v of b.units) {
      if (v.side === u.side || v.state === 'dead') continue;
      const d = Math.hypot(v.x - u.x, v.z - u.z) - v.T.radius;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  function strike(u, target) {
    emit({ type: 'attack', id: u.id, ranged: u.T.range > 1 });
    if (u.T.range > 1) {
      // Arrows fly, then land.
      const tx = target.castle ? target.castle.x : target.unit.x;
      const tz = target.castle ? target.castle.z : target.unit.z;
      b.projectiles.push({ id: nextId++, side: u.side, src: u, x: u.x, z: u.z, sx: u.x, sz: u.z, tx, tz, target, dmg: u.T.dmg, t: 0, dur: Math.max(0.25, Math.hypot(tx - u.x, tz - u.z) / 11) });
      emit({ type: 'shoot', id: b.projectiles[b.projectiles.length - 1].id, src: u.id });
    } else if (target.castle) hurtCastle(target.castle, u.T.dmg, u);
    else hurt(target.unit, u.T.dmg, u);
  }

  b.step = function step() {
    if (b.over) return;
    b.t += DT;

    for (const side of [0, 1]) for (const sp of b.spawners[side]) {
      if (!sp) continue;
      sp.timer += DT;
      if (sp.timer >= sp.T.spawn) { sp.timer -= sp.T.spawn; spawn(sp); }
    }

    for (const u of b.units) {
      if (u.state === 'dead') continue;
      const enemyCastle = b.castles[1 - u.side];
      const foe = nearestEnemy(u);
      let tx, tz, reach;
      if (foe) { tx = foe.x; tz = foe.z; reach = u.T.range + u.T.radius + foe.T.radius; }
      else { tx = enemyCastle.x; tz = enemyCastle.z + Math.max(-0.9, Math.min(0.9, u.z)); reach = u.T.range + u.T.radius + FIELD.castleR; }
      const dx = tx - u.x;
      const dz = tz - u.z;
      const d = Math.hypot(dx, dz);
      if (d <= reach) {
        u.state = 'attack';
        if (Math.abs(dx) > 0.01) u.facing = Math.sign(dx);
        u.atk += DT;
        if (u.atk >= u.T.cd) { u.atk -= u.T.cd; strike(u, foe ? { unit: foe } : { castle: enemyCastle }); }
      } else {
        u.state = 'walk';
        u.atk = Math.min(u.atk + DT, u.T.cd * 0.6);
        const sp = u.T.speed * DT;
        u.x += (dx / d) * sp;
        u.z += (dz / d) * sp;
        if (Math.abs(dx) > 0.01) u.facing = Math.sign(dx);
      }
      u.z = Math.max(-FIELD.depth / 2 + 0.6, Math.min(FIELD.depth / 2 - 0.6, u.z));
    }

    // Soft collisions so crowds spread out instead of stacking.
    const live = b.units.filter((u) => u.state !== 'dead');
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const c = live[j];
        const dx = c.x - a.x;
        const dz = c.z - a.z;
        const min = a.T.radius + c.T.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        c.x += (dx / d) * push; c.z += (dz / d) * push;
      }
    }

    for (let i = b.projectiles.length - 1; i >= 0; i--) {
      const p = b.projectiles[i];
      p.t += DT;
      if (p.target.unit && p.target.unit.state !== 'dead') { p.tx = p.target.unit.x; p.tz = p.target.unit.z; }
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.z = p.sz + (p.tz - p.sz) * k;
      if (k >= 1) {
        if (p.target.castle) hurtCastle(p.target.castle, p.dmg, p.src);
        else if (p.target.unit.state !== 'dead') hurt(p.target.unit, p.dmg, p.src);
        emit({ type: 'land', id: p.id });
        b.projectiles.splice(i, 1);
      }
    }

    // Bodies linger briefly for the renderer, then go.
    b.units = b.units.filter((u) => u.state !== 'dead' || b.t - u.deadAt < 2);

    // Siege: after a minute both castles crumble faster and faster, so stalemates end.
    if (b.t >= SIEGE_AT) {
      b.siegeClock = (b.siegeClock || 0) + DT;
      if (b.siegeClock >= 1) {
        b.siegeClock -= 1;
        b.siegeK = (b.siegeK || 0) + 2;
        for (const c of b.castles) { c.hp -= b.siegeK; emit({ type: 'castle', side: c.side, amount: b.siegeK, src: null, siege: true }); }
      }
    }

    const dead = b.castles.map((c) => c.hp <= 0);
    if (dead[0] || dead[1] || b.t >= 150) {
      b.over = true;
      if (dead[0] !== dead[1]) b.winner = dead[0] ? 1 : 0;
      else {
        // Tie-break: castle HP, then the army still standing, then a coin flip.
        const army = (side) => b.units.filter((u) => u.side === side && u.state !== 'dead').reduce((a, u) => a + u.hp, 0);
        const score = (side) => b.castles[side].hp * 1000 + army(side);
        const d = score(0) - score(1);
        b.winner = d > 0 ? 0 : d < 0 ? 1 : rng.int(2);
      }
      emit({ type: 'end', winner: b.winner });
    }
  };

  b.runToEnd = () => { while (!b.over) b.step(); return b.winner; };
  return b;
}
