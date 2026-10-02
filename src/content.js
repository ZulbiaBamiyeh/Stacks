// Stackbrawl roster. Source of truth: docs/card-roster.md.
// Units are plain data: `t` lists timers as [cooldown, ...actions].
// Actions are built with the helpers below and interpreted by sim.js.

export const dmg = (n, o = {}) => ({ k: 'dmg', n, ...o });
export const shield = (n, o = {}) => ({ k: 'shield', n, ...o });
export const heal = (n, o = {}) => ({ k: 'heal', n, ...o });
export const burn = (n, o = {}) => ({ k: 'burn', n, ...o });
export const poison = (n, o = {}) => ({ k: 'poison', n, ...o });
export const freeze = (target, dur, o = {}) => ({ k: 'freeze', target, dur, ...o });
export const sand = (n, o = {}) => ({ k: 'sand', n, ...o });
export const heat = (n, o = {}) => ({ k: 'heat', n, ...o });
export const cold = (n) => ({ k: 'cold', n });
export const luck = (n) => ({ k: 'luck', n });
export const bless = (n, o = {}) => ({ k: 'bless', n, ...o });
export const summon = (id, max) => ({ k: 'summon', id, max });
export const charge = (target, s) => ({ k: 'charge', target, s });
export const special = (fx, o = {}) => ({ k: 'special', fx, ...o });
export const alt = (...list) => ({ k: 'alt', list });
export const delay = (target, s) => ({ k: 'delay', target, s });

// ---------------------------------------------------------------- ingredients

export const INGREDIENTS = [
  { id: 'wood', name: 'Wood', day: 1, theme: 'Ranged attacks, trees' },
  { id: 'stone', name: 'Stone', day: 1, theme: 'Shield' },
  { id: 'berry', name: 'Berry', day: 1, theme: 'Healing' },
  { id: 'bone', name: 'Bone', day: 1, theme: 'Undead, scaling' },
  { id: 'ember', name: 'Ember', day: 1, theme: 'Burn' },
  { id: 'coin', name: 'Coin', day: 1, theme: 'Gold' },
  { id: 'sand', name: 'Sand', day: 2, theme: 'Misses and desert creatures' },
  { id: 'mushroom', name: 'Mushroom', day: 3, theme: 'Poison spread, heal and poison hybrids' },
  { id: 'feather', name: 'Feather', day: 4, theme: 'Speed, haste, ignoring shield' },
  { id: 'crystal', name: 'Crystal', day: 5, theme: 'Freeze, magic, rare odds' },
  { id: 'moonstone', name: 'Moonstone', day: 7, theme: 'Low-HP payoffs, night creatures' },
];

// ---------------------------------------------------------------- units

const UNITS = [];
function U(id, name, tier, family, text, spec = {}) {
  UNITS.push({ id, name, tier, family, text, kind: 'unit', t: [], tags: [], ...spec });
}
const CREATURE = ['creature'];

// Base units
U('villager', 'Villager', 1, 'person', '2 damage every 2s', { t: [[2, dmg(2)]] });
U('wolf', 'Wolf', 1, 'wolf', '2 damage every 2s, +1 for each other wolf on your wall (max +2)', { t: [[2, dmg(2, { perAlly: { kin: 'wolf', n: 1, max: 2 } })]], tags: CREATURE });
U('scorpion', 'Scorpion', 1, 'scorpion', '1 poison every 3s', { t: [[3, poison(1)]], tags: CREATURE });
U('fairy', 'Fairy', 1, 'fairy', '2 heal every 2s', { t: [[2, heal(2)]] });

// Villager tree: tier 2
U('archer', 'Archer', 2, 'person', '3 damage every 1.2s. Hits twice while the enemy has no shield', { t: [[1.2, dmg(3, { twiceNoShield: true })]] });
U('guard', 'Guard', 2, 'person', '6 shield every 2s', { t: [[2, shield(6)]] });
U('healer', 'Healer', 2, 'person', '5 heal every 2s, +1 for each other unit that heals', { t: [[2, heal(5, { perAlly: { applies: 'heal', n: 1 } })]] });
U('fireMage', 'Fire Mage', 2, 'person', '4 burn every 2s', { t: [[2, burn(4)]] });
U('skeleton', 'Skeleton', 2, 'person', '3 damage every 2s. +1 damage permanently after each fight', { t: [[2, dmg(3)]], perm: 1 });
U('merchant', 'Merchant', 2, 'person', '1 damage every 2s. +2 gold per day', { t: [[2, dmg(1)]], gold: 2 });
U('hunter', 'Hunter', 2, 'person', '3 damage every 2s. +1 damage each time it hits this fight (max +6)', { t: [[2, dmg(3, { ramp: 6 })]] });
U('druid', 'Druid', 2, 'person', '3 heal and 1 poison every 3s', { t: [[3, heal(3), poison(1)]] });
U('scout', 'Scout', 2, 'person', '1 damage every 0.8s. Each hit sets back a random enemy unit by 0.2s', { t: [[0.8, dmg(1, { delay: { s: 0.2 } })]] });
U('mage', 'Mage', 2, 'person', '3 damage every 2s. Triple damage while the enemy has shield', { t: [[2, dmg(3, { vsShield: 3 })]] });

// Villager tree: tier 3
U('fireArcher', 'Fire Archer', 3, 'person', '3 damage every 1.2s. +3 damage while the enemy is burning', { t: [[1.2, dmg(3, { ifEnemy: ['burn', 3] })]] });
U('ranger', 'Ranger', 3, 'person', '6 damage every 1.5s. Double damage with an empty slot or wall edge beside it', { t: [[1.5, dmg(6, { edge: 2 })]] });
U('sharpshooter', 'Sharpshooter', 3, 'person', '5 damage every 1s. Every 4th shot deals triple', { t: [[1, dmg(5, { nth: 4, nthMult: 3 })]] });
U('frostArcher', 'Frost Archer', 3, 'person', '5 damage every 1.2s. Each hit freezes a random enemy unit for 0.6s', { t: [[1.2, dmg(5), freeze('random', 0.6)]] });
U('knight', 'Knight', 3, 'person', '5 damage and 5 shield every 2.5s. Both +1 per action this fight (max +4)', { t: [[2.5, dmg(5, { ramp: 4 }), shield(5, { ramp: 4 })]] });
U('paladin', 'Paladin', 3, 'person', '8 shield and 3 damage every 2.5s, then heals 1 per 4 shield you have', { t: [[2.5, shield(8), dmg(3), heal(0, { perShield: 4 })]], main: 'shield' });
U('spearman', 'Spearman', 3, 'person', '5 damage every 1.5s. Hits through shield: destroys 6 shield first', { t: [[1.5, special('breakShield', { n: 6 }), dmg(5)]], main: 'dmg' });
U('warden', 'Warden', 3, 'person', "8 shield every 2s. Your units can't be frozen while you have shield", { t: [[2, shield(8)]], warden: true });
U('shaman', 'Shaman', 3, 'person', '8 heal every 2.2s. Each heal gives a random friendly unit +1 to its main number', { t: [[2.2, heal(8), bless(1)]] });
U('alchemist', 'Alchemist', 3, 'person', 'Alternates 10 heal and 10 shield every 2s', { t: [[2, alt(heal(10), shield(10))]] });
U('oracle', 'Oracle', 3, 'person', '4 heal every 2s. Once per day, your next combine gets +20% rare odds', { t: [[2, heal(4)]], oracle: 20 });
U('pyromancer', 'Pyromancer', 3, 'person', '4 burn every 2.5s, +1 for each other friendly unit that applies burn', { t: [[2.5, burn(4, { perAlly: { applies: 'burn', n: 1 } })]] });
U('flameDancer', 'Flame Dancer', 3, 'person', '2 burn every 1.2s. Acts 25% faster while the enemy is burning', { t: [[1.2, burn(2)]], burningHaste: 0.25 });
U('ashCaller', 'Ash Caller', 3, 'person', '2 damage and 1 burn every 2s. +1 burn permanently after each fight', { t: [[2, dmg(2), burn(1)]], perm: 1, main: 'burn' });
U('necromancer', 'Necromancer', 3, 'person', '1 poison every 3s. Every 6s, summons a Skeleton into an empty slot (max 1). +1 poison permanently after each fight', { t: [[3, poison(1)], [6, summon('skeleton', 1)]], perm: 1 });
U('boneKnight', 'Bone Knight', 3, 'person', '3 damage and 4 shield every 2s. +1 shield permanently after each fight', { t: [[2, shield(4), dmg(3)]], perm: 1, main: 'shield' });
U('banker', 'Banker', 3, 'person', 'No attack. At day\'s end, +1 gold per 5 gold held (max +4)', { banker: true });
U('mercenary', 'Mercenary', 3, 'person', 'Every 2s, deals 2 damage plus 1 per 3 gold held', { t: [[2, dmg(2, { perGold: 3 })]] });
U('beastmaster', 'Beastmaster', 3, 'person', '4 damage every 2s. Your creatures get +25% haste', { t: [[2, dmg(4)]], creatureHaste: 0.25 });
U('trapper', 'Trapper', 3, 'person', '6 damage every 2s. Every 4s, freezes the enemy unit with the shortest cooldown for 1.5s', { t: [[2, dmg(6)], [4, freeze('fastest', 1.5)]] });
U('hexer', 'Hexer', 3, 'person', '1 poison every 3s. Whenever the enemy heals, they gain 2 poison', { t: [[3, poison(1)]], onEnemyHeal: [poison(2)] });
U('groveKeeper', 'Grove Keeper', 3, 'person', '5 heal every 2.5s. Heals 2 whenever a neighbour acts', { t: [[2.5, heal(5)]], onNeighbourAct: [heal(2)] });
U('sporeDruid', 'Spore Druid', 3, 'person', "Every 3s, adds poison equal to 20% of the enemy's current poison (min 1)", { t: [[3, poison(1, { pct: 0.2, min: 1 })]] });
U('windrunner', 'Windrunner', 3, 'person', '3 damage every 0.8s. All your units get +10% haste', { t: [[0.8, dmg(3)]], haste: 0.1 });
U('wolfRider', 'Wolf Rider', 3, 'wolf', '4 damage every 1.2s. Its first attack happens at once and deals triple', { t: [[1.2, dmg(4, { firstMult: 3 })]], firstStrike: true, tags: CREATURE });
U('iceMage', 'Ice Mage', 3, 'person', "5 damage every 2s. Freezes the enemy's highest-tier unit for 1.5s every 4s. Adds 2 Cold per action", { t: [[2, dmg(5), cold(2)], [4, freeze('top', 1.5), cold(2)]] });
U('stormMage', 'Storm Mage', 3, 'person', '2 damage every 0.5s. Each hit has a 15% chance to freeze a random enemy unit for 0.6s', { t: [[0.5, dmg(2), freeze('random', 0.6, { chance: 0.15 })]] });
U('warlock', 'Warlock', 3, 'person', 'Every 2s, pays 3 fortress HP to deal 10 damage', { t: [[2, special('pay', { hp: 3, dmg: 10 })]] });

