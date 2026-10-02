// Deterministic battle simulation. Two fortresses, units on cooldowns.
// The renderer steps it in real time and drains `battle.events` for effects.
import { CARDS, RULES, starMult } from './content.js';
import { createRng } from './rng.js';
import { TRINKETS, aggregate } from './trinkets.js';

export const DT = 0.05;

function makeUnit(id, side, slot, perm = 0, summoned = false, extra = {}) {
  const def = CARDS[id];
  return {
    def, id, side, slot, perm, summoned,
    meals: extra.meals || 0, owned: extra.owned || 0, stars: extra.stars || 0, fires: 0, dealt: 0, accel: 0, selfBonus: 0,
    bonus: 0, frozen: 0, guard: 0,
    timers: def.t.map(([cd, ...acts], i) => ({ cd, acts, prog: def.firstStrike && i === 0 ? cd : 0 })),
    onceDone: false, summons: 0, blessCount: 0, ramp: 0, shots: 0, altIdx: 0, primed: false,
    pulse: 0,
  };
}

export function createBattle({ left, right, seed = 1 }) {
  const rng = createRng(seed);
  const events = [];
  const sides = [left, right].map((snap, idx) => {
    const tkIds = (snap.trinkets || []).filter((id) => TRINKETS[id]);
    const tk = aggregate(tkIds);
    const maxHp = snap.hp + (tk.start?.maxHp || 0) + (tk.hpPerGold ? Math.min(tk.hpPerGold, (snap.gold || 0) * (tk.hpGoldMult || 1)) : 0);
    return {
    idx,
    name: snap.name,
    tk, tkIds,
    // trinket timers and once-per-fight thresholds, kept per trinket so the board can pulse it
    tkTimers: tkIds.flatMap((id) => (TRINKETS[id].m.every || []).map(([s, act]) => ({ id, s, act, prog: 0 }))),
    tkStand: tkIds.flatMap((id) => (TRINKETS[id].m.lastStand || []).map(([below, ...acts]) => ({ id, below, acts, done: false }))),
    actCount: 0, echoCount: 0, revivedTk: false,
    table: snap.tableCount || 0, wallActs: 0, lastActs: null,
    maxHp,
    hp: Math.ceil(maxHp * (tk.startHp || 1)),
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
    attacks: 0, crits: 0, misses: 0,
    peak: { burn: 0, poison: 0, sand: 0, luck: 0, heat: 0, cold: 0, shield: 0 },
  };
  });

  const b = { t: 0, sides, events, over: false, winner: -1, rng, suddenK: 0, suddenClock: 0 };
  // Per-unit fight stats for the end-of-round summary.
  const blankStats = () => ({ hit: 0, burn: 0, poison: 0, burnApplied: 0, poisonApplied: 0, freeze: 0, heal: 0, shield: 0, sand: 0, luck: 0, heat: 0, cold: 0, attacks: 0, crits: 0, misses: 0 });
  const statsOf = (u) => { const o = u.owner || u; return o.st || (o.st = blankStats()); };
  const statsAt = (r) => { const u = r && sides[r.side].units[r.slot]; return u ? statsOf(u) : null; };
  function track(e) {
    const st = statsAt(e.src);
    if (!st) return;
    if (e.type === 'dmg' && e.src.side !== e.side && e.kind === 'dmg') st.hit += e.amount + e.absorbed;
    else if (e.type === 'status' && st[e.kind] != null) st[e.kind === 'burn' || e.kind === 'poison' ? `${e.kind}Applied` : e.kind] += e.amount;
    else if (e.type === 'heal') st.heal += e.amount;
    else if (e.type === 'shield') st.shield += e.amount;
    else if (e.type === 'freeze') st.freeze += e.dur;
  }
  const emit = (e) => { events.push({ t: b.t, ...e }); track(e); };
  const alive = (S) => S.units.filter(Boolean);
  const ref = (u) => (u ? { side: u.refSide ?? u.side, slot: u.slot } : null);
  const sum = (S, key) => alive(S).reduce((a, u) => a + (u.def[key] || 0), 0);
  const neighbours = (u) => {
    const S = sides[u.side];
    return [S.units[u.slot - 1], S.units[u.slot + 1]].filter(Boolean);
  };
  const owner = (u) => u.owner || u;
  // Does unit v match a filter like { kin: 'wolf' } or { applies: 'burn' }?
  const matches = (v, f) => (f.flag ? !!v.def[f.flag] && !(f.pending && v.onceDone) : f.kin ? v.def.kin === f.kin : f.family ? v.def.family === f.family
    : f.applies ? v.def.t.some((t) => t.slice(1).some((a) => a.k === f.applies)) : true);
  b.roster = [[], []];
  for (const S of sides) for (const u of S.units) if (u) b.roster[S.idx].push(u);
  const has = (S, key) => alive(S).some((u) => u.def[key]);
  const opp = (S) => sides[1 - S.idx];
  const low = (S) => S.hp < S.maxHp * 0.5;
  const emptySlots = (S) => S.units.filter((v) => !v).length;
  const families = (S) => new Set(alive(S).map((v) => v.def.family)).size;
  const oppositeOf = (u) => sides[1 - u.side].units[u.slot] || null;
  const tkWith = (S, key) => S.tkIds.find((id) => TRINKETS[id].m[key] != null) || null;

  // Trinket bonuses on one of a unit's actions of kind k: flat first, then percent.
  function tkAmount(u, k, n) {
    const S = sides[u.side];
    const E = opp(S);
    const tk = S.tk;
    if (!(n > 0)) return n;
    let add = tk.add?.[k] || 0;
    for (const f of tk.kinAdd || []) if (f.k === k && matches(u, f)) add += f.n;
    if (tk.leftAdd?.[k] && alive(S)[0] === u) add += tk.leftAdd[k];
    let pct = tk.pct?.[k] || 0;
    if (k === 'dmg') {
      if (tk.shieldedDmg && S.shield > 0) add += tk.shieldedDmg;
      if (tk.dmgPerShield) add += Math.floor(S.shield / tk.dmgPerShield);
      if (tk.dmgPerGold) add += Math.min(tk.dmgPerGoldMax || 99, Math.floor(S.gold / tk.dmgPerGold));
      if (tk.missingDmg) add += Math.min(tk.missingDmgMax || 99, Math.floor(Math.max(0, S.maxHp - S.hp) / tk.missingDmg));
      if (tk.vsShieldAdd && E.shield > 0) add += tk.vsShieldAdd;
      if (tk.coldDmg) add += Math.min(tk.coldDmgMax || 99, Math.floor(E.cold / tk.coldDmg));
      if (tk.lowCreature && low(S) && u.def.tags.includes('creature')) add += tk.lowCreature.dmg || 0;
      if (tk.execute && E.hp < E.maxHp * 0.5) pct += tk.execute;
      if (tk.lowDmgPct && low(S)) pct += tk.lowDmgPct;
      if (tk.frozenVuln && alive(E).some((v) => v.frozen > 0)) pct += tk.frozenVuln;
      // Venom Chalice on the other side: poison on us blunts our attacks
      if (E.tk.poisonWeaken) add -= Math.min(5, Math.floor(S.poison / E.tk.poisonWeaken));
    }
    if ((k === 'burn' || k === 'poison') && tk.sandFuel) add += Math.min(4, Math.floor(E.sand / tk.sandFuel));
    if (k === 'freeze') return n * (1 + pct);
    if (!add && !pct) return n;
    return Math.max(k === 'dmg' ? 0 : 1, Math.round((n + add) * (1 + pct)));
  }

  // HP a side pays to its own effects (Warlock, Flagellant, Bloodberry Vow...).
  // Martyrs answer it with damage.
  function selfHarm(S, n) {
    if (n <= 0 || S.hp <= 0) return;
    const pay = Math.min(n, S.hp - 1);
    if (pay <= 0) return;
    S.hp -= pay;
    emit({ type: 'dmg', side: S.idx, amount: pay, absorbed: 0, src: null, kind: 'sudden' });
    for (const v of alive(S)) if (v.def.onSelfHarm) dealDamage(opp(S), Math.round(pay * v.def.onSelfHarm), { src: v, kind: 'dmg' });
  }

  // Apply burn or poison from side S (not from a unit) to its opponent.
  function addStatus(S, kind, n) {
    const E = opp(S);
    if (n <= 0) return;
    E[kind] += n;
    emit({ type: 'status', side: E.idx, kind, amount: n, src: null });
  }

  function speed(u) {
    const S = sides[u.side];
    const tk = S.tk;
    let haste = sum(S, 'haste') + (tk.haste || 0);
    if (u.def.tags.includes('creature')) {
      haste += sum(S, 'creatureHaste') + (tk.creatureHaste || 0);
      if (S.hp < S.maxHp * 0.5) haste += sum(S, 'lowCreatureHaste') + (tk.lowCreature?.haste || 0);
    }
    if (low(S)) haste += tk.lowHaste || 0;
    if (S.revivedTk) haste += tk.reviveHaste || 0;
    if (tk.edgeHaste) {
      const on = alive(S);
      if (on[0] === u || on[on.length - 1] === u) haste += tk.edgeHaste;
    }
    const slow = opp(S).tk.sandSlow;
    if (slow) haste -= Math.min(0.45, Math.floor(S.sand / slow) * 0.15);
    for (const v of neighbours(u)) haste += v.def.auraHaste || 0;
    const empty = S.units.filter((v) => !v).length;
    haste += sum(S, 'emptyHaste') * empty;
    if (u.def.burningHaste && sides[1 - u.side].burn > 0) haste += u.def.burningHaste;
    if (alive(S).some((v) => v.def.purist) && families(S) === 1) haste += Math.max(...alive(S).map((v) => v.def.purist || 0));
    haste += (u.stars || 0) * RULES.starHaste;
    haste = Math.min(0.5 + (tk.hasteCap || 0), haste);
    if (u.def.solo && alive(S).length === 1) haste += u.def.solo.haste;
    let heatNet = Math.max(-0.5 - (opp(S).tk.coldCap || 0), Math.min(0.5, (S.heat - S.cold) * 0.02));
    if (u.def.noCold || S.tk.coldImmune) heatNet = Math.max(0, heatNet);
    return Math.max(0.1, 1 + haste + heatNet + u.accel);
  }
  b.speed = speed;

  function missed(u) {
    const S = sides[u.side];
    const O = opp(S);
    const p = Math.min(RULES.sandCap + (O.tk.sandCap || 0), S.sand * (RULES.sandMiss + (O.tk.sandMiss || 0)));
    if (p > 0 && rng.chance(p)) {
      statsOf(u).misses += 1;
      S.misses += 1;
      emit({ type: 'miss', src: ref(u) });
      for (const a of O.tk.onEnemyMiss || []) tkAct(O, a);
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
    const sm = starMult(u.def, u.stars);
    if (act.fixed) return sm !== 1 ? Math.round(n * sm) : n;
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
    if (act.perEmpty) n += emptySlots(S) * act.perEmpty;
    if (act.perFamily) n += families(S) * act.perFamily;
    if (act.perTable) n += Math.min(act.perTable.max ?? Infinity, Math.floor(S.table / (act.perTable.per || 1)));
    if (act.k === 'dmg' && u.stored > 0 && !preview) { n += Math.floor(u.stored); u.stored = 0; }
    if (act.k === 'dmg' && u.stored > 0 && preview) n += Math.floor(u.stored);
    if (act.ifOppEmpty && !oppositeOf(u)) n *= act.ifOppEmpty;
    if (u.def.solo && alive(S).length === 1 && act.k === 'dmg') n *= u.def.solo.mult;
    if (!preview && act.nth && u.fires % act.nth === 0) n *= act.nthMult;
    if (!preview && act.firstMult && u.fires === 1) n *= act.firstMult;
    if (act.edge && (!S.units[u.slot - 1] || !S.units[u.slot + 1])) n *= act.edge;
    if (act.execute && E.hp < E.maxHp * 0.5) n *= act.execute;
    if (act.vsShield && E.shield > 0) n *= act.vsShield;
    const low = u.def.lowHp;
    if (low && low.k === act.k && S.hp < S.maxHp * low.below) n *= low.mult;
    if (sm !== 1) n = Math.round(n * sm);
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
      const thorns = sum(T, 'thorns') + (T.tk.thorns || 0);
      if (thorns > 0) dealDamage(sides[1 - T.idx], thorns, { kind: 'thorns', reflect: true });
      for (const v of alive(T)) if (v.def.onShieldHit) for (const a of v.def.onShieldHit) doAct(v, { ...a, trigger: true }, 1);
    }
    if (src && !reflect && src.side !== T.idx && kind === 'dmg' && T.tk.lowReflect && low(T)) {
      dealDamage(sides[1 - T.idx], Math.max(1, Math.round((n + absorbed) * T.tk.lowReflect)), { kind: 'thorns', reflect: true });
    }
    for (const st of T.tkStand) {
      if (st.done || T.hp <= 0 || T.hp >= T.maxHp * st.below) continue;
      st.done = true;
      emit({ type: 'trinket', side: T.idx, id: st.id });
      for (const a of st.acts) tkAct(T, a);
    }
    if (src && !reflect && src.side !== T.idx) {
      for (const v of alive(T)) {
        const bh = v.def.onBigHit;
        if (bh && n + absorbed >= bh.min) for (const a of bh.acts) doAct(v, { ...a, trigger: true }, 1);
      }
    }
  }

  function gainShield(S, n, src, quiet = false) {
    const cut = opp(S).tk.enemyShieldCut;
    if (cut) n = Math.round(n * (1 - cut));
    if (n <= 0) return;
    S.shield += n;
    if (!quiet) emit({ type: 'shield', side: S.idx, amount: n, src: ref(src) });
    if (quiet) return;
    if (S.tk.spikes) dealDamage(opp(S), Math.max(1, Math.round(n * S.tk.spikes)), { kind: 'dmg' });
    if (S.tk.shieldHeal) doHeal(S, Math.max(1, Math.round(n * S.tk.shieldHeal)), src, { chain: false });
  }

  function doHeal(S, n, src, { chain = true } = {}) {
    const cut = opp(S).tk.enemyHealCut;
    if (cut) n = Math.round(n * (1 - Math.min(0.9, cut)));
    if (n <= 0) return;
    const before = S.hp;
    S.hp = Math.min(S.maxHp, S.hp + n);
    const over = n - (S.hp - before);
    if (chain && over > 0 && (has(S, 'overheal') || S.tk.overheal)) gainShield(S, over, src);
    const tk = S.tk;
    if (tk.cleanseOnHeal && n >= (tk.cleanseMin || 0)) {
      S.poison = Math.max(0, S.poison - tk.cleanseOnHeal);
      if (tk.cleanseBurn) S.burn = Math.max(0, S.burn - tk.cleanseOnHeal);
    }
    if (chain) {
      if (tk.onHealDmg) dealDamage(opp(S), Math.max(1, Math.round(n * tk.onHealDmg)), { kind: 'dmg' });
      if (tk.onHealPoison) addStatus(S, 'poison', Math.max(1, Math.round(n * tk.onHealPoison)));
      if (tk.onHealCharge) { const v = pickFriend(S, (w) => w.timers.length); if (v) chargeUnit(v, tk.onHealCharge, null); }
    }
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
    n = tkAmount(u, 'dmg', n);
    if (n <= 0) return;
    const tk = S.tk;
    let crit = false;
    if (!act.trigger) {
      const extra = (tk.critChance || 0) + (tk.critPerSand ? E.sand * tk.critPerSand : 0);
      if (u.primed) { crit = true; u.primed = false; n *= 3; }
      else if ((S.luck > 0 || extra > 0) && rng.chance(Math.min(0.75, S.luck * RULES.luckCrit + extra))) { crit = true; n = Math.round(n * ((u.def.critMult || 2) + (tk.critMult || 0))); }
    }
    const hits = (act.hits || 1) * (act.twiceNoShield && E.shield <= 0 ? 2 : 1);
    const st = statsOf(u);
    st.attacks += 1;
    S.attacks += 1;
    if (crit) { st.crits += 1; S.crits += 1; }
    const hit = (m) => {
      if (tk.pierceFrac && !act.pierce) {
        const pn = Math.round(m * tk.pierceFrac);
        if (pn > 0) dealDamage(E, pn, { pierce: true, src: u, crit });
        if (m - pn > 0) dealDamage(E, m - pn, { src: u, crit });
      } else dealDamage(E, m, { pierce: !!act.pierce, src: u, crit });
    };
    for (let i = 0; i < hits; i++) hit(n);
    let total = n * hits;
    if (tk.extraHit) { const m = Math.max(1, Math.round(n * tk.extraHit)); hit(m); total += m; }
    if (tk.dmgBurn) addStatus(S, 'burn', Math.max(1, Math.round(total * tk.dmgBurn)));
    if (tk.lowLeech && low(S)) doHeal(S, Math.max(1, Math.round(total * tk.lowLeech)), null);
    if (crit) for (const a of tk.onCrit || []) tkAct(S, a);
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
    if ((has(E, 'warden') && E.shield > 0) || E.tk.freezeImmune) { emit({ type: 'resist', side: E.idx, src: ref(u) }); return; }
    let pool = alive(E).filter((v) => !v.def.noFreeze && v.guard <= 0 && (v.timers.length || v.def.once));
    if (!pool.length) return;
    let picks;
    if (target === 'random') {
      const fresh = pool.filter((v) => v.frozen <= 0);
      picks = [rng.pick(fresh.length ? fresh : pool)];
    } else if (target === 'opposite') {
      const v = oppositeOf(u);
      if (!v || !pool.includes(v)) return;
      picks = [v];
    } else if (target === 'last') {
      picks = [E.lastActed && pool.includes(E.lastActed) ? E.lastActed : rng.pick(pool)];
    } else if (target === 'fastest') {
      const cd = (v) => Math.min(...v.timers.map((t) => t.cd), 99);
      pool.sort((a, c) => cd(a) - cd(c) || a.slot - c.slot);
      picks = [pool[0]];
    } else {
      pool.sort((a, c) => c.def.tier - a.def.tier || a.slot - c.slot);
      picks = target === 'all' ? pool : pool.slice(0, target === 'top2' ? 2 : 1);
    }
    const mult = (has(S, 'freezeMult') ? 1.5 : 1) * (1 - (E.tk.freezeResist || 0));
    for (const v of picks) {
      v.frozen = Math.max(v.frozen, dur * mult);
      emit({ type: 'freeze', src: ref(u), target: ref(v), dur: dur * mult });
      for (const w of alive(S)) if (w.def.onFreeze) for (const a of w.def.onFreeze) doAct(w, a, 1);
      for (const a of S.tk.onFreeze || []) tkAct(S, a);
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
      selfHarm(S, act.hp);
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
    tickAll(u) {
      const E = sides[1 - u.side];
      if (E.burn > 0) tickBurn(E);
      if (E.poison > 0) tickPoison(E);
    },
    selfHarm(u, act) { selfHarm(sides[u.side], act.n); },
    // Parrot: repeat the last action another of your units took.
    parrot(u, act) {
      const S = sides[u.side];
      const acts = S.lastActs;
      if (!acts) return;
      emit({ type: 'copy', src: ref(u), target: S.lastActor ? ref(S.lastActor) : null });
      for (const a of acts) if (a.k !== 'special' || a.fx !== 'parrot') doAct(u, { ...a, trigger: true }, act.pct);
    },
    // Countdowns: bring every ticking countdown on your wall closer.
    advance(u, act) {
      const S = sides[u.side];
      for (const v of alive(S)) if (v.def.once && !v.onceDone) v.onceAdv = (v.onceAdv || 0) + act.s;
    },
    // Freeze one of your own units to charge it up (Hibernating Bear and friends).
    chillAlly(u, act) {
      const S = sides[u.side];
      const pool = alive(S).filter((v) => v !== u);
      const v = pool.find((w) => w.def.hibernate) || pool[0];
      if (!v) return;
      v.frozen = Math.max(v.frozen, act.dur);
      v.bonus += act.bonus || 0;
      emit({ type: 'freeze', src: ref(u), target: ref(v), dur: act.dur });
    },
    copyOpposite(u) {
      const v = oppositeOf(u);
      if (!v || !v.timers.length) return;
      const proxy = Object.create(v);
      proxy.side = u.side;
      proxy.slot = u.slot;
      proxy.owner = u;
      emit({ type: 'copy', src: ref(u), target: ref(v) });
      for (const a of v.timers[0].acts) if (a.k !== 'summon') doAct(proxy, { ...a, trigger: true }, 1);
    },
    steam(u, act) {
      const S = sides[u.side];
      if (S.heat <= 0) return;
      attack(u, { k: 'dmg', n: S.heat, fixed: true }, 1);
      S.heat = Math.max(0, S.heat - act.lose);
    },
    frostfire(u, act) {
      const E = sides[1 - u.side];
      const take = Math.min(act.take, E.cold);
      if (take <= 0) return;
      E.cold -= take;
      doAct(u, { k: 'burn', n: take, fixed: true, trigger: true }, 1);
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

  // An action that comes from a trinket rather than a unit.
  function tkAct(S, a) {
    const E = opp(S);
    const freezable = () => (E.tk.freezeImmune ? [] : alive(E).filter((v) => !v.def.noFreeze && v.guard <= 0 && v.timers.length));
    switch (a.k) {
      case 'shield': return gainShield(S, a.n, null);
      case 'shieldPct': return gainShield(S, Math.max(1, Math.round(S.maxHp * a.n)), null);
      case 'heal': return doHeal(S, a.n, null);
      case 'healPct': return doHeal(S, Math.max(1, Math.round(S.maxHp * a.n)), null);
      case 'burn': case 'poison': return addStatus(S, a.k, a.n);
      case 'sand': case 'cold':
        E[a.k] += a.n;
        return emit({ type: 'status', side: E.idx, kind: a.k, amount: a.n, src: null });
      case 'heat': case 'luck':
        S[a.k] += a.n;
        return emit({ type: 'status', side: S.idx, kind: a.k, amount: a.n, src: null });
      case 'dmg': return dealDamage(E, a.n, { kind: 'dmg' });
      case 'selfDmg': return selfHarm(S, a.n);
      case 'charge': { const v = pickFriend(S, (w) => w.timers.length); if (v) chargeUnit(v, a.s, null); return; }
      case 'chargeAll': for (const v of alive(S)) if (v.timers.length) chargeUnit(v, a.s, null); return;
      case 'delay': {
        const pool = alive(E).filter((v) => v.timers.length);
        if (!pool.length) return;
        const v = rng.pick(pool);
        for (const t of v.timers) t.prog -= a.s;
        return emit({ type: 'delay', src: null, target: ref(v), s: a.s });
      }
      case 'detonateCold': return E.cold > 0 ? dealDamage(E, E.cold, { kind: 'dmg' }) : undefined;
      case 'freeze': case 'freezeAll': {
        if (a.minCold && E.cold < a.minCold) return;
        const pool = freezable();
        if (!pool.length) return;
        const dur = a.dur * (1 - (E.tk.freezeResist || 0));
        for (const v of a.k === 'freeze' ? [rng.pick(pool)] : pool) {
          v.frozen = Math.max(v.frozen, dur);
          emit({ type: 'freeze', src: null, target: ref(v), dur });
        }
        return;
      }
      case 'rallyAll': for (const v of alive(S)) v.bonus += a.n; return;
      case 'recast': { const v = pickFriend(S, (w) => w.timers.length); if (v) fire(v, v.timers[0].acts); return; }
      default: throw new Error(`Unknown trinket action ${a.k}`);
    }
  }

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
      case 'shield': return gainShield(S, tkAmount(u, 'shield', num(u, act, scale)), u);
      case 'heal': {
        const n = tkAmount(u, 'heal', num(u, act, scale));
        doHeal(S, n, u);
        if (act.shieldToo) gainShield(S, act.shieldToo, u);
        if (act.dmgFrac) dealDamage(E, Math.floor(n * act.dmgFrac), { src: u });
        return;
      }
      case 'burn': {
        if (act.ifShield && S.shield <= 0) return;
        if (!act.trigger && missed(u)) return;
        let n = tkAmount(u, 'burn', num(u, act, scale));
        const hb = alive(S).find((v) => v.def.heatBurn && S.heat >= v.def.heatBurn.at);
        if (hb) n = Math.round(n * hb.def.heatBurn.mult);
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
        n = tkAmount(u, 'poison', n);
        if (n <= 0) return;
        E.poison += n;
        E.poisonSrc.set(owner(u), (E.poisonSrc.get(owner(u)) || 0) + n);
        emit({ type: 'status', side: E.idx, kind: 'poison', amount: n, src: ref(u) });
        return;
      }
      case 'freeze':
        if (act.chance && !rng.chance(act.chance)) return;
        if (missed(u)) return;
        return freezeTargets(u, act.target, tkAmount(u, 'freeze', act.dur * scale * (1 + 0.25 * (u.stars || 0))));
      case 'sand': {
        if (missed(u)) return;
        const n = tkAmount(u, 'sand', num(u, act, scale));
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
        if (act.target === 'right') {
          const r = S.units[u.slot + 1];
          if (r && r.timers.length) chargeUnit(r, act.s, u);
          return;
        }
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
    const O = opp(S);
    for (const W of sides) if (W.tk.shieldPerAct) gainShield(W, W.tk.shieldPerAct, null, true);
    // Crown of the Ruined King: every Nth action of ours is turned against us.
    if (O.tk.confuse && ++S.actCount % O.tk.confuse === 0) {
      const proxy = Object.create(u);
      proxy.side = O.idx;
      proxy.refSide = u.side;
      proxy.owner = { dealt: 0 };
      emit({ type: 'confused', src: ref(u), side: S.idx });
      emit({ type: 'trinket', side: O.idx, id: tkWith(O, 'confuse') });
      for (const a of acts) if (!['summon', 'charge', 'bless', 'special', 'delay'].includes(a.k)) doAct(proxy, a, 1);
    } else {
      for (const a of acts) doAct(u, a, 1);
      if (S.tk.echo && ++S.echoCount % S.tk.echo === 0) {
        emit({ type: 'trinket', side: S.idx, id: tkWith(S, 'echo') });
        for (const a of acts) doAct(u, a, 1);
      }
    }
    if (S.tk.chain) { const r = S.units[u.slot + 1]; if (r && r.timers.length) chargeUnit(r, S.tk.chain, null); }
    // remember for Parrots
    if (!u.def.parrot) { S.lastActs = acts; S.lastActor = u; }
    // Jousters answer the enemy unit facing them
    const facing = O.units[u.slot];
    if (facing && facing.def.onOppositeAct && facing.frozen <= 0) for (const a of facing.def.onOppositeAct) doAct(facing, { ...a, trigger: true }, 1);
    // Relay Runner: the unit to its right goes at once (a short chain at most)
    if (u.def.relay && (b.relayDepth || 0) < 4) {
      const r = S.units[u.slot + 1];
      if (r && r.timers.length && r.frozen <= 0) {
        b.relayDepth = (b.relayDepth || 0) + 1;
        emit({ type: 'charge', src: ref(u), target: ref(r), amount: 0 });
        fire(r, r.timers[0].acts);
        b.relayDepth -= 1;
      }
    }
    // Conductor: every Nth action on the wall cues everyone else
    if (!b.conducting) {
      S.wallActs += 1;
      const c = alive(S).filter((v) => v.def.conductor).sort((x, y) => x.def.conductor - y.def.conductor)[0];
      if (c && S.wallActs % c.def.conductor === 0) {
        b.conducting = true;
        emit({ type: 'act', src: ref(c) });
        for (const v of alive(S)) if (v !== c && v.timers.length && v.frozen <= 0) fire(v, v.timers[0].acts);
        b.conducting = false;
      }
    }
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
  function creditTick(S, srcMap, n, kind) {
    let total = 0;
    for (const w of srcMap.values()) total += w;
    if (total <= 0) return;
    for (const [u, w] of srcMap) if (u.side !== S.idx) { u.dealt += (n * w) / total; statsOf(u)[kind] += (n * w) / total; }
  }

  function tickBurn(S) {
    if (S.burn <= 0) return;
    const E = sides[1 - S.idx];
    let n = S.burn;
    if (E.tk.burnTickPct) n = Math.round(n * (1 + E.tk.burnTickPct));
    if (S.tk.shieldBurnCut && S.shield > 0) n = Math.max(1, Math.round(n * (1 - S.tk.shieldBurnCut)));
    creditTick(S, S.burnSrc, n, 'burn');
    const hp0 = S.hp;
    dealDamage(S, n, { kind: 'burn', pierce: !!E.tk.burnPierce });
    if (E.tk.leech?.burn) doHeal(E, Math.max(1, Math.round((hp0 - S.hp) * E.tk.leech.burn)), null);
    const ifrit = alive(E).some((v) => v.def.ifrit && v.frozen <= 0);
    const decay = E.tk.burnDecay || RULES.burnDecay;
    // Burn halves each tick (rounded in the burner's favour), so it can't snowball.
    if (!ifrit && decay !== Infinity) {
      const before = S.burn;
      S.burn -= Math.max(1, Math.ceil(S.burn / decay));
      if (S.burn <= 0) { S.burn = 0; S.burnSrc.clear(); }
      else for (const [k, w] of S.burnSrc) S.burnSrc.set(k, (w * S.burn) / before);
    }
    emit({ type: 'tick', side: S.idx, kind: 'burn', amount: n, left: S.burn });
    for (const v of alive(E)) if (v.def.onEnemyBurnTick) for (const a of v.def.onEnemyBurnTick) doAct(v, a, 1);
  }

  function tickPoison(S) {
    if (S.poison <= 0) return;
    const E = sides[1 - S.idx];
    const n = E.tk.poisonTickPct ? Math.round(S.poison * (1 + E.tk.poisonTickPct)) : S.poison;
    creditTick(S, S.poisonSrc, n, 'poison');
    const hp0 = S.hp;
    dealDamage(S, n, { kind: 'poison', pierce: !S.tk.poisonBlock });
    if (E.tk.leech?.poison && hp0 > S.hp) doHeal(E, Math.max(1, Math.round((hp0 - S.hp) * E.tk.leech.poison)), null);
    emit({ type: 'tick', side: S.idx, kind: 'poison', amount: n, left: S.poison });
    if (E.tk.poisonGrow) S.poison += Math.max(1, Math.floor(S.poison * E.tk.poisonGrow));
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
    if (!S.revivedTk && S.tk.revive) {
      S.revivedTk = true;
      S.hp = Math.ceil(S.maxHp * S.tk.revive);
      S.heat += S.tk.reviveHeat || 0;
      emit({ type: 'revive', side: S.idx, by: 'trinket' });
      emit({ type: 'trinket', side: S.idx, id: tkWith(S, 'revive') });
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
      if (se.k === 'burn' || se.k === 'poison') E[se.k === 'burn' ? 'burnSrc' : 'poisonSrc'].set(u, n);
      emit({ type: 'status', side: E.idx, kind: se.k, amount: n, src: ref(u) });
    }
    for (const u of alive(S)) for (let i = 0; i < (u.def.startBless || 0); i++) blessOnce(u);
    for (const u of alive(S)) if (u.def.startFrozen) u.frozen = u.def.startFrozen;
    for (const u of alive(S)) if (u.def.startShieldPerTable) gainShield(S, u.def.startShieldPerTable * S.table, u);
    for (const u of alive(S)) if (u.def.startNeighbourBonus) for (const v of neighbours(u)) v.bonus += u.def.startNeighbourBonus;
    // trinkets
    const tk = S.tk;
    if (tk.start?.shield) gainShield(S, tk.start.shield, null);
    S.luck += tk.start?.luck || 0;
    S.heat += tk.start?.heat || 0;
    for (const [k, n] of Object.entries(tk.startEnemy || {})) {
      if (k === 'burn' || k === 'poison') addStatus(S, k, n);
      else { E[k] += n; emit({ type: 'status', side: E.idx, kind: k, amount: n, src: null }); }
    }
    if (tk.charge) for (const u of alive(S)) for (const t of u.timers) t.prog = Math.max(t.prog, t.cd * Math.min(0.95, tk.charge));
    if (tk.rallyStart) for (const u of alive(S)) u.bonus += tk.rallyStart;
  }
  for (const S of sides) if (S.tk.startDelay) for (const u of alive(opp(S))) for (const t of u.timers) t.prog -= S.tk.startDelay;

  // Current value of each number a unit shows on its card (first action of each kind).
  const LIVE = ['dmg', 'heal', 'shield', 'burn', 'poison', 'sand', 'heat', 'luck', 'bless'];
  // Live numbers for special actions that have one.
  function liveSpecial(u, a, S, E) {
    const extra = u.bonus + u.perm + (u.selfBonus || 0);
    switch (a.fx) {
      case 'pay': return { dmg: num(u, { k: 'dmg', n: a.dmg }, 1, true) };
      case 'pack': return { dmg: Math.min(a.max, alive(S).filter((v) => v.def.kin === 'wolf').length) * a.n + u.bonus + u.perm };
      case 'detonate': return { dmg: E[a.kind] };
      case 'sandworm': return { dmg: Math.min(E.sand, a.max || Infinity) * a.per };
      case 'myco': return { heal: Math.floor(E.poison / 2) + u.bonus + u.perm };
      case 'steam': return { dmg: S.heat };
      case 'bark': return { shield: a.n + Math.floor((S.maxHp - S.hp) * a.frac) + extra };
      default: return {};
    }
  }

  b.liveStats = function liveStats(u) {
    const S = sides[u.side];
    const E = sides[1 - u.side];
    const out = {};
    for (const t of u.timers) {
      for (const a0 of t.acts) {
        const a = a0.k === 'alt' ? a0.list[u.altIdx % a0.list.length] : a0;
        if (a.k === 'special') {
          const sp = liveSpecial(u, a, S, E);
          for (const k in sp) if (out[k] == null) out[k] = sp[k];
          continue;
        }
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
        out[a.k] = ['dmg', 'heal', 'shield', 'burn', 'poison', 'sand'].includes(a.k) ? tkAmount(u, a.k, n) : n;
      }
    }
    return out;
  };

  b.step = function step(dt = DT) {
    if (b.over) return;
    b.t += dt;
    for (const S of sides) for (const k in S.peak) if (S[k] > S.peak[k]) S.peak[k] = S[k];
    for (const S of sides) {
      for (const u of S.units) {
        if (!u) continue;
        u.pulse = Math.max(0, u.pulse - dt * 4);
        if (u.frozen > 0) {
          u.frozen -= dt;
          if (u.def.hibernate) u.stored = (u.stored || 0) + u.def.hibernate * dt;
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
        if (u.def.once && !u.onceDone && b.t - (u.onceStart || 0) + (u.onceAdv || 0) >= u.def.once[0]) {
          fire(u, u.def.once.slice(1));
          // hourglasses flip and start again; bombs go off once
          if (u.def.flips) { u.onceStart = b.t; u.onceAdv = 0; } else u.onceDone = true;
        }
      }
    }
    for (const S of sides) {
      for (const t of S.tkTimers) {
        t.prog += dt;
        if (t.prog >= t.s) { t.prog -= t.s; emit({ type: 'trinket', side: S.idx, id: t.id }); tkAct(S, t.act); }
      }
    }
    for (const S of sides) {
      const E = opp(S);
      S.burnClock += dt * (1 + (E.tk.burnRate || 0));
      if (S.burnClock >= RULES.burnTick) { S.burnClock -= RULES.burnTick; tickBurn(S); }
      S.poisonClock += dt * (1 + (E.tk.poisonRate || 0));
      if (S.poisonClock >= RULES.poisonTick) { S.poisonClock -= RULES.poisonTick; tickPoison(S); }
      if (S.healLog.length > 40) S.healLog.splice(0, S.healLog.length - 40);
      if (S.dmgLog.length > 80) S.dmgLog.splice(0, S.dmgLog.length - 80);
    }
    if (b.t >= RULES.suddenDeath) {
      b.suddenClock += dt;
      if (b.suddenClock >= RULES.suddenTick) {
        b.suddenClock -= RULES.suddenTick;
        b.suddenK += 1;
        for (const S of sides) dealDamage(S, Math.max(1, Math.round(b.suddenK * (1 - (S.tk.suddenCut || 0)))), { kind: 'sudden', pierce: true });
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
