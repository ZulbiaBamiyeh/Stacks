// Deterministic battle simulation. Two fortresses, units on cooldowns.
// The renderer steps it in real time and drains `battle.events` for effects.
import { CARDS, RULES } from './content.js';
import { createRng } from './rng.js';

export const DT = 0.05;

function makeUnit(id, side, slot, perm = 0, summoned = false, extra = {}) {
  const def = CARDS[id];
  return {
    def, id, side, slot, perm, summoned,
    meals: extra.meals || 0, owned: extra.owned || 0, fires: 0, dealt: 0, accel: 0, selfBonus: 0,
    bonus: 0, frozen: 0, guard: 0,
    timers: def.t.map(([cd, ...acts], i) => ({ cd, acts, prog: def.firstStrike && i === 0 ? cd : 0 })),
    onceDone: false, summons: 0, blessCount: 0, ramp: 0, shots: 0, altIdx: 0, primed: false,
    pulse: 0,
  };
}

export function createBattle({ left, right, seed = 1 }) {
  const rng = createRng(seed);
  const events = [];
  const sides = [left, right].map((snap, idx) => ({
    idx,
    name: snap.name,
    maxHp: snap.hp,
    hp: snap.hp,
    shield: 0, burn: 0, poison: 0, sand: 0, heat: 0, cold: 0, luck: 0,
    gold: snap.gold || 0,
    day: snap.day || 1,
    lastActed: null,
    units: Array.from({ length: snap.slots }, (_, i) => {
      const c = snap.wall[i];
      return c && CARDS[c.id]?.kind === 'unit' ? makeUnit(c.id, idx, i, c.perm || 0, false, c) : null;
    }),
    burnClock: 0, poisonClock: 0,
    burnSrc: new Map(), poisonSrc: new Map(),
    taken: { dmg: 0, burn: 0, poison: 0, sudden: 0, thorns: 0 },
    dmgLog: [],
    revived: { roc: false, ash: false },
    healLog: [],
  }));

  const b = { t: 0, sides, events, over: false, winner: -1, rng, suddenK: 0, suddenClock: 0 };
  const emit = (e) => events.push({ t: b.t, ...e });
  const alive = (S) => S.units.filter(Boolean);
  const ref = (u) => (u ? { side: u.side, slot: u.slot } : null);
  const sum = (S, key) => alive(S).reduce((a, u) => a + (u.def[key] || 0), 0);
  const neighbours = (u) => {
    const S = sides[u.side];
    return [S.units[u.slot - 1], S.units[u.slot + 1]].filter(Boolean);
  };
  const owner = (u) => u.owner || u;
  // Does unit v match a filter like { kin: 'wolf' } or { applies: 'burn' }?
  const matches = (v, f) => (f.kin ? v.def.kin === f.kin : f.family ? v.def.family === f.family
    : f.applies ? v.def.t.some((t) => t.slice(1).some((a) => a.k === f.applies)) : true);
  b.roster = [[], []];
  for (const S of sides) for (const u of S.units) if (u) b.roster[S.idx].push(u);
  const has = (S, key) => alive(S).some((u) => u.def[key]);

  function speed(u) {
    const S = sides[u.side];
    let haste = sum(S, 'haste');
    if (u.def.tags.includes('creature')) {
      haste += sum(S, 'creatureHaste');
      if (S.hp < S.maxHp * 0.5) haste += sum(S, 'lowCreatureHaste');
    }
    for (const v of neighbours(u)) haste += v.def.auraHaste || 0;
    const empty = S.units.filter((v) => !v).length;
    haste += sum(S, 'emptyHaste') * empty;
    if (u.def.burningHaste && sides[1 - u.side].burn > 0) haste += u.def.burningHaste;
    haste = Math.min(0.5, haste);
    let heatNet = Math.max(-0.5, Math.min(0.5, (S.heat - S.cold) * 0.02));
    if (u.def.noCold) heatNet = Math.max(0, heatNet);
    return Math.max(0.1, 1 + haste + heatNet + u.accel);
  }
  b.speed = speed;

  function missed(u) {
    const S = sides[u.side];
    const p = Math.min(RULES.sandCap, S.sand * RULES.sandMiss);
    if (p > 0 && rng.chance(p)) {
      emit({ type: 'miss', src: ref(u) });
      for (const v of alive(sides[1 - u.side])) {
        if (v.def.onEnemyMiss) for (const a of v.def.onEnemyMiss) doAct(v, a, 1);
      }
      return true;
    }
    return false;
  }

  // preview: the value the next action would have, without counting shot-specific bonuses.
  function num(u, act, scale, preview = false) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    let n = act.n;
    if (act.fixed) return n;
    if (act.k === u.def.main) n += u.bonus + u.perm + u.selfBonus;
    for (const v of neighbours(u)) if (v.def.aura && v.def.aura.k === act.k) n += v.def.aura.n;
    if (act.ramp) n += Math.min(act.ramp, Math.max(0, preview ? u.fires : u.fires - 1)) * (act.rampStep || 1);
    if (act.perEnemy) n += Math.min(act.perEnemy[2] ?? Infinity, Math.floor(E[act.perEnemy[0]] / act.perEnemy[1]));
    if (act.ifEnemy && E[act.ifEnemy[0]] > 0) n += act.ifEnemy[1];
    if (act.perShield) n += Math.floor(S.shield / act.perShield);
    if (act.perMissing) n += Math.floor(Math.max(0, S.maxHp - S.hp) / act.perMissing);
    if (act.perDay) n += Math.floor(S.day * act.perDay);
    if (act.perAlly) n += Math.min(act.perAlly.max ?? Infinity, alive(S).filter((v) => v !== u && matches(v, act.perAlly)).length) * act.perAlly.n;
    if (act.perFrozen) n += alive(E).filter((v) => v.frozen > 0).length * act.perFrozen;
    if (!preview && act.nth && u.fires % act.nth === 0) n *= act.nthMult;
    if (!preview && act.firstMult && u.fires === 1) n *= act.firstMult;
    if (act.edge && (!S.units[u.slot - 1] || !S.units[u.slot + 1])) n *= act.edge;
    if (act.execute && E.hp < E.maxHp * 0.5) n *= act.execute;
    if (act.vsShield && E.shield > 0) n *= act.vsShield;
    const low = u.def.lowHp;
    if (low && low.k === act.k && S.hp < S.maxHp * low.below) n *= low.mult;
    if (scale !== 1) n = n > 0 ? Math.max(1, Math.round(n * scale)) : 0;
    return n;
  }

  function credit(src, n) {
    if (src) owner(src).dealt += n;
  }

  function dealDamage(T, n, { pierce = false, src = null, crit = false, kind = 'dmg', reflect = false } = {}) {
    if (n <= 0) return;
    if (src && src.side !== T.idx) credit(src, n);
    T.taken[kind === 'dmg' || kind === 'thorns' || kind === 'sudden' || kind === 'burn' || kind === 'poison' ? kind : 'dmg'] += n;
    T.dmgLog.push([b.t, n]);
    let absorbed = 0;
    if (!pierce && T.shield > 0) {
      absorbed = Math.min(T.shield, n);
      T.shield -= absorbed;
      n -= absorbed;
    }
    T.hp -= n;
    emit({ type: 'dmg', side: T.idx, amount: n, absorbed, src: ref(src), crit, kind, pierce });
    if (absorbed > 0 && src && !reflect && src.side !== T.idx) {
      const thorns = sum(T, 'thorns');
      if (thorns > 0) dealDamage(sides[1 - T.idx], thorns, { kind: 'thorns', reflect: true });
      for (const v of alive(T)) if (v.def.onShieldHit) for (const a of v.def.onShieldHit) doAct(v, { ...a, trigger: true }, 1);
    }
    if (src && !reflect && src.side !== T.idx) {
      for (const v of alive(T)) {
        const bh = v.def.onBigHit;
        if (bh && n + absorbed >= bh.min) for (const a of bh.acts) doAct(v, { ...a, trigger: true }, 1);
      }
    }
  }

  function gainShield(S, n, src) {
    if (n <= 0) return;
    S.shield += n;
    emit({ type: 'shield', side: S.idx, amount: n, src: ref(src) });
  }

  function doHeal(S, n, src) {
    if (n <= 0) return;
    const before = S.hp;
    S.hp = Math.min(S.maxHp, S.hp + n);
    const over = n - (S.hp - before);
    if (over > 0 && has(S, 'overheal')) gainShield(S, over, src);
    S.healLog.push([b.t, n]);
    emit({ type: 'heal', side: S.idx, amount: n, src: ref(src) });
    for (const v of alive(S)) if (v.def.onHeal) for (const a of v.def.onHeal) doAct(v, a, 1);
    for (const v of alive(sides[1 - S.idx])) if (v.def.onEnemyHeal) for (const a of v.def.onEnemyHeal) doAct(v, { ...a, trigger: true }, 1);
  }

  function attack(u, act, scale) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    if (!act.trigger && missed(u)) return;
    let n = num(u, act, scale);
    if (act.perGold) n += Math.floor(S.gold / act.perGold);
    if (act.perOwned) n += Math.min(act.perOwned, u.owned);
    if (act.goldMult) n = S.gold * act.goldMult;
    if (act.goldFrac) n = Math.min(act.max || Infinity, Math.floor(S.gold * act.goldFrac));
    if (act.shieldFrac) n = Math.floor(S.shield * act.shieldFrac);
    if (act.spendShield) { n = S.shield; S.shield = 0; }
    if (act.healFrac) {
      const healed = S.healLog.filter(([t]) => t > b.t - 4 * RULES.time).reduce((a, [, h]) => a + h, 0);
      n = Math.floor(healed * act.healFrac);
    }
    if (u.def.tags.includes('creature')) {
      for (const v of alive(S)) if (v !== u && v.def.alpha) n += v.def.alpha;
    }
    for (const v of alive(S)) if (v.def.venom) n += Math.min(v.def.venom, S.poison);
    if (n <= 0) return;
    let crit = false;
    if (!act.trigger) {
      if (u.primed) { crit = true; u.primed = false; n *= 3; }
      else if (S.luck > 0 && rng.chance(Math.min(0.6, S.luck * RULES.luckCrit))) { crit = true; n *= u.def.critMult || 2; }
    }
    const hits = (act.hits || 1) * (act.twiceNoShield && E.shield <= 0 ? 2 : 1);
    for (let i = 0; i < hits; i++) dealDamage(E, n, { pierce: !!act.pierce, src: u, crit });
    if (act.shieldGain) gainShield(S, act.shieldGain, u);
    if (act.delay) delayUnit(u, act.delay.target || 'random', act.delay.s);
    if (crit) {
      emit({ type: 'crit', src: ref(u) });
      for (const v of alive(S)) if (v.def.onCrit) for (const a of v.def.onCrit) doAct(v, a, 1);
    }
    if (act.lifesteal) doHeal(S, act.lifesteal, u);
    if (act.sandOnHit) { E.sand += act.sandOnHit; emit({ type: 'status', side: E.idx, kind: 'sand', amount: act.sandOnHit, src: ref(u) }); }
  }

  function freezeTargets(u, target, dur) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    if (has(E, 'warden') && E.shield > 0) { emit({ type: 'resist', side: E.idx, src: ref(u) }); return; }
    let pool = alive(E).filter((v) => !v.def.noFreeze && v.guard <= 0 && (v.timers.length || v.def.once));
    if (!pool.length) return;
    let picks;
    if (target === 'random') {
      const fresh = pool.filter((v) => v.frozen <= 0);
      picks = [rng.pick(fresh.length ? fresh : pool)];
    } else if (target === 'last') {
      picks = [E.lastActed && pool.includes(E.lastActed) ? E.lastActed : rng.pick(pool)];
    } else if (target === 'fastest') {
      const cd = (v) => Math.min(...v.timers.map((t) => t.cd), 99);
      pool.sort((a, c) => cd(a) - cd(c) || a.slot - c.slot);
      picks = [pool[0]];
    } else {
      pool.sort((a, c) => c.def.tier - a.def.tier || a.slot - c.slot);
      picks = pool.slice(0, target === 'top2' ? 2 : 1);
    }
    const mult = has(S, 'freezeMult') ? 1.5 : 1;
    for (const v of picks) {
      v.frozen = Math.max(v.frozen, dur * mult);
      emit({ type: 'freeze', src: ref(u), target: ref(v), dur: dur * mult });
      for (const w of alive(S)) if (w.def.onFreeze) for (const a of w.def.onFreeze) doAct(w, a, 1);
    }
  }

  function chargeUnit(v, s, src) {
    for (const t of v.timers) t.prog = Math.min(t.cd, t.prog + s);
    emit({ type: 'charge', src: ref(src), target: ref(v), amount: s });
  }

  // Push back an enemy unit's cooldowns.
  function delayUnit(u, target, s) {
    const E = sides[1 - u.side];
    const pool = alive(E).filter((v) => v.timers.length);
    if (!pool.length) return;
    let v;
    if (target === 'slowest') v = pool.sort((a, c) => Math.max(...c.timers.map((t) => t.cd)) - Math.max(...a.timers.map((t) => t.cd)))[0];
    else v = rng.pick(pool);
    for (const t of v.timers) t.prog = Math.max(0, t.prog - s);
    emit({ type: 'delay', src: ref(u), target: ref(v), amount: s });
  }

  function pickFriend(S, filter, avoid) {
    const pool = alive(S).filter((v) => v !== avoid && filter(v));
    return pool.length ? rng.pick(pool) : null;
  }

  function blessOnce(u, act) {
    const S = sides[u.side];
    const v = pickFriend(S, (w) => w.def.main);
    if (!v) return;
    v.bonus += 1;
    emit({ type: 'bless', src: ref(u), target: ref(v) });
    if (act?.charge) chargeUnit(v, act.charge, u);
    if (act?.luckEvery) {
      u.blessCount += 1;
      if (u.blessCount % act.luckEvery === 0) { S.luck += 1; emit({ type: 'status', side: S.idx, kind: 'luck', amount: 1, src: ref(u) }); }
    }
  }

  const SPECIAL = {
    furnace(u) {
      const S = sides[u.side];
      if (S.heat >= 20) { S.heat -= 10; attack(u, { k: 'dmg', n: 30, fixed: true }, 1); }
    },
    selfPoison(u, act) {
      const S = sides[u.side];
      S.poison += act.n;
      emit({ type: 'status', side: S.idx, kind: 'poison', amount: act.n, src: ref(u) });
    },
    glass(u) {
      const S = sides[u.side];
      const E = sides[1 - u.side];
      const take = Math.min(4, E.sand);
      if (take <= 0) return;
      E.sand -= take;
      gainShield(S, take * 3, u);
    },
    well(u) {
      const S = sides[u.side];
      if (S.luck < 3) return;
      S.luck -= 3;
      for (let i = 0; i < 4; i++) blessOnce(u);
    },
    prime(u) {
      const S = sides[u.side];
      if (S.luck < 5 || u.primed) return;
      S.luck -= 5;
      u.primed = true;
    },
    witch(u) {
      const E = sides[1 - u.side];
      if (E.poison > 0) tickPoison(E);
    },
    lich(u) {
      const S = sides[u.side];
      const n = [S.units[u.slot - 1], S.units[u.slot + 1]].filter((v) => v && v.timers.length);
      if (!n.length) return;
      const v = rng.pick(n);
      for (const t of v.timers) t.prog = t.cd;
      emit({ type: 'charge', src: ref(u), target: ref(v), amount: 99 });
    },
    djinn(u) {
      const S = sides[u.side];
      const v = pickFriend(S, (w) => w.timers.length && !['djinn', 'mirror'].includes(w.id), u);
      if (!v) return;
      const timer = rng.pick(v.timers);
      const proxy = Object.create(v);
      proxy.slot = u.slot;
      proxy.side = u.side;
      proxy.owner = u;
      emit({ type: 'copy', src: ref(u), target: ref(v) });
      for (const a of timer.acts) doAct(proxy, a, 1);
    },
    detonate(u, act) {
      const E = sides[1 - u.side];
      const n = E[act.kind];
      if (n <= 0 || missed(u)) return;
      dealDamage(E, n, { pierce: act.kind === 'poison', src: u, kind: 'dmg' });
    },
    convert(u, act) {
      const E = sides[1 - u.side];
      const take = Math.min(act.take, E.burn);
      if (take <= 0) return;
      E.burn -= take;
      const give = Math.max(1, Math.round((take / act.take) * act.give));
      E.poison += give;
      E.poisonSrc.set(owner(u), (E.poisonSrc.get(owner(u)) || 0) + give);
      emit({ type: 'status', side: E.idx, kind: 'poison', amount: give, src: ref(u) });
    },
    rally(u, act) {
      const S = sides[u.side];
      for (const v of alive(S)) {
        if (v === u || !matches(v, act)) continue;
        if (act.max && (v.rallied || 0) >= act.max) continue;
        v.rallied = (v.rallied || 0) + act.n;
        v.bonus += act.n;
        emit({ type: 'bless', src: ref(u), target: ref(v) });
      }
    },
    pack(u, act) {
      const S = sides[u.side];
      const count = Math.min(act.max, alive(S).filter((v) => v.def.kin === 'wolf').length);
      for (let i = 0; i < count; i++) attack(u, { k: 'dmg', n: act.n + (i === 0 ? u.bonus + u.perm : 0), fixed: true }, 1);
    },
    pay(u, act) {
      const S = sides[u.side];
      if (S.hp <= act.hp) return;
      S.hp -= act.hp;
      emit({ type: 'dmg', side: S.idx, amount: act.hp, absorbed: 0, src: null, kind: 'sudden' });
      attack(u, { k: 'dmg', n: act.dmg }, 1);
    },
    myco(u) {
      const S = sides[u.side];
      const n = Math.floor(sides[1 - u.side].poison / 2) + u.bonus + u.perm;
      if (n > 0) doHeal(S, n, u);
    },
    bark(u, act) {
      const S = sides[u.side];
      gainShield(S, act.n + Math.floor((S.maxHp - S.hp) * act.frac) + u.bonus + u.perm, u);
    },
    wisp(u) {
      const S = sides[u.side];
      const E = sides[1 - u.side];
      if (missed(u)) return;
      const pool = alive(E).filter((v) => !v.def.noFreeze && v.guard <= 0 && v.timers.length);
      if (!pool.length) return;
      const v = rng.pick(pool);
      const dur = 1.5 * (has(S, 'freezeMult') ? 1.5 : 1);
      v.frozen = Math.max(v.frozen, dur);
      emit({ type: 'freeze', src: ref(u), target: ref(v), dur });
      doAct(u, { k: 'burn', n: v.def.tier * 2, fixed: true, trigger: true }, 1);
    },
    breakShield(u, act) {
      const E = sides[1 - u.side];
      if (E.shield <= 0 || missed(u)) return;
      const n = Math.min(E.shield, act.n);
      E.shield -= n;
      emit({ type: 'dmg', side: E.idx, amount: 0, absorbed: n, src: ref(u), kind: 'dmg' });
    },
    tickBurn(u) {
      const E = sides[1 - u.side];
      if (E.burn > 0) tickBurn(E);
    },
    selfBonus(u, act) {
      if (u.selfBonus < act.max) u.selfBonus += 1;
    },
    sandworm(u, act) {
      const E = sides[1 - u.side];
      const stacks = Math.min(E.sand, act.max || Infinity);
      if (stacks <= 0) return;
      E.sand -= stacks;
      attack(u, { k: 'dmg', n: stacks * act.per, pierce: true, fixed: true }, 1);
    },
  };

  function doAct(u, act, scale) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    switch (act.k) {
      case 'alt': {
        const a = act.list[u.altIdx % act.list.length];
        u.altIdx += 1;
        return doAct(u, a, scale);
      }
      case 'dmg': return attack(u, act, scale);
      case 'shield': return gainShield(S, num(u, act, scale), u);
      case 'heal': {
        const n = num(u, act, scale);
        doHeal(S, n, u);
        if (act.shieldToo) gainShield(S, act.shieldToo, u);
        if (act.dmgFrac) dealDamage(E, Math.floor(n * act.dmgFrac), { src: u });
        return;
      }
      case 'burn': {
        if (act.ifShield && S.shield <= 0) return;
        if (!act.trigger && missed(u)) return;
        let n = num(u, act, scale);
        if (n <= 0) return;
        E.burn += n;
        E.burnSrc.set(owner(u), (E.burnSrc.get(owner(u)) || 0) + n);
        emit({ type: 'status', side: E.idx, kind: 'burn', amount: n, src: ref(u) });
        return;
      }
      case 'poison': {
        if (!act.trigger && missed(u)) return;
        let n = num(u, act, scale);
        if (act.pct) n = Math.max(act.min || 0, Math.min(act.max || Infinity, Math.floor(E.poison * act.pct))) + u.bonus + u.perm;
        if (act.per10) n += Math.floor(E.poison / (act.perN || 10)) * act.per10;
        n += sum(S, 'queen');
        E.poison += n;
        E.poisonSrc.set(owner(u), (E.poisonSrc.get(owner(u)) || 0) + n);
        emit({ type: 'status', side: E.idx, kind: 'poison', amount: n, src: ref(u) });
        return;
      }
      case 'freeze':
        if (act.chance && !rng.chance(act.chance)) return;
        if (missed(u)) return;
        return freezeTargets(u, act.target, act.dur * scale);
      case 'sand': {
        if (missed(u)) return;
        const n = num(u, act, scale);
        E.sand += n;
        emit({ type: 'status', side: E.idx, kind: 'sand', amount: n, src: ref(u) });
        return;
      }
      case 'heat':
        S.heat += act.n;
        emit({ type: 'status', side: S.idx, kind: 'heat', amount: act.n, src: ref(u) });
        return;
      case 'cold':
        E.cold += act.n;
        emit({ type: 'status', side: E.idx, kind: 'cold', amount: act.n, src: ref(u) });
        return;
      case 'luck':
        S.luck += act.n;
        emit({ type: 'status', side: S.idx, kind: 'luck', amount: act.n, src: ref(u) });
        return;
      case 'bless':
        for (let i = 0; i < act.n; i++) blessOnce(u, act);
        return;
      case 'summon': {
        if (u.summons >= act.max) return;
        const slot = S.units.findIndex((v) => !v);
        if (slot < 0) return;
        u.summons += 1;
        S.units[slot] = makeUnit(act.id, S.idx, slot, 0, true);
        b.roster[S.idx].push(S.units[slot]);
        emit({ type: 'summon', side: S.idx, slot, id: act.id, src: ref(u) });
        return;
      }
      case 'delay':
        if (missed(u)) return;
        return delayUnit(u, act.target, act.s);
      case 'charge': {
        let v;
        if (act.target === 'neighbours') {
          for (const w of neighbours(u)) if (w.timers.length) chargeUnit(w, act.s, u);
          return;
        }
        if (act.target === 'top') {
          const pool = alive(S).filter((w) => w.timers.length && w !== u).sort((a, c) => c.def.tier - a.def.tier || a.slot - c.slot);
          v = pool[0];
        } else {
          v = pickFriend(S, (w) => w.timers.length, u);
        }
        if (v) chargeUnit(v, act.s, u);
        return;
      }
      case 'special':
        return SPECIAL[act.fx](u, act, scale);
      default:
        throw new Error(`Unknown action ${act.k}`);
    }
  }

  function fire(u, acts) {
    const S = sides[u.side];
    u.pulse = 1;
    u.fires += 1;
    S.lastActed = u;
    if (u.def.accel) u.accel = Math.min(u.def.accel.max, u.accel + u.def.accel.per);
    emit({ type: 'act', src: ref(u) });
    for (const a of acts) doAct(u, a, 1);
    for (const v of neighbours(u)) if (v.def.onNeighbourAct) for (const a of v.def.onNeighbourAct) doAct(v, { ...a, trigger: true }, 1);
    const right = S.units[u.slot + 1];
    if (right && right.def.mirror && !u.def.mirror) {
      const proxy = Object.create(u);
      proxy.slot = right.slot;
      proxy.owner = right;
      right.pulse = 1;
      emit({ type: 'act', src: ref(right), mirror: true });
      for (const a of acts) doAct(proxy, a, right.def.mirror);
    }
  }

  // Split tick damage between the units that applied the stacks.
  function creditTick(S, srcMap, n) {
    let total = 0;
    for (const w of srcMap.values()) total += w;
    if (total <= 0) return;
    for (const [u, w] of srcMap) if (u.side !== S.idx) u.dealt += (n * w) / total;
  }

  function tickBurn(S) {
    if (S.burn <= 0) return;
    const n = S.burn;
    creditTick(S, S.burnSrc, n);
    dealDamage(S, n, { kind: 'burn' });
    const E = sides[1 - S.idx];
    const ifrit = alive(E).some((v) => v.def.ifrit && v.frozen <= 0);
    // Burn halves each tick (rounded in the burner's favour), so it can't snowball.
    if (!ifrit) {
      const before = S.burn;
      S.burn -= Math.max(1, Math.ceil(S.burn / RULES.burnDecay));
      if (S.burn <= 0) { S.burn = 0; S.burnSrc.clear(); }
      else for (const [k, w] of S.burnSrc) S.burnSrc.set(k, (w * S.burn) / before);
    }
    emit({ type: 'tick', side: S.idx, kind: 'burn', amount: n, left: S.burn });
    for (const v of alive(E)) if (v.def.onEnemyBurnTick) for (const a of v.def.onEnemyBurnTick) doAct(v, a, 1);
  }

  function tickPoison(S) {
    if (S.poison <= 0) return;
    creditTick(S, S.poisonSrc, S.poison);
    dealDamage(S, S.poison, { kind: 'poison', pierce: true });
    emit({ type: 'tick', side: S.idx, kind: 'poison', amount: S.poison, left: S.poison });
    for (const v of alive(sides[1 - S.idx])) if (v.def.onEnemyPoisonTick) for (const a of v.def.onEnemyPoisonTick) doAct(v, { ...a, trigger: true }, 1);
  }

  function checkDeath(S) {
    if (S.hp > 0) return false;
    if (!S.revived.roc && has(S, 'revive')) {
      S.revived.roc = true;
      S.hp = Math.ceil(S.maxHp * (alive(S).find((v) => v.def.revive)?.def.revive || 0.25));
      emit({ type: 'revive', side: S.idx, by: 'roc' });
      return false;
    }
    if (!S.revived.ash && has(S, 'ashborn') && S.heat > 0) {
      S.revived.ash = true;
      S.hp = Math.min(S.maxHp, S.heat * 4);
      S.heat = 0;
      emit({ type: 'revive', side: S.idx, by: 'ashborn' });
      return false;
    }
    return true;
  }

  // Fight start
  for (const S of sides) {
    const st = sum(S, 'startShield');
    if (st) gainShield(S, st, null);
    S.luck += sum(S, 'startLuck');
    const E = sides[1 - S.idx];
    for (const u of alive(S)) {
      const se = u.def.startEnemy;
      if (!se) continue;
      const n = Math.floor(u.meals * se.perMeal);
      if (n <= 0) continue;
      E[se.k] += n;
      E[se.k === 'burn' ? 'burnSrc' : 'poisonSrc'].set(u, n);
      emit({ type: 'status', side: E.idx, kind: se.k, amount: n, src: ref(u) });
    }
    for (const u of alive(S)) for (let i = 0; i < (u.def.startBless || 0); i++) blessOnce(u);
    for (const u of alive(S)) if (u.def.startNeighbourBonus) for (const v of neighbours(u)) v.bonus += u.def.startNeighbourBonus;
  }

  // Current value of each number a unit shows on its card (first action of each kind).
  const LIVE = ['dmg', 'heal', 'shield', 'burn', 'poison', 'sand', 'heat', 'luck', 'bless'];
  b.liveStats = function liveStats(u) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    const out = {};
    for (const t of u.timers) {
      for (const a0 of t.acts) {
        const a = a0.k === 'alt' ? a0.list[u.altIdx % a0.list.length] : a0;
        if (!LIVE.includes(a.k) || out[a.k] != null) continue;
        let n = num(u, a, 1, true);
        if (a.k === 'dmg') {
          if (a.perGold) n += Math.floor(S.gold / a.perGold);
          if (a.perOwned) n += Math.min(a.perOwned, u.owned);
          for (const v of alive(S)) if (v.def.venom) n += Math.min(v.def.venom, S.poison);
        }
        if (a.k === 'poison') {
          if (a.pct) n = Math.max(a.min || 0, Math.min(a.max || Infinity, Math.floor(E.poison * a.pct))) + u.bonus + u.perm;
          if (a.per10) n += Math.floor(E.poison / (a.perN || 10)) * a.per10;
          n += sum(S, 'queen');
        }
        out[a.k] = n;
      }
    }
    return out;
  };

  b.step = function step(dt = DT) {
    if (b.over) return;
    b.t += dt;
    for (const S of sides) {
      for (const u of S.units) {
        if (!u) continue;
        u.pulse = Math.max(0, u.pulse - dt * 4);
        if (u.frozen > 0) {
          u.frozen -= dt;
          if (u.frozen <= 0) { u.frozen = 0; u.guard = RULES.freezeGuard; emit({ type: 'thaw', target: ref(u) }); }
          continue;
        }
        if (u.guard > 0) u.guard -= dt;
        if (u.def.ahead && S.hp / S.maxHp <= sides[1 - S.idx].hp / sides[1 - S.idx].maxHp) continue;
        const sp = speed(u);
        for (const t of u.timers) {
          t.prog += dt * sp;
          if (t.prog >= t.cd) { t.prog -= t.cd; fire(u, t.acts); }
        }
        if (u.def.once && !u.onceDone && b.t >= u.def.once[0]) { u.onceDone = true; fire(u, u.def.once.slice(1)); }
      }
    }
    for (const S of sides) {
      S.burnClock += dt;
      if (S.burnClock >= RULES.burnTick) { S.burnClock -= RULES.burnTick; tickBurn(S); }
      S.poisonClock += dt;
      if (S.poisonClock >= RULES.poisonTick) { S.poisonClock -= RULES.poisonTick; tickPoison(S); }
      if (S.healLog.length > 40) S.healLog.splice(0, S.healLog.length - 40);
      if (S.dmgLog.length > 80) S.dmgLog.splice(0, S.dmgLog.length - 80);
    }
    if (b.t >= RULES.suddenDeath) {
      b.suddenClock += dt;
      if (b.suddenClock >= RULES.suddenTick) {
        b.suddenClock -= RULES.suddenTick;
        b.suddenK += 1;
        for (const S of sides) dealDamage(S, b.suddenK, { kind: 'sudden', pierce: true });
      }
    }
    const dead = sides.map(checkDeath);
    if (dead[0] || dead[1]) {
      b.over = true;
      if (dead[0] && dead[1]) b.winner = sides[0].hp > sides[1].hp ? 0 : 1;
      else b.winner = dead[0] ? 1 : 0;
      emit({ type: 'end', winner: b.winner });
    } else if (b.t > 180) {
      b.over = true;
      b.winner = sides[0].hp / sides[0].maxHp > sides[1].hp / sides[1].maxHp ? 0 : 1;
      emit({ type: 'end', winner: b.winner });
    }
  };

  b.runToEnd = function runToEnd() {
    while (!b.over) b.step();
    return b.winner;
  };

  return b;
}