// Villager tree: tier 4
U('champion', 'Champion', 4, 'person', '7 damage every 2.5s, +1 per 4 shield you have. 6 shield every 3s', { t: [[2.5, dmg(7, { perShield: 4 })], [3, shield(6)]] });
U('flameKnight', 'Flame Knight', 4, 'person', '5 damage and 2 burn every 2s, 5 shield every 2.5s', { t: [[2, dmg(5), burn(2)], [2.5, shield(5)]] });
U('infernoMage', 'Inferno Mage', 4, 'person', "5 burn every 3s, then the enemy's burn ticks once immediately", { t: [[3, burn(5), special('tickBurn')]] });
U('archmage', 'Archmage', 4, 'person', 'Freezes the 2 highest-tier enemy units for 1.5s every 4s. Every 2s, deals 2 damage plus 4 per frozen enemy unit', { t: [[2, dmg(2, { perFrozen: 4 })], [4, freeze('top2', 1.5)]] });
U('wraith', 'Wraith', 4, 'spirit', 'Every 3s, freezes the enemy unit that acted most recently for 1.5s', { t: [[3, freeze('last', 1.5)]] });
U('hawkeye', 'Hawkeye', 4, 'person', '10 damage every 2.5s, ignores shield. Double damage while the enemy is below 50%', { t: [[2.5, dmg(10, { pierce: true, execute: 2 })]] });

// Wolf tree
U('wolfPack', 'Wolf Pack', 2, 'wolf', 'Every 2s, bites once for each wolf on your wall (2 damage each, max 3 bites)', { t: [[2, special('pack', { n: 2, max: 3 })]], main: 'dmg', tags: CREATURE });
U('hellhound', 'Hellhound', 2, 'wolf', '3 damage and 1 burn every 2.5s. Damage +1 per 3 burn on the enemy', { t: [[2.5, dmg(3, { perEnemy: ['burn', 3] }), burn(1)]], tags: CREATURE });
U('direWolf', 'Dire Wolf', 2, 'wolf', '5 damage every 2.5s. Starts each fight with 10 shield', { t: [[2.5, dmg(5)]], startShield: 10, tags: CREATURE });
U('griffin', 'Griffin', 2, 'wolf', '5 damage every 1.5s, ignores shield', { t: [[1.5, dmg(5, { pierce: true })]], tags: CREATURE });
U('graveWolf', 'Grave Wolf', 2, 'wolf', '4 damage every 2s. +2 damage permanently after each fight you lose', { t: [[2, dmg(4)]], permLoss: 2, tags: CREATURE });
U('sandStalker', 'Sand Stalker', 2, 'wolf', '3 damage every 2.5s, +1 per 3 Sand on the enemy (max +4)', { t: [[2.5, dmg(3, { perEnemy: ['sand', 3, 4] })]], tags: CREATURE });
U('werewolf', 'Werewolf', 2, 'wolf', '5 damage every 2s. Double damage while your fortress is below 50%', { t: [[2, dmg(5)]], lowHp: { below: 0.5, mult: 2, k: 'dmg' }, tags: CREATURE });
U('alpha', 'Alpha', 3, 'wolf', '4 damage every 2s. Each time it attacks, your other wolves get +1 damage for the rest of the fight (max +3)', { t: [[2, dmg(4), special('rally', { kin: 'wolf', n: 1, max: 3 })]], tags: CREATURE });
U('cerberus', 'Cerberus', 3, 'wolf', 'Every 3s, attacks 3 times for 4 damage and 1 burn each', { t: [[3, dmg(4), burn(1), dmg(4), burn(1), dmg(4), burn(1)]], tags: CREATURE });
U('frostWolf', 'Frost Wolf', 3, 'wolf', '6 damage every 2s. Each hit freezes a random enemy unit for 0.6s', { t: [[2, dmg(6), freeze('random', 0.6)]], tags: CREATURE });
U('skyGriffin', 'Sky Griffin', 3, 'wolf', 'Every 3s, dives for 3 hits of 4 damage, ignoring shield', { t: [[3, dmg(4, { hits: 3, pierce: true })]], tags: CREATURE });
U('boneHound', 'Bone Hound', 3, 'wolf', '3 damage every 1.5s, +1 per other wolf (max +2). +1 damage permanently after each fight', { t: [[1.5, dmg(3, { perAlly: { kin: 'wolf', n: 1, max: 2 } })]], perm: 1, tags: CREATURE });
U('desertStalker', 'Desert Stalker', 3, 'wolf', '5 damage every 3s, plus 1 poison per 3 Sand on the enemy (max 4)', { t: [[3, dmg(5), poison(0, { perEnemy: ['sand', 3, 4] })]], tags: CREATURE });
U('moonhowler', 'Moonhowler', 3, 'wolf', '5 damage every 1.5s. While below 50%, your creatures get +35% haste', { t: [[1.5, dmg(5)]], lowCreatureHaste: 0.35, tags: CREATURE });

// Scorpion tree
U('scorpionSwarm', 'Scorpion Swarm', 2, 'scorpion', '1 poison every 2s, +1 per other scorpion on your wall (max +1)', { t: [[2, poison(1, { perAlly: { kin: 'scorpion', n: 1, max: 1 } })]], tags: CREATURE });
U('deathstalker', 'Deathstalker', 2, 'scorpion', "2 poison every 3.5s. Each sting freezes the enemy's highest-tier unit for 0.5s", { t: [[3.5, poison(2), freeze('top', 0.5)]], tags: CREATURE });
U('fireScorpion', 'Fire Scorpion', 2, 'scorpion', '1 poison and 2 burn every 3s', { t: [[3, poison(1), burn(2)]], tags: CREATURE });
U('armoredScorpion', 'Armored Scorpion', 2, 'scorpion', '1 poison every 3s and 5 shield every 2.5s', { t: [[3, poison(1)], [2.5, shield(5)]], tags: CREATURE });
U('sporeScorpion', 'Spore Scorpion', 2, 'scorpion', '1 poison every 2.5s. Each hit adds +1 more per 10 poison the enemy has', { t: [[2.5, poison(1, { per10: 1 })]], tags: CREATURE });
U('nightScorpion', 'Night Scorpion', 2, 'scorpion', '1 poison every 3s, +1 per 15 HP your fortress is missing', { t: [[3, poison(1, { perMissing: 15 })]], tags: CREATURE });
U('scorpionNest', 'Scorpion Nest', 3, 'scorpion', '2 poison every 1.8s. When it acts, summons a Scorpion into an empty slot (max 2 per fight)', { t: [[1.8, poison(2), summon('scorpion', 2)]], tags: CREATURE });
U('tombStalker', 'Tomb Stalker', 3, 'scorpion', '2 poison every 3s. +1 poison permanently after each fight you win', { t: [[3, poison(2)]], permWin: 1, tags: CREATURE });
U('lavaScorpion', 'Lava Scorpion', 3, 'scorpion', '2 poison every 3s, plus 1 burn per 3 poison on the enemy', { t: [[3, poison(2), burn(0, { perEnemy: ['poison', 3] })]], tags: CREATURE });
U('shellScorpion', 'Shell Scorpion', 3, 'scorpion', '8 shield every 3s. Whenever an enemy hits your shield, they gain 1 poison', { t: [[3, shield(8)]], onShieldHit: [poison(1)], tags: CREATURE });
U('fungalNest', 'Fungal Nest', 3, 'scorpion', '1 poison every 2s. Every time enemy poison ticks, adds 1 more', { t: [[2, poison(1)]], onEnemyPoisonTick: [poison(1)], tags: CREATURE });

