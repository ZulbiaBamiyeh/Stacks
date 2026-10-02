// Archetype balance: random walls drawn from each archetype's card pool at equal
// tier budgets, played round-robin. Run: node tools/balance.mjs [samples]
import { createBattle } from '../src/sim.js';
import { botGhost } from '../src/ghosts.js';
import { createRng } from '../src/rng.js';
import { CARDS, fortressHp } from '../src/content.js';

export const POOLS = {
  burn: ['fireMage', 'wisp', 'hellhound', 'fireScorpion', 'pyromancer', 'fireArcher', 'flameDancer', 'bonfireKeeper', 'willOWisp', 'smokeweaver', 'infernoMage', 'flameKnight', 'ifrit'],
  poison: ['scorpionSwarm', 'deathstalker', 'sporeScorpion', 'druid', 'hexer', 'fungalNest', 'scorpionNest', 'tombStalker', 'lavaScorpion', 'shellScorpion', 'myconid', 'witch', 'scorpionQueen'],
  freeze: ['frostFairy', 'wisp', 'deathstalker', 'iceMage', 'frostArcher', 'trapper', 'snowQueen', 'frostWolf', 'stormMage', 'archmage', 'wraith', 'shatterGolem'],
  heal: ['healer', 'dryad', 'treant', 'guard', 'shaman', 'paladin', 'groveSpirit', 'elderTreant', 'groveKeeper', 'sunSprite', 'alchemist', 'oasisSpirit', 'simurgh'],
  attack: ['archer', 'hunter', 'mage', 'scout', 'ranger', 'knight', 'sharpshooter', 'spearman', 'stormMage', 'windrunner', 'champion', 'hawkeye'],
  wolves: ['wolfPack', 'hellhound', 'direWolf', 'griffin', 'rabidWolf', 'alpha', 'cerberus', 'wolfRider', 'frostWolf', 'skyGriffin', 'boneHound', 'denMother', 'manticore'],
  luck: ['luckyFairy', 'fairyRing', 'scout', 'archer', 'gambler', 'rogue', 'fairyCourt', 'crystalFairy', 'cloverSprite', 'wishSprite', 'highRoller', 'fourLeafFairy'],
  sand: ['sandcaster', 'jackal', 'dustSprite', 'sandScorpion', 'duneGuard', 'stormCaller', 'mirage', 'duneStalker', 'desertStalker', 'sandworm'],
  bones: ['skeleton', 'graveWolf', 'boneKnight', 'necromancer', 'boneArcher', 'boneHound', 'ashCaller', 'tombStalker', 'plagueSkeleton', 'deathKnight', 'tombKing'],
  ice: ['snowSprite', 'iceImp', 'penguin', 'yetiCub', 'iceFisher', 'iceScorpion', 'icicleThrower', 'blizzardSprite', 'frostBat', 'snowballGolem', 'penguinColony', 'yeti', 'iceWall', 'frostGiant', 'cryomancer', 'auroraSpirit', 'shardstorm', 'mammoth', 'glacierGolem', 'hoarfrostDragon'],
  clockwork: ['hourglass', 'sandClock', 'timekeeper', 'stallWarden', 'doomsdayClock', 'endOfDays', 'guard', 'healer', 'paladin', 'treant', 'recluse', 'alchemist'],
  relay: ['relayRunner', 'courier', 'drummer', 'bannerBearer', 'conductor', 'grandOrchestra', 'archer', 'ranger', 'knight', 'sharpshooter', 'hunter'],
  desperado: ['werewolf', 'nightScorpion', 'moonFairy', 'nightWatch', 'warlock', 'moonhowler', 'venomDrinker', 'darkKnight', 'roc'],
};
// Each stage: how many cards of each tier a wall gets (4 = tier IV or a rare).
export const STAGES = {
  early: { day: 3, slots: 4, perm: 1, tiers: [1, 2, 2, 2] },
  mid: { day: 6, slots: 5, perm: 3, tiers: [2, 2, 2, 3, 3] },
  late: { day: 9, slots: 6, perm: 4, tiers: [3, 3, 3, 3, 3, 4] },
};

const tierOf = (id) => (CARDS[id].rare ? 4 : CARDS[id].tier);
export function sampleWall(name, st, r) {
  const pool = POOLS[name];
  const ids = st.tiers.map((t) => {
    // Nearest tier the pool has: same, then one below, one above, and so on.
    for (const d of [0, -1, 1, -2, 2, -3, 3]) {
      const opts = pool.filter((id) => tierOf(id) === t + d);
      if (opts.length) return r.pick(opts);
    }
    return r.pick(pool);
  });
  for (let i = ids.length - 1; i > 0; i--) { const j = r.int(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return {
    name, day: st.day, hp: fortressHp(st.day), gold: 12, slots: st.slots, tableCount: 6,
    wall: ids.map((id) => { const d = CARDS[id]; return { id, perm: d.perm || d.permWin || d.permLoss ? st.perm : 0 }; }),
  };
}

export function run(samples = 60, { quiet = false, stages = Object.keys(STAGES) } = {}) {
  const names = Object.keys(POOLS);
  const out = {};
  for (const stage of stages) {
    const st = STAGES[stage];
    const m = {};
    for (const a of names) {
      m[a] = {};
      for (const b of names) {
        if (a === b) continue;
        let w = 0;
        for (let s = 0; s < samples; s++) {
          const r = createRng(s * 9973 + a.length * 31 + b.length * 7 + stage.length);
          const A = sampleWall(a, st, r);
          const B = sampleWall(b, st, r);
          const left = s % 2 === 0;
          const f = createBattle({ left: left ? A : B, right: left ? B : A, seed: s + 1 });
          if ((f.runToEnd() === 0) === left) w++;
        }
        m[a][b] = w / samples;
      }
      let bw = 0;
      for (let s = 0; s < samples; s++) {
        const r = createRng(s * 131 + st.day);
        const f = createBattle({ left: sampleWall(a, st, r), right: botGhost(st.day, 0, 0, r), seed: s });
        if (f.runToEnd() === 0) bw++;
      }
      m[a].bots = bw / samples;
      m[a].avg = names.filter((b) => b !== a).reduce((x, b) => x + m[a][b], 0) / (names.length - 1);
    }
    out[stage] = m;
    if (quiet) continue;
    console.log(`\n== ${stage} (day ${st.day}) — row's win rate vs column`);
    console.log('           ' + names.map((n) => n.slice(0, 5).padStart(6)).join('') + '   AVG  bots');
    for (const a of names) {
      console.log(a.padEnd(11) + names.map((b) => (a === b ? '    - ' : `${Math.round(m[a][b] * 100)}`.padStart(5) + ' ')).join('') + `${Math.round(m[a].avg * 100)}`.padStart(5) + `${Math.round(m[a].bots * 100)}`.padStart(6));
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) run(Number(process.argv[2]) || 60);