// Fairy tree
U('fairyRing', 'Fairy Ring', 2, 'fairy', 'Bless a random friendly unit every 1.5s', { t: [[1.5, bless(1)]] });
U('dryad', 'Dryad', 2, 'fairy', '4 heal every 1.5s. Each heal also gives 2 shield', { t: [[1.5, heal(4, { shieldToo: 2 })]] });
U('treant', 'Treant', 2, 'fairy', '7 shield and 3 heal every 2.5s', { t: [[2.5, shield(7), heal(3)]] });
U('wisp', 'Wisp', 2, 'fairy', '3 burn every 2s. Freezes a random enemy unit for 1s every 4s', { t: [[2, burn(3)], [4, freeze('random', 1)]] });
U('pixie', 'Pixie', 2, 'fairy', '2 heal every 2s. Every 2s, charges a random friendly unit 0.4s', { t: [[2, heal(2), charge('random', 0.4)]] });
U('frostFairy', 'Frost Fairy', 2, 'fairy', "3 heal every 3s. Freezes the enemy's highest-tier unit for 1.5s every 4s and deals 3 damage", { t: [[3, heal(3)], [4, freeze('top', 1.5), cold(1), dmg(3)]] });
U('sporeFairy', 'Spore Fairy', 2, 'fairy', 'Whenever you heal, the enemy gains 1 poison', { onHeal: [poison(1, { trigger: true })] });
U('luckyFairy', 'Lucky Fairy', 2, 'fairy', '2 heal every 2s. +4 Luck at fight start. +5% rare odds while you own it', { t: [[2, heal(2)]], startLuck: 4, rareOdds: 5 });
U('moonFairy', 'Moon Fairy', 2, 'fairy', '3 heal every 2s. Triple heal while your fortress is below 30%', { t: [[2, heal(3)]], lowHp: { below: 0.3, mult: 3, k: 'heal' } });
U('fairyCourt', 'Fairy Court', 3, 'fairy', 'Bless a random friendly unit every 1s. Every 5th Bless also gives +1 Luck', { t: [[1, bless(1, { luckEvery: 5 })]] });
U('groveSpirit', 'Grove Spirit', 3, 'fairy', '6 heal and 2 damage every 1.5s. +1 heal permanently after each fight you win', { t: [[1.5, heal(6), dmg(2)]], permWin: 1, main: 'heal' });
U('elderTreant', 'Elder Treant', 3, 'fairy', 'Every 2.5s, gains 4 shield plus 1 per 10 HP your fortress is missing, and heals 2', { t: [[2.5, special('bark', { n: 4, frac: 0.1 }), heal(2)]], main: 'shield' });
U('willOWisp', 'Will-o\'-Wisp', 3, 'fairy', 'Every 3s, freezes a random enemy unit for 1.5s and burns the enemy for twice its tier', { t: [[3, special('wisp')]] });
U('windSprite', 'Wind Sprite', 3, 'fairy', '2 damage every 1s. Your units get +8% haste for each empty wall slot', { t: [[1, dmg(2)]], emptyHaste: 0.08 });
U('sylph', 'Sylph', 3, 'fairy', '2 heal every 1.5s and charges a random friendly unit 0.3s', { t: [[1.5, heal(2), charge('random', 0.3)]] });
U('myconid', 'Myconid', 3, 'fairy', "1 poison every 3s. Every 3s, heals you for half the enemy's poison", { t: [[3, poison(1), special('myco')]] });
U('fortuneFairy', 'Fortune Fairy', 3, 'fairy', '+8 Luck at fight start. +5% rare odds while owned. +1 gold per day', { startLuck: 8, rareOdds: 5, gold: 1 });
U('snowQueen', 'Snow Queen', 3, 'fairy', 'Freezes the 2 highest-tier enemy units for 1.5s every 4s. Every 2s, deals 4 damage per frozen enemy unit', { t: [[4, freeze('top2', 1.5), cold(1)], [2, dmg(0, { perFrozen: 4 })]], main: 'dmg' });

// Shop track units. Track packs only hold tier-1 base creatures and ingredients;
// each base has its own upgrade routes, so a new pack means new directions, not bigger numbers.
const TRACK = { track: true };
const FIRE_FOOD = ['ember', 'wood'];
const BOG_FOOD = ['mushroom', 'bone'];
const BOG = (evolve) => ({ foods: BOG_FOOD, per: 2, ...(evolve ? { evolve } : {}) });
const GROVE_FOOD = ['berry', 'wood'];
const GOLD_FOOD = ['coin'];

// Flame
U('flameImp', 'Flame Imp', 1, 'spirit', '2 burn every 2.4s. Its first cast happens at once', { ...TRACK, t: [[2.4, burn(2)]], firstStrike: true });
U('salamander', 'Salamander', 1, 'wolf', '1 burn every 1.5s. +1 burn per hit this fight (max +4)', { ...TRACK, t: [[1.5, burn(1, { ramp: 4 })]], tags: CREATURE });
U('cinderMaw', 'Cinder Maw', 1, 'spirit', '2 burn every 2.5s, +1 per meal eaten. Eats Ember or Wood. Evolves after 5 meals', { ...TRACK, t: [[2.5, burn(2)]], eats: { foods: FIRE_FOOD, evolve: [5, 'cinderWyrm'] } });
U('cinderWyrm', 'Cinder Wyrm', 3, 'spirit', '2 burn every 1.8s, +1 per meal eaten. Eats Ember or Wood. Evolves after 12 meals', { ...TRACK, t: [[1.8, burn(2)]], eats: { foods: FIRE_FOOD, evolve: [12, 'emberLeviathan'] } });
U('emberLeviathan', 'Ember Leviathan', 4, 'spirit', '2 burn every 1.4s, +1 per meal eaten. At fight start the enemy gains burn equal to its meals. Still eats Ember or Wood', { ...TRACK, t: [[1.4, burn(2)]], eats: { foods: FIRE_FOOD }, startEnemy: { k: 'burn', perMeal: 1 } });
U('ashMoth', 'Ash Moth', 1, 'fairy', '2 damage every 1.5s. +1 damage per 5 burn on the enemy', { ...TRACK, t: [[1.5, dmg(2, { perEnemy: ['burn', 5] })]] });
U('hellImp', 'Hell Imp', 2, 'spirit', '2 burn every 1.8s, +1 per other spirit on your wall', { ...TRACK, t: [[1.8, burn(2, { perAlly: { family: 'spirit', n: 1 } })]] });
U('torchbearer', 'Torchbearer', 2, 'person', "2 damage and 1 burn every 1.5s. Neighbours' burn +1", { ...TRACK, t: [[1.5, dmg(2), burn(1)]], aura: { k: 'burn', n: 1 }, main: 'burn' });
U('sparkSprite', 'Spark Sprite', 2, 'fairy', '1 burn every 1s. Charges its neighbours 0.3s each time it acts', { ...TRACK, t: [[1, burn(1), charge('neighbours', 0.3)]] });
U('smokeImp', 'Smoke Imp', 2, 'spirit', '2 burn every 1.8s. Adds 1 poison too while the enemy is already poisoned', { ...TRACK, t: [[1.8, burn(2), poison(0, { ifEnemy: ['poison', 1] })]] });
U('fireElemental', 'Fire Elemental', 3, 'spirit', "4 burn every 2s. Can't be frozen or slowed by Cold", { ...TRACK, t: [[2, burn(4)]], noFreeze: true, noCold: true });
U('lavaGolem', 'Lava Golem', 3, 'golem', '8 shield every 2.5s. While you have shield, the enemy gains 1 burn every 1s', { ...TRACK, t: [[2.5, shield(8)], [1, burn(1, { ifShield: true })]] });
U('beacon', 'Beacon', 3, 'thing', "3 damage and 2 burn every 1.5s. Neighbours' burn +2", { ...TRACK, t: [[1.5, dmg(3), burn(2)]], aura: { k: 'burn', n: 2 }, main: 'burn' });
U('smogElemental', 'Smog Elemental', 3, 'spirit', '1 poison every 2.2s, plus 2 burn and +1 burn per 2 poison on the enemy', { ...TRACK, t: [[2.2, poison(1), burn(2, { perEnemy: ['poison', 2] })]] });
U('magmaSalamander', 'Magma Salamander', 2, 'wolf', '1 burn every 1.5s, +1 per hit this fight (max +6). Starts each fight with 8 shield', { ...TRACK, t: [[1.5, burn(1, { ramp: 6 })]], startShield: 8, tags: CREATURE });
U('toxicNewt', 'Toxic Newt', 2, 'wolf', '1 burn and 1 poison every 1.8s. Both +1 per hit this fight (max +3)', { ...TRACK, t: [[1.8, burn(1, { ramp: 3 }), poison(1, { ramp: 3 })]], tags: CREATURE });
U('firedrake', 'Firedrake', 2, 'wolf', '2 damage and 1 burn every 1.5s. Both +1 per hit this fight (max +3)', { ...TRACK, t: [[1.5, dmg(2, { ramp: 3 }), burn(1, { ramp: 3 })]], tags: CREATURE });
U('drakeMatriarch', 'Drake Matriarch', 3, 'wolf', '3 burn every 2s. Each cast gives your other drakes +1 to their main number for the fight (max +4)', { ...TRACK, t: [[2, burn(3), special('rally', { kin: 'drake', n: 1, max: 4 })]], tags: CREATURE });
U('cinderHawk', 'Cinder Hawk', 2, 'fairy', '3 damage every 1s. +1 damage per 5 burn on the enemy', { ...TRACK, t: [[1, dmg(3, { perEnemy: ['burn', 5] })]] });
U('pyreMoth', 'Pyre Moth', 3, 'fairy', '3 damage and 1 burn every 1s. +1 damage per 4 burn on the enemy', { ...TRACK, t: [[1, dmg(3, { perEnemy: ['burn', 4] }), burn(1)]] });
U('pyreKeeper', 'Pyre Keeper', 3, 'person', "Every 4s, deals damage equal to the enemy's burn (the burn stays)", { ...TRACK, t: [[4, special('detonate', { kind: 'burn' })]] });

// Tomb
U('ghoul', 'Ghoul', 1, 'spirit', '2 damage every 2s. Each hit heals you 1', { ...TRACK, t: [[2, dmg(2, { lifesteal: 1 })]] });
U('mummy', 'Mummy', 1, 'spirit', '1 poison and 4 shield every 4s', { ...TRACK, t: [[4, poison(1), shield(4)]] });
U('bogMaw', 'Bog Maw', 1, 'scorpion', '1 poison every 3s, +1 per 2 meals eaten. Eats Mushroom or Bone. Evolves after 5 meals', { ...TRACK, t: [[3, poison(1)]], eats: BOG([5, 'bogHulk']), tags: CREATURE });
U('bogHulk', 'Bog Hulk', 3, 'scorpion', '1 poison every 2.4s, +1 per 2 meals eaten. Eats Mushroom or Bone. Evolves after 12 meals', { ...TRACK, t: [[2.4, poison(1)]], eats: BOG([12, 'swampTitan']), tags: CREATURE });
U('swampTitan', 'Swamp Titan', 4, 'scorpion', '1 poison every 2s, +1 per 2 meals eaten. At fight start the enemy gains poison equal to half its meals. Still eats Mushroom or Bone', { ...TRACK, t: [[2, poison(1)]], eats: BOG(), startEnemy: { k: 'poison', perMeal: 0.5 }, tags: CREATURE });
U('plagueRat', 'Plague Rat', 1, 'wolf', '1 poison every 2s, +1 per other rat on your wall (max +2)', { ...TRACK, t: [[2, poison(1, { perAlly: { kin: 'rat', n: 1, max: 2 } })]], tags: CREATURE });
U('ghast', 'Ghast', 2, 'spirit', '3 damage every 1.5s. Each hit heals you 2', { ...TRACK, t: [[1.5, dmg(3, { lifesteal: 2 })]] });
U('corpseEater', 'Corpse Eater', 2, 'spirit', '3 damage and 1 poison every 2s. Each hit heals you 1', { ...TRACK, t: [[2, dmg(3, { lifesteal: 1 }), poison(1)]] });
U('boneGolem', 'Bone Golem', 2, 'golem', '8 shield every 3s. +2 shield permanently after each fight', { ...TRACK, t: [[3, shield(8)]], perm: 2 });
U('sandMummy', 'Sand Mummy', 2, 'spirit', '2 poison, 2 Sand and 4 shield every 4s', { ...TRACK, t: [[4, poison(2), sand(2), shield(4)]] });
U('pharaoh', 'Pharaoh', 3, 'spirit', '3 poison, 2 Sand and 8 shield every 4s. +1 gold per day', { ...TRACK, t: [[4, poison(3), sand(2), shield(8)]], gold: 1 });
U('ratKing', 'Rat King', 2, 'wolf', '1 poison every 2s. Every 4s, summons a Plague Rat into an empty slot (max 2)', { ...TRACK, t: [[2, poison(1)], [4, summon('plagueRat', 2)]], tags: CREATURE });
U('plagueDoctor', 'Plague Doctor', 2, 'person', '2 heal every 2s. Every 3s, turns up to 4 enemy burn into 3 poison', { ...TRACK, t: [[2, heal(2)], [3, special('convert', { take: 4, give: 3 })]] });
U('blightRat', 'Blight Rat', 2, 'wolf', '1 poison and 1 Cold every 1.5s', { ...TRACK, t: [[1.5, poison(1), cold(1)]], tags: CREATURE });
U('fester', 'Fester', 3, 'spirit', "Every 5s, deals damage equal to the enemy's poison, ignoring shield (the poison stays)", { ...TRACK, t: [[5, special('detonate', { kind: 'poison' })]] });

// Grove
U('stag', 'Stag', 1, 'wolf', '3 damage every 1.8s. Its first charge happens at once', { ...TRACK, t: [[1.8, dmg(3)]], firstStrike: true, tags: CREATURE });
U('thornbush', 'Thornbush', 1, 'fairy', '4 shield every 3s. Each enemy hit on your shield deals 1 back', { ...TRACK, t: [[3, shield(4)]], thorns: 1 });
U('sapling', 'Sapling', 1, 'fairy', '2 heal every 2.5s, +1 per meal eaten. Eats Berry or Wood. Evolves after 5 meals', { ...TRACK, t: [[2.5, heal(2)]], eats: { foods: GROVE_FOOD, evolve: [5, 'oakheart'] } });
U('oakheart', 'Oakheart', 3, 'fairy', '2 heal and 4 shield every 2.5s, heal +1 per meal eaten. Eats Berry or Wood. Evolves after 12 meals', { ...TRACK, t: [[2.5, heal(2), shield(4)]], eats: { foods: GROVE_FOOD, evolve: [12, 'worldTree'] } });
U('worldTree', 'World Tree', 4, 'fairy', '2 heal and 6 shield every 2s, heal +1 per meal eaten. Healing past full HP becomes shield. Still eats Berry or Wood', { ...TRACK, t: [[2, heal(2), shield(6)]], eats: { foods: GROVE_FOOD }, overheal: true });
U('vineling', 'Vineling', 1, 'fairy', '2 heal every 2s. Neighbours act 15% faster', { ...TRACK, t: [[2, heal(2)]], auraHaste: 0.15 });
U('unicorn', 'Unicorn', 2, 'wolf', '3 damage and 3 heal every 2s', { ...TRACK, t: [[2, dmg(3), heal(3)]], tags: CREATURE });
U('elkHerd', 'Elk Herd', 2, 'wolf', '3 damage every 1s, but only while your fortress is healthier than the enemy\'s (by %)', { ...TRACK, t: [[1, dmg(3)]], ahead: true, tags: CREATURE });
U('antlerGuard', 'Antler Guard', 2, 'wolf', '3 damage every 2s and 4 shield every 2.5s. +1 damage whenever your shield is hit (max +6)', { ...TRACK, t: [[2, dmg(3)], [2.5, shield(4)]], onShieldHit: [special('selfBonus', { max: 6 })], tags: CREATURE });
U('greatStag', 'Great Stag', 3, 'wolf', "5 damage every 1.5s. Each hit sets back the enemy's slowest unit by 0.6s", { ...TRACK, t: [[1.5, dmg(5, { delay: { target: 'slowest', s: 0.6 } })]], tags: CREATURE });
U('briarWall', 'Briar Wall', 2, 'fairy', '8 shield every 3s. Each enemy hit on your shield deals 2 back', { ...TRACK, t: [[3, shield(8)]], thorns: 2 });
U('rosebush', 'Rosebush', 2, 'fairy', '4 shield every 3s. Heals 1 whenever an enemy hits your shield', { ...TRACK, t: [[3, shield(4)]], onShieldHit: [heal(1)] });
U('ancientTree', 'Ancient Tree', 3, 'fairy', '12 shield and 6 heal every 3s. Each enemy hit on your shield deals 2 back', { ...TRACK, t: [[3, shield(12), heal(6)]], thorns: 2 });
U('bloomVine', 'Bloom Vine', 2, 'fairy', '2 heal every 2s. Neighbours act 15% faster and start each fight with +1 to their main number', { ...TRACK, t: [[2, heal(2)]], auraHaste: 0.15, startNeighbourBonus: 1 });

// Caravan
U('camel', 'Camel', 1, 'wolf', 'No attack. +1 shop slot', { ...TRACK, shopSlot: 1, tags: CREATURE });
U('trader', 'Trader', 1, 'person', '2 damage every 2s. Selling a card gives +1 gold', { ...TRACK, t: [[2, dmg(2)]], sellBonus: 1 });
U('treasureChest', 'Treasure Chest', 1, 'thing', 'No attack. Sells for 3 gold plus 1 per day owned (max 10)', { ...TRACK, chest: true });
U('goldbug', 'Goldbug', 1, 'scorpion', '1 damage every 1.5s, +1 per meal eaten. Eats Coin. Evolves after 5 meals', { ...TRACK, t: [[1.5, dmg(1)]], eats: { foods: GOLD_FOOD, evolve: [5, 'gildedBeetle'] }, tags: CREATURE });
U('gildedBeetle', 'Gilded Beetle', 3, 'scorpion', '1 damage every 1.1s, +1 per meal eaten. Eats Coin. Evolves after 12 meals', { ...TRACK, t: [[1.1, dmg(1)]], eats: { foods: GOLD_FOOD, evolve: [12, 'midasScarab'] }, tags: CREATURE });
U('midasScarab', 'Midas Scarab', 4, 'scorpion', '1 damage every 0.9s, +1 per meal eaten. +2 gold per day. Still eats Coin', { ...TRACK, t: [[0.9, dmg(1)]], eats: { foods: GOLD_FOOD }, gold: 2, tags: CREATURE });
U('goldGolem', 'Gold Golem', 2, 'golem', 'Every 2.5s, deals 3 damage plus 1 per 4 gold held', { ...TRACK, t: [[2.5, dmg(3, { perGold: 4 })]] });
U('caravanGuard', 'Caravan Guard', 2, 'wolf', '6 shield every 2.5s. +1 shop slot', { ...TRACK, t: [[2.5, shield(6)]], shopSlot: 1, tags: CREATURE });
U('spiceTrader', 'Spice Trader', 2, 'person', '2 damage and 2 burn every 2s. Selling a card gives +1 gold', { ...TRACK, t: [[2, dmg(2), burn(2)]], sellBonus: 1 });
U('mimic', 'Mimic', 2, 'thing', 'Every 3s, deals 2 damage plus 1 per day owned (max +8)', { ...TRACK, t: [[3, dmg(2, { perOwned: 8 })]] });

// Forge
U('golem', 'Golem', 1, 'golem', "5 shield every 3s. Can't be frozen", { ...TRACK, t: [[3, shield(5)]], noFreeze: true });
U('catapult', 'Catapult', 1, 'thing', '4 damage every 4s, +1 per day', { ...TRACK, t: [[4, dmg(4, { perDay: 1 })]] });
U('smith', 'Smith', 1, 'person', '1 damage every 2s. Neighbours deal +1 damage', { ...TRACK, t: [[2, dmg(1)]], aura: { k: 'dmg', n: 1 } });
U('clockwork', 'Clockwork', 1, 'golem', '1 damage every 0.8s. Every 5th hit deals 5', { ...TRACK, t: [[0.8, dmg(1, { nth: 5, nthMult: 5 })]] });
U('ironGolem', 'Iron Golem', 2, 'golem', '9 shield every 3s. Each enemy hit on your shield deals 1 back', { ...TRACK, t: [[3, shield(9)]], thorns: 1 });
U('siegeTower', 'Siege Tower', 2, 'thing', 'Every 2.5s, destroys up to 10 enemy shield, then deals 4 damage', { ...TRACK, t: [[2.5, special('breakShield', { n: 10 }), dmg(4)]], main: 'dmg' });
U('fireCatapult', 'Fire Catapult', 2, 'thing', '6 damage and 3 burn every 4s', { ...TRACK, t: [[4, dmg(6), burn(3)]] });
U('trebuchet', 'Trebuchet', 3, 'thing', '16 damage every 4s, ignores shield', { ...TRACK, t: [[4, dmg(16, { pierce: true })]] });
U('masterSmith', 'Master Smith', 2, 'person', '2 damage every 2s. Neighbours deal +2 damage', { ...TRACK, t: [[2, dmg(2)]], aura: { k: 'dmg', n: 2 } });
U('runesmith', 'Runesmith', 3, 'person', '2 damage every 2s. Neighbours deal +2 damage and act 15% faster', { ...TRACK, t: [[2, dmg(2)]], aura: { k: 'dmg', n: 2 }, auraHaste: 0.15 });
U('clockworkKnight', 'Clockwork Knight', 2, 'golem', '1 damage every 0.7s. Each hit gives you 1 shield', { ...TRACK, t: [[0.7, dmg(1, { shieldGain: 1 })]] });
U('gearstorm', 'Gearstorm', 2, 'golem', '1 damage every 0.7s. Gets 4% faster with every hit (max +60%)', { ...TRACK, t: [[0.7, dmg(1)]], accel: { per: 0.04, max: 0.6 } });

// Side-grades across the base trees
U('nightWatch', 'Night Watch', 2, 'person', '3 shield every 2s. Whenever your fortress takes a hit of 6 or more, deals 4 damage back', { t: [[2, shield(3)]], onBigHit: { min: 6, acts: [dmg(4)] } });
U('boneArcher', 'Bone Archer', 3, 'person', '3 damage every 1.4s. +2 damage permanently after each fight you win', { t: [[1.4, dmg(3)]], permWin: 2 });
U('venomArcher', 'Venom Archer', 3, 'person', '2 damage every 1.5s, +1 per 4 poison on the enemy', { t: [[1.5, dmg(2, { perEnemy: ['poison', 4] })]] });
U('smokeweaver', 'Smokeweaver', 3, 'person', '2 burn every 2s. Each time enemy burn ticks, adds 1 poison', { t: [[2, burn(2)]], onEnemyBurnTick: [poison(1)] });
U('braziarGuard', 'Brazier Guard', 3, 'person', '5 shield every 2.5s. Whenever an enemy hits your shield, they gain 1 burn', { t: [[2.5, shield(5)]], onShieldHit: [burn(1)] });
U('herbalist', 'Herbalist', 3, 'person', '3 heal every 2s, +1 per 3 poison on the enemy', { t: [[2, heal(3, { perEnemy: ['poison', 3] })]] });
U('plagueSkeleton', 'Plague Skeleton', 3, 'person', '2 damage and 1 poison every 2s. +1 poison permanently after each fight', { t: [[2, dmg(2), poison(1)]], perm: 1, main: 'poison' });
U('rabidWolf', 'Rabid Wolf', 2, 'wolf', '2 damage and 1 poison every 2.5s. Its poison grows by 1 each bite (max +4)', { t: [[2.5, dmg(2), poison(1, { ramp: 4 })]], tags: CREATURE });
U('wasp', 'Wasp', 2, 'scorpion', '1 poison every 1s. Every 4th sting is triple', { t: [[1, poison(1, { nth: 4, nthMult: 3 })]], tags: CREATURE });
U('banshee', 'Banshee', 2, 'fairy', '2 heal every 2s. Freezes a random enemy unit for 0.6s every 3s', { t: [[2, heal(2)], [3, freeze('random', 0.6)]] });
U('kilnSpirit', 'Kiln Spirit', 3, 'spirit', 'Gains 1 Heat whenever a neighbour acts', { onNeighbourAct: [heat(1)] });

// Engines
U('wishSprite', 'Wish Sprite', 3, 'fairy', 'Every 2s, Bless a random friendly unit and charge it 0.5s', { t: [[2, bless(1, { charge: 0.5 })]] });
U('cloverSprite', 'Clover Sprite', 3, 'fairy', '3 heal and 2 damage every 2s. Whenever you crit, heal 3', { t: [[2, heal(3), dmg(2)]], onCrit: [heal(3)], main: 'heal' });
U('gambler', 'Gambler', 3, 'person', '5 damage every 1.5s. Whenever you crit, +1 Luck', { t: [[1.5, dmg(5)]], onCrit: [luck(1)] });
U('rogue', 'Rogue', 3, 'person', '3 damage every 0.6s. Its crits deal triple instead of double', { t: [[0.6, dmg(3)]], critMult: 3 });
U('crystalFairy', 'Crystal Fairy', 3, 'fairy', '3 heal every 2s. +7 Luck at fight start', { t: [[2, heal(3)]], startLuck: 7 });
U('sandcaster', 'Sandcaster', 2, 'person', '3 damage and 2 Sand every 2s', { t: [[2, dmg(3), sand(2)]] });
U('jackal', 'Jackal', 2, 'wolf', '4 damage every 1.5s. Each hit adds 1 Sand', { t: [[1.5, dmg(4, { sandOnHit: 1 })]], tags: CREATURE });
U('sandScorpion', 'Sand Scorpion', 2, 'scorpion', '1 poison and 2 Sand every 2.5s', { t: [[2.5, poison(1), sand(2)]], tags: CREATURE });
U('dustSprite', 'Dust Sprite', 2, 'fairy', '3 Sand every 2.5s', { t: [[2.5, sand(3)]] });
U('duneGuard', 'Dune Guard', 3, 'person', '6 shield and 2 Sand every 2s. Whenever an enemy action misses, gain 3 shield', { t: [[2, shield(6), sand(2)]], onEnemyMiss: [shield(3)] });
U('stormCaller', 'Storm Caller', 3, 'person', 'Every 3s, adds 5 Sand, then deals 1 damage per 2 Sand on the enemy (max 10)', { t: [[3, sand(5), dmg(0, { perEnemy: ['sand', 2, 10] })]], main: 'sand' });
U('mirage', 'Mirage', 3, 'fairy', '4 damage and 1 Sand every 1.5s. Whenever an enemy action misses, charge a random friendly unit 0.8s', { t: [[1.5, dmg(4), sand(1)]], onEnemyMiss: [charge('random', 0.8)] });
U('duneStalker', 'Dune Stalker', 3, 'scorpion', '2 poison and 2 Sand every 2.5s. Poison +1 per 4 Sand on the enemy (max +3)', { t: [[2.5, poison(2, { perEnemy: ['sand', 4, 3] }), sand(2)]], tags: CREATURE });
U('bonfireKeeper', 'Bonfire Keeper', 3, 'person', '2 burn every 2s. Gain 2 Heat each time it acts', { t: [[2, burn(2), heat(2)]] });
U('hearthSpirit', 'Hearth Spirit', 3, 'spirit', 'Whenever enemy burn ticks, gain 1 Heat', { onEnemyBurnTick: [heat(1)] });
U('furnace', 'Furnace', 3, 'golem', 'Every 2s, gain 2 Heat. At 20+ Heat, spends 10 to deal 30 damage', { t: [[2, heat(2), special('furnace')]] });
U('shatterGolem', 'Shatter Golem', 4, 'golem', '6 shield every 3s. Whenever an enemy unit is frozen, deal 6 damage', { t: [[3, shield(6)]], onFreeze: [dmg(6, { trigger: true })] });
U('frostWraith', 'Frost Wraith', 4, 'spirit', 'Freezes a random enemy unit for 1s every 2.5s', { t: [[2.5, freeze('random', 1)]] });
U('venomDrinker', 'Venom Drinker', 4, 'person', 'Every 3s, poisons your own fortress by 2. Your units deal +1 damage per poison on you (max +5)', { t: [[3, special('selfPoison', { n: 2 })]], venom: 5 });
U('treasureGolem', 'Treasure Golem', 4, 'golem', 'Once per fight, at 8s, deals damage equal to double your gold', { once: [8, dmg(0, { goldMult: 2 })] });
U('mirror', 'Mirror', 4, 'thing', "Copies its left neighbour's effect at 75% strength", { mirror: 0.75 });
U('denMother', 'Den Mother', 3, 'wolf', '2 heal every 2s. Every 4s, summons a Wolf into an empty slot', { t: [[2, heal(2)], [4, summon('wolf', 6)]], tags: CREATURE });
U('bulwark', 'Bulwark', 4, 'person', 'Every 3s, deals damage equal to half your current shield', { t: [[3, dmg(0, { shieldFrac: 0.5 })]] });
U('ashborn', 'Ashborn', 4, 'spirit', '2 burn every 2s. Once per fight, when your fortress would hit 0, spends all Heat to revive with 4 HP per Heat', { t: [[2, burn(2)]], ashborn: 4 });
U('glassmaker', 'Glassmaker', 3, 'person', 'Every 3s, removes 4 Sand from the enemy to gain 12 shield and deal 6 damage', { t: [[3, special('glass'), dmg(6)]], main: 'dmg' });
U('wishingWell', 'Wishing Well', 3, 'thing', 'Every 4s, spends 3 Luck to Bless 4 times', { t: [[4, special('well')]] });
U('highRoller', 'High Roller', 4, 'person', '8 damage every 2s. Every 5s, spends 5 Luck so its next hit crits for triple', { t: [[2, dmg(8)], [5, special('prime')]] });
U('juggernaut', 'Juggernaut', 4, 'person', '4 shield every 2s. Every 5s, spends all your shield to deal that much damage', { t: [[2, shield(4)], [5, dmg(0, { spendShield: true })]] });
U('sunSprite', 'Sun Sprite', 3, 'fairy', '4 heal every 1.5s. Whenever you heal, deal 3 damage', { t: [[1.5, heal(4)]], onHeal: [dmg(3, { trigger: true })] });
U('sunShaman', 'Sun Shaman', 4, 'person', 'Every 4s, deals damage equal to half the healing you did in the last 4s', { t: [[4, dmg(0, { healFrac: 0.5 })]] });
U('oasisSpirit', 'Oasis Spirit', 4, 'fairy', '7 heal every 1.5s. Healing past full HP becomes shield', { t: [[1.5, heal(7)]], overheal: true });

// Rares
const RARE = { rare: true };
U('darkKnight', 'Dark Knight', 4, 'person', '6 damage every 2s. +1 damage per 8 missing fortress HP', { ...RARE, t: [[2, dmg(6, { perMissing: 8 })]] });
U('deathKnight', 'Death Knight', 4, 'person', "Dark Knight's effect, and each hit also applies 1 poison", { ...RARE, t: [[2, dmg(6, { perMissing: 10 }), poison(1)]] });
U('witch', 'Witch', 4, 'person', "2 poison every 3s. Every 6s, the enemy's poison ticks one extra time", { ...RARE, t: [[3, poison(2)], [6, special('witch')]] });
U('lich', 'Lich', 4, 'spirit', "3 poison every 3s. Every 5s, completes a neighbour's cooldown instantly", { ...RARE, t: [[3, poison(3)], [5, special('lich')]] });
U('roc', 'Roc', 4, 'wolf', '6 damage every 1.5s, ignores shield. Once per fight, when your fortress would hit 0, it revives at 20% HP', { ...RARE, t: [[1.5, dmg(6, { pierce: true })]], revive: 0.2, tags: CREATURE });
U('manticore', 'Manticore', 4, 'wolf', '8 damage and 2 poison every 2s', { ...RARE, t: [[2, dmg(8), poison(2)]], tags: CREATURE });
U('scorpionQueen', 'Scorpion Queen', 4, 'scorpion', '1 poison every 1.5s. All your poison applications get +1', { ...RARE, t: [[1.5, poison(1)]], queen: 1, tags: CREATURE });
U('djinn', 'Djinn', 4, 'spirit', 'Every 3s, copies the effect of a random friendly unit (never another Djinn)', { ...RARE, t: [[3, special('djinn')]] });
U('ifrit', 'Ifrit', 4, 'spirit', "6 burn every 3s. Enemy burn does not decay while Ifrit isn't frozen", { ...RARE, t: [[3, burn(6)]], ifrit: true });
U('tombKing', 'Tomb King', 4, 'person', '4 damage every 2s. Your "after each fight" bonuses grow twice as fast', { ...RARE, t: [[2, dmg(4)]], tombKing: true });
U('simurgh', 'Simurgh', 4, 'wolf', '5 heal every 1.5s. Each heal also deals half its amount as damage', { ...RARE, t: [[1.5, heal(5, { dmgFrac: 0.5 })]], tags: CREATURE });
U('dragonsHoard', "Dragon's Hoard", 4, 'thing', 'Every 3s, deals damage equal to 25% of gold held (max 15). +2 gold per day', { ...RARE, t: [[3, dmg(0, { goldFrac: 0.25, max: 15 })]], gold: 2 });
U('titan', 'Titan', 4, 'golem', "20 damage every 4s. Can't be frozen", { ...RARE, t: [[4, dmg(20)]], noFreeze: true });
U('fourLeafFairy', 'Four-Leaf Fairy', 4, 'fairy', 'At fight start, Bless 15 times and gain 6 Luck', { ...RARE, startBless: 15, startLuck: 6 });
U('sandworm', 'Sandworm', 4, 'scorpion', "Every 4s, consumes up to 8 of the enemy's Sand to deal 5 damage per stack, ignoring shield", { ...RARE, t: [[4, special('sandworm', { per: 5, max: 8 })]], tags: CREATURE });
U('winterDjinn', 'Winter Djinn', 4, 'spirit', 'Your freezes last 50% longer. Each freeze charges your highest-tier unit 1s', { ...RARE, freezeMult: 1.5, onFreeze: [charge('top', 1)] });

// ---------------------------------------------------------------- recipes
// [a, b, result, rareId?, rareChancePct?]  (order doesn't matter)

const RECIPE_LIST = [
  ['villager', 'wood', 'archer'], ['villager', 'stone', 'guard'], ['villager', 'berry', 'healer'],
  ['villager', 'ember', 'fireMage'], ['villager', 'bone', 'skeleton'], ['villager', 'coin', 'merchant'],
  ['villager', 'wolf', 'hunter'], ['villager', 'mushroom', 'druid'], ['villager', 'feather', 'scout'],
  ['villager', 'crystal', 'mage'],
  ['archer', 'ember', 'fireArcher'], ['archer', 'wood', 'ranger'], ['archer', 'feather', 'sharpshooter'],
  ['archer', 'crystal', 'frostArcher'], ['guard', 'stone', 'knight', 'darkKnight', 20], ['guard', 'berry', 'paladin'],
  ['guard', 'wood', 'spearman'], ['guard', 'crystal', 'warden'], ['healer', 'berry', 'shaman'],
  ['healer', 'bone', 'alchemist'], ['healer', 'crystal', 'oracle'], ['fireMage', 'ember', 'pyromancer'],
  ['fireMage', 'feather', 'flameDancer'], ['fireMage', 'bone', 'ashCaller'], ['skeleton', 'bone', 'necromancer'],
  ['skeleton', 'stone', 'boneKnight'], ['merchant', 'coin', 'banker'], ['merchant', 'stone', 'mercenary'],
  ['hunter', 'wolf', 'beastmaster'], ['hunter', 'wood', 'trapper'], ['druid', 'bone', 'hexer', 'witch', 25],
  ['druid', 'berry', 'groveKeeper'], ['druid', 'mushroom', 'sporeDruid'], ['scout', 'feather', 'windrunner'],
  ['scout', 'wolf', 'wolfRider'], ['mage', 'crystal', 'iceMage'], ['mage', 'feather', 'stormMage'],
  ['mage', 'moonstone', 'warlock'],
  ['knight', 'stone', 'champion'], ['knight', 'ember', 'flameKnight'], ['darkKnight', 'bone', 'deathKnight'],
  ['pyromancer', 'ember', 'infernoMage'], ['iceMage', 'crystal', 'archmage'],
  ['necromancer', 'moonstone', 'wraith', 'lich', 20], ['ranger', 'feather', 'hawkeye'],

  ['wolf', 'wolf', 'wolfPack'], ['wolf', 'ember', 'hellhound'], ['wolf', 'stone', 'direWolf'],
  ['wolf', 'feather', 'griffin'], ['wolf', 'bone', 'graveWolf'], ['wolf', 'scorpion', 'sandStalker'],
  ['wolf', 'moonstone', 'werewolf'],
  ['wolfPack', 'wolf', 'alpha'], ['hellhound', 'ember', 'cerberus'], ['direWolf', 'crystal', 'frostWolf'],
  ['griffin', 'feather', 'skyGriffin', 'roc', 15], ['graveWolf', 'bone', 'boneHound'],
  ['sandStalker', 'scorpion', 'desertStalker', 'manticore', 20], ['werewolf', 'moonstone', 'moonhowler'],

  ['scorpion', 'scorpion', 'scorpionSwarm', 'scorpionQueen', 10], ['scorpion', 'bone', 'deathstalker'],
  ['scorpion', 'ember', 'fireScorpion'], ['scorpion', 'stone', 'armoredScorpion'],
  ['scorpion', 'mushroom', 'sporeScorpion'], ['scorpion', 'moonstone', 'nightScorpion'],
  ['scorpionSwarm', 'scorpion', 'scorpionNest'], ['deathstalker', 'bone', 'tombStalker'],
  ['fireScorpion', 'ember', 'lavaScorpion'], ['armoredScorpion', 'stone', 'shellScorpion'],
  ['sporeScorpion', 'mushroom', 'fungalNest'],

  ['fairy', 'fairy', 'fairyRing'], ['fairy', 'berry', 'dryad'], ['fairy', 'wood', 'treant'],
  ['fairy', 'ember', 'wisp'], ['fairy', 'feather', 'pixie'], ['fairy', 'crystal', 'frostFairy'],
  ['fairy', 'mushroom', 'sporeFairy'], ['fairy', 'coin', 'luckyFairy'], ['fairy', 'moonstone', 'moonFairy'],
  ['fairyRing', 'fairy', 'fairyCourt'], ['dryad', 'berry', 'groveSpirit'], ['treant', 'wood', 'elderTreant'],
  ['wisp', 'ember', 'willOWisp'], ['pixie', 'feather', 'windSprite'], ['pixie', 'crystal', 'sylph', 'djinn', 15],
  ['sporeFairy', 'mushroom', 'myconid'], ['luckyFairy', 'coin', 'fortuneFairy'], ['frostFairy', 'crystal', 'snowQueen'],

  // Flame
  ['flameImp', 'ember', 'hellImp'], ['flameImp', 'wood', 'torchbearer'], ['flameImp', 'feather', 'sparkSprite'],
  ['flameImp', 'mushroom', 'smokeImp'], ['hellImp', 'ember', 'fireElemental'], ['torchbearer', 'stone', 'lavaGolem'],
  ['torchbearer', 'wood', 'beacon'], ['smokeImp', 'mushroom', 'smogElemental'], ['salamander', 'stone', 'magmaSalamander'],
  ['salamander', 'mushroom', 'toxicNewt'], ['salamander', 'ember', 'firedrake'], ['firedrake', 'ember', 'drakeMatriarch'],
  ['ashMoth', 'feather', 'cinderHawk'], ['cinderHawk', 'ember', 'pyreMoth'], ['ashMoth', 'wood', 'pyreKeeper'],
  ['flameImp', 'flameImp', 'hellImp'], ['ashMoth', 'flameImp', 'cinderHawk'],
  // Tomb
  ['ghoul', 'bone', 'ghast'], ['ghoul', 'mushroom', 'corpseEater'], ['mummy', 'bone', 'boneGolem'],
  ['mummy', 'sand', 'sandMummy'], ['sandMummy', 'coin', 'pharaoh'], ['plagueRat', 'plagueRat', 'ratKing'],
  ['plagueRat', 'berry', 'plagueDoctor'], ['plagueRat', 'mushroom', 'blightRat'], ['blightRat', 'bone', 'fester'],
  ['plagueRat', 'scorpion', 'blightRat'],
  // Grove
  ['stag', 'berry', 'unicorn'], ['stag', 'stag', 'elkHerd'], ['stag', 'stone', 'antlerGuard'],
  ['elkHerd', 'feather', 'greatStag'], ['thornbush', 'stone', 'briarWall'], ['thornbush', 'berry', 'rosebush'],
  ['briarWall', 'wood', 'ancientTree'], ['vineling', 'berry', 'bloomVine'], ['stag', 'wolf', 'elkHerd'],
  // Caravan
  ['trader', 'coin', 'goldGolem'], ['camel', 'stone', 'caravanGuard'], ['trader', 'ember', 'spiceTrader'],
  ['treasureChest', 'bone', 'mimic'],
  // Forge
  ['golem', 'stone', 'ironGolem'], ['catapult', 'wood', 'siegeTower'], ['catapult', 'ember', 'fireCatapult'],
  ['siegeTower', 'stone', 'trebuchet'], ['smith', 'stone', 'masterSmith'], ['masterSmith', 'crystal', 'runesmith'],
  ['clockwork', 'stone', 'clockworkKnight'], ['clockwork', 'clockwork', 'gearstorm'], ['smith', 'villager', 'masterSmith'],
  // Side-grades
  ['villager', 'moonstone', 'nightWatch'], ['archer', 'bone', 'boneArcher'], ['archer', 'mushroom', 'venomArcher'],
  ['fireMage', 'mushroom', 'smokeweaver'], ['guard', 'ember', 'braziarGuard'], ['healer', 'mushroom', 'herbalist'],
  ['skeleton', 'mushroom', 'plagueSkeleton'], ['wolf', 'mushroom', 'rabidWolf'], ['scorpion', 'feather', 'wasp'],
  ['fairy', 'bone', 'banshee'], ['wisp', 'stone', 'kilnSpirit'],

  ['fairyRing', 'feather', 'wishSprite'], ['luckyFairy', 'berry', 'cloverSprite'], ['archer', 'coin', 'gambler'],
  ['scout', 'coin', 'rogue'], ['luckyFairy', 'crystal', 'crystalFairy', 'fourLeafFairy', 15],
  ['villager', 'sand', 'sandcaster'], ['wolf', 'sand', 'jackal'], ['scorpion', 'sand', 'sandScorpion'],
  ['fairy', 'sand', 'dustSprite'], ['guard', 'sand', 'duneGuard'], ['sandcaster', 'sand', 'stormCaller'],
  ['dustSprite', 'crystal', 'mirage'], ['sandScorpion', 'sand', 'duneStalker', 'sandworm', 15],
  ['fireMage', 'wood', 'bonfireKeeper'], ['wisp', 'wood', 'hearthSpirit'], ['golem', 'ember', 'furnace'],
  ['iceMage', 'stone', 'shatterGolem'], ['snowQueen', 'moonstone', 'frostWraith', 'winterDjinn', 15],
  ['warlock', 'scorpion', 'venomDrinker'], ['goldGolem', 'coin', 'treasureGolem'], ['sylph', 'crystal', 'mirror'],
  ['wolfPack', 'berry', 'denMother'], ['spearman', 'stone', 'bulwark'],
  ['ashCaller', 'moonstone', 'ashborn'], ['sandcaster', 'ember', 'glassmaker'], ['luckyFairy', 'stone', 'wishingWell'],
  ['gambler', 'coin', 'highRoller'], ['knight', 'wood', 'juggernaut'], ['dryad', 'ember', 'sunSprite'],
  ['shaman', 'ember', 'sunShaman'], ['groveSpirit', 'stone', 'oasisSpirit'],
];

// ---------------------------------------------------------------- packs & tracks

export const PACKS = {
  village: { id: 'village', name: 'Village Pack', price: 3, size: 3, pool: [['villager', 3], ['wood', 2], ['stone', 2], ['berry', 2], ['coin', 2]] },
  wild: { id: 'wild', name: 'Wild Pack', price: 3, size: 3, pool: [['wolf', 3], ['fairy', 3], ['berry', 1], ['wood', 1], ['feather', 2], ['crystal', 1]] },
  desert: { id: 'desert', name: 'Desert Pack', price: 3, size: 3, pool: [['scorpion', 3], ['bone', 2], ['ember', 2], ['mushroom', 2], ['sand', 2], ['moonstone', 1]] },
  flame: { id: 'flame', name: 'Flame Pack', price: 4, size: 3, track: 'flame', pool: [['flameImp', 3], ['salamander', 3], ['ember', 2]] },
  inferno: { id: 'inferno', name: 'Inferno Pack', price: 5, size: 3, track: 'flame', rare: 'ifrit', pool: [['cinderMaw', 3], ['ashMoth', 3], ['ember', 1], ['wood', 1]] },
  tomb: { id: 'tomb', name: 'Tomb Pack', price: 4, size: 3, track: 'tomb', pool: [['ghoul', 3], ['mummy', 3], ['bone', 2]] },
  crypt: { id: 'crypt', name: 'Crypt Pack', price: 5, size: 3, track: 'tomb', rare: 'tombKing', pool: [['bogMaw', 3], ['plagueRat', 3], ['mushroom', 1], ['bone', 1]] },
  grove: { id: 'grove', name: 'Grove Pack', price: 4, size: 3, track: 'grove', pool: [['stag', 3], ['thornbush', 3], ['berry', 2]] },
  oasis: { id: 'oasis', name: 'Oasis Pack', price: 5, size: 3, track: 'grove', rare: 'simurgh', pool: [['sapling', 3], ['vineling', 3], ['berry', 1], ['wood', 1]] },
  caravan: { id: 'caravan', name: 'Caravan Pack', price: 4, size: 3, track: 'caravan', pool: [['camel', 2], ['trader', 3], ['coin', 2]] },
  treasury: { id: 'treasury', name: 'Treasury Pack', price: 5, size: 3, track: 'caravan', rare: 'dragonsHoard', pool: [['goldbug', 3], ['treasureChest', 3], ['coin', 2]] },
  quarry: { id: 'quarry', name: 'Quarry Pack', price: 4, size: 3, track: 'forge', pool: [['golem', 3], ['catapult', 3], ['stone', 2]] },
  foundry: { id: 'foundry', name: 'Foundry Pack', price: 5, size: 3, track: 'forge', rare: 'titan', pool: [['smith', 3], ['clockwork', 3], ['stone', 1]] },
};
export const BASE_PACKS = ['village', 'wild', 'desert'];

export const TRACKS = [
  { id: 'flame', name: 'Flame', feed: 'ember', packs: ['flame', 'inferno'] },
  { id: 'tomb', name: 'Tomb', feed: 'bone', packs: ['tomb', 'crypt'] },
  { id: 'grove', name: 'Grove', feed: 'berry', packs: ['grove', 'oasis'] },
  { id: 'caravan', name: 'Caravan', feed: 'coin', packs: ['caravan', 'treasury'] },
  { id: 'forge', name: 'Forge', feed: 'stone', packs: ['quarry', 'foundry'] },
];
export const TRACK_STEPS = [5, 12];
export const TRACK_RARE_CHANCE = 0.1;

// ---------------------------------------------------------------- rules

export const RULES = {
  // Everything in a fight runs 1.5x slower than the design doc's numbers.
  time: 1.5,
  burnTick: 1.5,
  // Burn loses half its stacks (rounded up) each tick.
  burnDecay: 2,
  // Crit chance per Luck stack.
  luckCrit: 0.02,
  // Highest miss chance Sand can cause.
  sandCap: 0.3,
  sandMiss: 0.02,
  poisonTick: 3,
  suddenTick: 1.5,
  freezeGuard: 1.5,
  startGold: 10,
  dayGold: 5,
  winGold: 2,
  winsToFinish: 10,
  lives: 3,
  tableLimit: 10,
  singlePrice: 3,
  ingredientPrice: 1,
  rerollPrice: 1,
  shopSlots: 4,
  rareCap: 50,
  suddenDeath: 45,
  // Gold to combine, by the tier of the result (rares cost like tier 4).
  combineCost: [0, 0, 1, 3, 5],
  combineTime: 0.9,
};
export const fortressHp = (day) => 40 + 20 * day;
export const wallSlots = (day) => (day >= 7 ? 6 : day >= 4 ? 5 : 4);

// ---------------------------------------------------------------- kin and pacing

const KIN = {
  wolf: ['wolf', 'wolfPack', 'alpha', 'hellhound', 'cerberus', 'direWolf', 'frostWolf', 'graveWolf', 'boneHound', 'werewolf',
    'moonhowler', 'sandStalker', 'desertStalker', 'rabidWolf', 'jackal', 'denMother', 'wolfRider', 'manticore'],
  scorpion: ['scorpion', 'scorpionSwarm', 'deathstalker', 'fireScorpion', 'armoredScorpion', 'sporeScorpion', 'nightScorpion',
    'scorpionNest', 'tombStalker', 'lavaScorpion', 'shellScorpion', 'fungalNest', 'sandScorpion', 'duneStalker', 'wasp', 'scorpionQueen', 'sandworm'],
  drake: ['salamander', 'magmaSalamander', 'toxicNewt', 'firedrake', 'drakeMatriarch'],
  rat: ['plagueRat', 'ratKing', 'blightRat'],
};
for (const [kin, ids] of Object.entries(KIN)) for (const id of ids) {
  const u = UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`kin ${kin}: unknown ${id}`);
  u.kin = kin;
}

// Slow every fight timing down by RULES.time, and rewrite the card text to match.
const scaleAct = (a) => {
  if (a.k === 'alt') a.list.forEach(scaleAct);
  if (a.k === 'freeze') a.dur = +(a.dur * RULES.time).toFixed(2);
  if ((a.k === 'charge' || a.k === 'delay') && typeof a.s === 'number') a.s = +(a.s * RULES.time).toFixed(2);
  if (a.k === 'bless' && a.charge) a.charge = +(a.charge * RULES.time).toFixed(2);
  if (a.delay) a.delay = { ...a.delay, s: +(a.delay.s * RULES.time).toFixed(2) };
};
const fmt = (n) => String(+(n * RULES.time).toFixed(1));
for (const u of UNITS) {
  u.t = u.t.map(([cd, ...acts]) => { acts.forEach(scaleAct); return [+(cd * RULES.time).toFixed(2), ...acts]; });
  if (u.once) { u.once = [u.once[0] * RULES.time, ...u.once.slice(1)]; u.once.slice(1).forEach(scaleAct); }
  for (const key of ['onCrit', 'onEnemyMiss', 'onFreeze', 'onHeal', 'onShieldHit', 'onNeighbourAct', 'onEnemyHeal', 'onEnemyPoisonTick', 'onEnemyBurnTick']) u[key]?.forEach(scaleAct);
  u.text = u.text.replace(/(\d+(?:\.\d+)?)s\b/g, (_, n) => `${fmt(Number(n))}s`);
}

// ---------------------------------------------------------------- lookup

export const CARDS = {};
for (const ing of INGREDIENTS) CARDS[ing.id] = { ...ing, kind: 'ingredient', tier: 0, text: `Ingredient. ${ing.theme}.` };
for (const u of UNITS) CARDS[u.id] = u;

export const RECIPES = new Map();
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
for (const [a, b, result, rare, chance] of RECIPE_LIST) {
  if (RECIPES.has(key(a, b))) throw new Error(`Duplicate recipe: ${a} + ${b}`);
  RECIPES.set(key(a, b), { a, b, result, rare: rare || null, chance: chance || 0 });
}
// Eaters: units that grow (and evolve) by eating ingredients dropped on them.
export function eats(eaterId, foodId) {
  return !!CARDS[eaterId]?.eats?.foods.includes(foodId);
}

export function recipeFor(a, b) {
  return RECIPES.get(key(a, b)) || null;
}

// Main number: what Bless and "+1 after each fight" grow.
const NUMERIC = ['dmg', 'heal', 'shield', 'burn', 'poison', 'sand'];
for (const u of UNITS) {
  if (u.main) continue;
  for (const timer of u.t) {
    const act = timer.slice(1).find((a) => NUMERIC.includes(a.k) || (a.k === 'alt'));
    if (act) { u.main = act.k === 'alt' ? act.list[0].k : act.k; break; }
  }
}

export const BASE_UNITS = ['villager', 'wolf', 'scorpion', 'fairy'];
export const SUMMONABLE = new Set(['scorpion', 'wolf', 'plagueRat', 'skeleton']);

export function combineCost(resultId) {
  const d = CARDS[resultId];
  return RULES.combineCost[Math.min(4, d.rare ? 4 : d.tier)];
}

export function sellValue(def, inst, ownedTrader = 0) {
  if (def.chest) return Math.min(10, 3 + (inst?.owned || 0)) + ownedTrader;
  if (def.rare) return 4 + ownedTrader;
  return Math.max(1, def.tier) + ownedTrader;
}

for (const r of RECIPES.values()) {
  for (const id of [r.a, r.b, r.result, r.rare]) {
    if (id && !CARDS[id]) throw new Error(`Recipe references unknown card: ${id}`);
  }
}
for (const p of Object.values(PACKS)) {
  for (const [id] of p.pool) if (!CARDS[id]) throw new Error(`Pack ${p.id} references unknown card: ${id}`);
}

for (const u of UNITS) {
  if (u.eats?.evolve && !CARDS[u.eats.evolve[1]]) throw new Error(`${u.id} evolves into unknown ${u.eats.evolve[1]}`);
  for (const [id] of RECIPE_LIST) void id;
}
for (const r of RECIPES.values()) {
  for (const side of [[r.a, r.b], [r.b, r.a]]) {
    if (eats(side[0], side[1])) throw new Error(`${side[0]} both eats and combines with ${side[1]}`);
  }
}
