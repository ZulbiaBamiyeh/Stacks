// Stackbrawl roster. Source of truth: docs/card-roster.md.
// Units are plain data: `t` lists timers as [cooldown, ...actions].
// Actions are built with the helpers below and interpreted by sim.js.

export const dmg = (n, o = {}) => ({ k: 'dmg', n, ...o });
export const shield = (n) => ({ k: 'shield', n });
export const heal = (n, o = {}) => ({ k: 'heal', n, ...o });
export const burn = (n, o = {}) => ({ k: 'burn', n, ...o });
export const poison = (n, o = {}) => ({ k: 'poison', n, ...o });
export const freeze = (target, dur) => ({ k: 'freeze', target, dur });
export const sand = (n) => ({ k: 'sand', n });
export const heat = (n) => ({ k: 'heat', n });
export const cold = (n) => ({ k: 'cold', n });
export const luck = (n) => ({ k: 'luck', n });
export const bless = (n, o = {}) => ({ k: 'bless', n, ...o });
export const summon = (id, max) => ({ k: 'summon', id, max });
export const charge = (target, s) => ({ k: 'charge', target, s });
export const special = (fx, o = {}) => ({ k: 'special', fx, ...o });
export const alt = (...list) => ({ k: 'alt', list });

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
U('wolf', 'Wolf', 1, 'wolf', '3 damage every 2.5s', { t: [[2.5, dmg(3)]], tags: CREATURE });
U('scorpion', 'Scorpion', 1, 'scorpion', '1 poison every 3s', { t: [[3, poison(1)]], tags: CREATURE });
U('fairy', 'Fairy', 1, 'fairy', '2 heal every 2s', { t: [[2, heal(2)]] });

// Villager tree: tier 2
U('archer', 'Archer', 2, 'person', '3 damage every 1.2s', { t: [[1.2, dmg(3)]] });
U('guard', 'Guard', 2, 'person', '6 shield every 2s', { t: [[2, shield(6)]] });
U('healer', 'Healer', 2, 'person', '6 heal every 2s', { t: [[2, heal(6)]] });
U('fireMage', 'Fire Mage', 2, 'person', '3 burn every 2s', { t: [[2, burn(3)]] });
U('skeleton', 'Skeleton', 2, 'person', '3 damage every 2s. +1 damage permanently after each fight', { t: [[2, dmg(3)]], perm: 1 });
U('merchant', 'Merchant', 2, 'person', '1 damage every 2s. +2 gold per day', { t: [[2, dmg(1)]], gold: 2 });
U('hunter', 'Hunter', 2, 'person', '5 damage every 2s', { t: [[2, dmg(5)]] });
U('druid', 'Druid', 2, 'person', '3 heal and 1 poison every 3s', { t: [[3, heal(3), poison(1)]] });
U('scout', 'Scout', 2, 'person', '2 damage every 0.8s', { t: [[0.8, dmg(2)]] });
U('mage', 'Mage', 2, 'person', '5 damage every 2s', { t: [[2, dmg(5)]] });

// Villager tree: tier 3
U('fireArcher', 'Fire Archer', 3, 'person', '3 damage and 1 burn every 1.2s', { t: [[1.2, dmg(3), burn(1)]] });
U('ranger', 'Ranger', 3, 'person', '8 damage every 1.8s', { t: [[1.8, dmg(8)]] });
U('sharpshooter', 'Sharpshooter', 3, 'person', '3 damage every 1s. Every 4th shot deals triple', { t: [[1, dmg(3, { nth: 4, nthMult: 3 })]] });
U('frostArcher', 'Frost Archer', 3, 'person', '4 damage every 1.2s. Each hit freezes a random enemy unit for 0.5s', { t: [[1.2, dmg(4), freeze('random', 0.5)]] });
U('knight', 'Knight', 3, 'person', '5 damage every 2s and 5 shield every 2.5s', { t: [[2, dmg(5)], [2.5, shield(5)]] });
U('paladin', 'Paladin', 3, 'person', '7 shield and 5 heal every 2.5s', { t: [[2.5, shield(7), heal(5)]] });
U('spearman', 'Spearman', 3, 'person', '4 damage every 1.5s and 4 shield every 3s', { t: [[1.5, dmg(4)], [3, shield(4)]] });
U('warden', 'Warden', 3, 'person', "8 shield every 2s. Your units can't be frozen while you have shield", { t: [[2, shield(8)]], warden: true });
U('shaman', 'Shaman', 3, 'person', '10 heal every 2.2s', { t: [[2.2, heal(10)]] });
U('alchemist', 'Alchemist', 3, 'person', 'Alternates 8 heal and 8 shield every 2s', { t: [[2, alt(heal(8), shield(8))]] });
U('oracle', 'Oracle', 3, 'person', '4 heal every 2s. Once per day, your next combine gets +20% rare odds', { t: [[2, heal(4)]], oracle: 20 });
U('pyromancer', 'Pyromancer', 3, 'person', '6 burn every 2.5s', { t: [[2.5, burn(6)]] });
U('flameDancer', 'Flame Dancer', 3, 'person', '1 burn every 0.6s', { t: [[0.6, burn(1)]] });
U('ashCaller', 'Ash Caller', 3, 'person', '2 damage and 2 burn every 2s. +1 burn permanently after each fight', { t: [[2, dmg(2), burn(2)]], perm: 1, main: 'burn' });
U('necromancer', 'Necromancer', 3, 'person', '1 poison every 3s. +1 poison per hit permanently after each fight', { t: [[3, poison(1)]], perm: 1 });
U('boneKnight', 'Bone Knight', 3, 'person', '4 damage and 4 shield every 2s. +1 damage permanently after each fight', { t: [[2, dmg(4), shield(4)]], perm: 1 });
U('banker', 'Banker', 3, 'person', 'No attack. At day\'s end, +1 gold per 5 gold held (max +4)', { banker: true });
U('mercenary', 'Mercenary', 3, 'person', 'Every 2s, deals 2 damage plus 1 per 3 gold held', { t: [[2, dmg(2, { perGold: 3 })]] });
U('beastmaster', 'Beastmaster', 3, 'person', '4 damage every 2s. Your creatures get +25% haste', { t: [[2, dmg(4)]], creatureHaste: 0.25 });
U('trapper', 'Trapper', 3, 'person', '4 damage every 2s. Freezes a random enemy unit for 1s every 4s', { t: [[2, dmg(4)], [4, freeze('random', 1)]] });
U('hexer', 'Hexer', 3, 'person', '2 poison every 3s', { t: [[3, poison(2)]] });
U('groveKeeper', 'Grove Keeper', 3, 'person', '6 heal and 1 poison every 2.5s', { t: [[2.5, heal(6), poison(1)]] });
U('sporeDruid', 'Spore Druid', 3, 'person', "Every 3s, adds poison equal to 20% of the enemy's current poison (min 1)", { t: [[3, poison(1, { pct: 0.2, min: 1 })]] });
U('windrunner', 'Windrunner', 3, 'person', '2 damage every 0.8s. All your units get +10% haste', { t: [[0.8, dmg(2)]], haste: 0.1 });
U('wolfRider', 'Wolf Rider', 3, 'wolf', '4 damage every 1s', { t: [[1, dmg(4)]], tags: CREATURE });
U('iceMage', 'Ice Mage', 3, 'person', "3 damage every 2s. Freezes the enemy's highest-tier unit for 1.5s every 4s. Adds 2 Cold per action", { t: [[2, dmg(3), cold(2)], [4, freeze('top', 1.5), cold(2)]] });
U('stormMage', 'Storm Mage', 3, 'person', '3 damage every 0.7s', { t: [[0.7, dmg(3)]] });
U('warlock', 'Warlock', 3, 'person', '6 damage every 2s. Double damage while your fortress is below 50%', { t: [[2, dmg(6)]], lowHp: { below: 0.5, mult: 2, k: 'dmg' } });

// Villager tree: tier 4
U('champion', 'Champion', 4, 'person', '8 damage every 2.5s and 8 shield every 3s', { t: [[2.5, dmg(8)], [3, shield(8)]] });
U('flameKnight', 'Flame Knight', 4, 'person', '5 damage and 2 burn every 2s, 5 shield every 2.5s', { t: [[2, dmg(5), burn(2)], [2.5, shield(5)]] });
U('infernoMage', 'Inferno Mage', 4, 'person', '9 burn every 3s', { t: [[3, burn(9)]] });
U('archmage', 'Archmage', 4, 'person', '4 damage every 2s. Freezes the 2 highest-tier enemy units for 1.5s every 4s', { t: [[2, dmg(4)], [4, freeze('top2', 1.5)]] });
U('wraith', 'Wraith', 4, 'spirit', "Freezes the enemy's fastest unit for 1s every 3s", { t: [[3, freeze('fastest', 1)]] });
U('hawkeye', 'Hawkeye', 4, 'person', '10 damage every 2s, ignores shield', { t: [[2, dmg(10, { pierce: true })]] });

// Wolf tree
U('wolfPack', 'Wolf Pack', 2, 'wolf', '3 damage every 1.1s', { t: [[1.1, dmg(3)]], tags: CREATURE });
U('hellhound', 'Hellhound', 2, 'wolf', '4 damage and 1 burn every 2.5s', { t: [[2.5, dmg(4), burn(1)]], tags: CREATURE });
U('direWolf', 'Dire Wolf', 2, 'wolf', '5 damage every 2.5s. Starts each fight with 10 shield', { t: [[2.5, dmg(5)]], startShield: 10, tags: CREATURE });
U('griffin', 'Griffin', 2, 'wolf', '4 damage every 1.5s, ignores shield', { t: [[1.5, dmg(4, { pierce: true })]], tags: CREATURE });
U('graveWolf', 'Grave Wolf', 2, 'wolf', '3 damage every 2s. +1 damage permanently after each fight', { t: [[2, dmg(3)]], perm: 1, tags: CREATURE });
U('sandStalker', 'Sand Stalker', 2, 'wolf', '3 damage and 1 poison every 3s', { t: [[3, dmg(3), poison(1)]], tags: CREATURE });
U('werewolf', 'Werewolf', 2, 'wolf', '5 damage every 2s. Double damage while your fortress is below 50%', { t: [[2, dmg(5)]], lowHp: { below: 0.5, mult: 2, k: 'dmg' }, tags: CREATURE });
U('alpha', 'Alpha', 3, 'wolf', '4 damage every 1s. Your other creatures deal +1 damage', { t: [[1, dmg(4)]], alpha: 1, tags: CREATURE });
U('cerberus', 'Cerberus', 3, 'wolf', 'Every 3s, attacks 3 times for 3 damage and 1 burn each', { t: [[3, dmg(3), burn(1), dmg(3), burn(1), dmg(3), burn(1)]], tags: CREATURE });
U('frostWolf', 'Frost Wolf', 3, 'wolf', '5 damage every 2s. Each hit freezes a random enemy unit for 1s', { t: [[2, dmg(5), freeze('random', 1)]], tags: CREATURE });
U('skyGriffin', 'Sky Griffin', 3, 'wolf', '4 damage every 1s, ignores shield', { t: [[1, dmg(4, { pierce: true })]], tags: CREATURE });
U('boneHound', 'Bone Hound', 3, 'wolf', '4 damage every 1.5s. +1 damage permanently after each fight', { t: [[1.5, dmg(4)]], perm: 1, tags: CREATURE });
U('desertStalker', 'Desert Stalker', 3, 'wolf', '4 damage and 2 poison every 3s', { t: [[3, dmg(4), poison(2)]], tags: CREATURE });
U('moonhowler', 'Moonhowler', 3, 'wolf', '4 damage every 1.5s. While below 50%, your creatures get +25% haste', { t: [[1.5, dmg(4)]], lowCreatureHaste: 0.25, tags: CREATURE });

// Scorpion tree
U('scorpionSwarm', 'Scorpion Swarm', 2, 'scorpion', '1 poison every 1.5s', { t: [[1.5, poison(1)]], tags: CREATURE });
U('deathstalker', 'Deathstalker', 2, 'scorpion', '2 poison every 3.5s', { t: [[3.5, poison(2)]], tags: CREATURE });
U('fireScorpion', 'Fire Scorpion', 2, 'scorpion', '1 poison and 2 burn every 3s', { t: [[3, poison(1), burn(2)]], tags: CREATURE });
U('armoredScorpion', 'Armored Scorpion', 2, 'scorpion', '1 poison every 3s and 5 shield every 2.5s', { t: [[3, poison(1)], [2.5, shield(5)]], tags: CREATURE });
U('sporeScorpion', 'Spore Scorpion', 2, 'scorpion', '1 poison every 2.5s. Each hit adds +1 more per 10 poison the enemy has', { t: [[2.5, poison(1, { per10: 1 })]], tags: CREATURE });
U('nightScorpion', 'Night Scorpion', 2, 'scorpion', '2 poison every 3s. Double poison while your fortress is below 50%', { t: [[3, poison(2)]], lowHp: { below: 0.5, mult: 2, k: 'poison' }, tags: CREATURE });
U('scorpionNest', 'Scorpion Nest', 3, 'scorpion', '2 poison every 1.8s. When it acts, summons a Scorpion into an empty slot (max 2 per fight)', { t: [[1.8, poison(2), summon('scorpion', 2)]], tags: CREATURE });
U('tombStalker', 'Tomb Stalker', 3, 'scorpion', '2 poison every 3s. +1 poison per hit permanently after each fight', { t: [[3, poison(2)]], perm: 1, tags: CREATURE });
U('lavaScorpion', 'Lava Scorpion', 3, 'scorpion', '2 poison and 3 burn every 3s', { t: [[3, poison(2), burn(3)]], tags: CREATURE });
U('shellScorpion', 'Shell Scorpion', 3, 'scorpion', '2 poison every 3s and 10 shield every 3s', { t: [[3, poison(2), shield(10)]], tags: CREATURE });
U('fungalNest', 'Fungal Nest', 3, 'scorpion', "Every 3s, adds poison equal to 15% of the enemy's current poison (min 2, max 6)", { t: [[3, poison(2, { pct: 0.15, min: 2, max: 6 })]], tags: CREATURE });

// Fairy tree
U('fairyRing', 'Fairy Ring', 2, 'fairy', 'Bless a random friendly unit every 1.5s', { t: [[1.5, bless(1)]] });
U('dryad', 'Dryad', 2, 'fairy', '4 heal every 1.5s', { t: [[1.5, heal(4)]] });
U('treant', 'Treant', 2, 'fairy', '6 shield and 2 heal every 2.5s', { t: [[2.5, shield(6), heal(2)]] });
U('wisp', 'Wisp', 2, 'fairy', '2 burn every 2s. Freezes a random enemy unit for 1s every 4s', { t: [[2, burn(2)], [4, freeze('random', 1)]] });
U('pixie', 'Pixie', 2, 'fairy', '2 heal every 2s. All your units get +10% haste', { t: [[2, heal(2)]], haste: 0.1 });
U('frostFairy', 'Frost Fairy', 2, 'fairy', "2 heal every 3s. Freezes the enemy's highest-tier unit for 1.5s every 4s", { t: [[3, heal(2)], [4, freeze('top', 1.5), cold(1)]] });
U('sporeFairy', 'Spore Fairy', 2, 'fairy', '2 heal and 1 poison every 2.5s', { t: [[2.5, heal(2), poison(1)]] });
U('luckyFairy', 'Lucky Fairy', 2, 'fairy', '2 heal every 2s. +4 Luck at fight start. +5% rare odds while you own it', { t: [[2, heal(2)]], startLuck: 4, rareOdds: 5 });
U('moonFairy', 'Moon Fairy', 2, 'fairy', '3 heal every 2s. Triple heal while your fortress is below 30%', { t: [[2, heal(3)]], lowHp: { below: 0.3, mult: 3, k: 'heal' } });
U('fairyCourt', 'Fairy Court', 3, 'fairy', 'Bless a random friendly unit every 1s. Every 5th Bless also gives +1 Luck', { t: [[1, bless(1, { luckEvery: 5 })]] });
U('groveSpirit', 'Grove Spirit', 3, 'fairy', '7 heal every 1.5s', { t: [[1.5, heal(7)]] });
U('elderTreant', 'Elder Treant', 3, 'fairy', '10 shield and 4 heal every 2.5s', { t: [[2.5, shield(10), heal(4)]] });
U('willOWisp', "Will-o'-Wisp", 3, 'fairy', '3 burn every 2s. Freezes a random enemy unit for 1s every 3s', { t: [[2, burn(3)], [3, freeze('random', 1)]] });
U('windSprite', 'Wind Sprite', 3, 'fairy', '2 damage every 1s. All your units get +20% haste', { t: [[1, dmg(2)]], haste: 0.2 });
U('sylph', 'Sylph', 3, 'fairy', '3 heal every 1.5s', { t: [[1.5, heal(3)]] });
U('myconid', 'Myconid', 3, 'fairy', '4 heal and 2 poison every 3s', { t: [[3, heal(4), poison(2)]] });
U('fortuneFairy', 'Fortune Fairy', 3, 'fairy', '+8 Luck at fight start. +5% rare odds while owned. +1 gold per day', { startLuck: 8, rareOdds: 5, gold: 1 });
U('snowQueen', 'Snow Queen', 3, 'fairy', 'Freezes the 2 highest-tier enemy units for 1.5s every 4s', { t: [[4, freeze('top2', 1.5), cold(1)]] });

// Shop track units
const TRACK = { track: true };
U('flameSpirit', 'Flame Spirit', 2, 'spirit', '1 burn every 0.8s', { ...TRACK, t: [[0.8, burn(1)]] });
U('salamander', 'Salamander', 2, 'wolf', '1 burn every 1.5s. +1 burn per hit this fight (max +5)', { ...TRACK, t: [[1.5, burn(1, { ramp: 5 })]], tags: CREATURE });
U('fireElemental', 'Fire Elemental', 3, 'spirit', '5 burn every 2s', { ...TRACK, t: [[2, burn(5)]] });
U('lavaGolem', 'Lava Golem', 3, 'golem', '8 shield every 2.5s. While you have shield, the enemy gains 1 burn every 1s', { ...TRACK, t: [[2.5, shield(8)], [1, burn(1, { ifShield: true })]] });
U('ghoul', 'Ghoul', 2, 'spirit', '3 damage every 2s. Each hit heals you 1', { ...TRACK, t: [[2, dmg(3, { lifesteal: 1 })]] });
U('mummy', 'Mummy', 2, 'spirit', '2 poison and 8 shield every 4s', { ...TRACK, t: [[4, poison(2), shield(8)]] });
U('boneGolem', 'Bone Golem', 3, 'golem', '12 shield every 3s. +2 shield permanently after each fight', { ...TRACK, t: [[3, shield(12)]], perm: 2 });
U('ghast', 'Ghast', 3, 'spirit', '4 damage every 1.5s. Each hit heals you 2', { ...TRACK, t: [[1.5, dmg(4, { lifesteal: 2 })]] });
U('stag', 'Stag', 2, 'wolf', '3 damage every 1s', { ...TRACK, t: [[1, dmg(3)]], tags: CREATURE });
U('thornbush', 'Thornbush', 2, 'fairy', '6 shield every 3s. Each enemy hit on your shield deals 1 back', { ...TRACK, t: [[3, shield(6)]], thorns: 1 });
U('unicorn', 'Unicorn', 3, 'wolf', '4 damage and 6 heal every 2s', { ...TRACK, t: [[2, dmg(4), heal(6)]], tags: CREATURE });
U('ancientTree', 'Ancient Tree', 3, 'fairy', '12 shield and 6 heal every 3s', { ...TRACK, t: [[3, shield(12), heal(6)]] });
U('camel', 'Camel', 2, 'wolf', 'No attack. +1 shop slot', { ...TRACK, shopSlot: 1, tags: CREATURE });
U('trader', 'Trader', 2, 'person', '2 damage every 2s. Selling a card gives +1 gold', { ...TRACK, t: [[2, dmg(2)]], sellBonus: 1 });
U('treasureChest', 'Treasure Chest', 2, 'thing', 'No attack. Sells for 3 gold plus 1 per day owned (max 10)', { ...TRACK, chest: true });
U('goldGolem', 'Gold Golem', 3, 'golem', 'Every 2.5s, deals 3 damage plus 1 per 4 gold held', { ...TRACK, t: [[2.5, dmg(3, { perGold: 4 })]] });
U('golem', 'Golem', 2, 'golem', '10 shield every 3s', { ...TRACK, t: [[3, shield(10)]] });
U('catapult', 'Catapult', 2, 'thing', '12 damage every 4s', { ...TRACK, t: [[4, dmg(12)]] });
U('ironGolem', 'Iron Golem', 3, 'golem', '12 shield every 3s. Each enemy hit on your shield deals 1 back', { ...TRACK, t: [[3, shield(12)]], thorns: 1 });
U('siegeTower', 'Siege Tower', 3, 'thing', '6 damage every 2s, ignores shield', { ...TRACK, t: [[2, dmg(6, { pierce: true })]] });

// Engines
U('wishSprite', 'Wish Sprite', 3, 'fairy', 'Every 2s, Bless a random friendly unit and charge it 0.5s', { t: [[2, bless(1, { charge: 0.5 })]] });
U('cloverSprite', 'Clover Sprite', 3, 'fairy', '2 heal every 2s. Whenever you crit, heal 2', { t: [[2, heal(2)]], onCrit: [heal(2)] });
U('gambler', 'Gambler', 3, 'person', '4 damage every 1.5s. Whenever you crit, +1 Luck', { t: [[1.5, dmg(4)]], onCrit: [luck(1)] });
U('rogue', 'Rogue', 3, 'person', '2 damage every 0.6s. Its crits deal triple instead of double', { t: [[0.6, dmg(2)]], critMult: 3 });
U('crystalFairy', 'Crystal Fairy', 3, 'fairy', '3 heal every 2s. +4 Luck at fight start', { t: [[2, heal(3)]], startLuck: 4 });
U('sandcaster', 'Sandcaster', 2, 'person', '2 damage and 2 Sand every 2s', { t: [[2, dmg(2), sand(2)]] });
U('jackal', 'Jackal', 2, 'wolf', '3 damage every 1.5s. Each hit adds 1 Sand', { t: [[1.5, dmg(3, { sandOnHit: 1 })]], tags: CREATURE });
U('sandScorpion', 'Sand Scorpion', 2, 'scorpion', '1 poison and 1 Sand every 2.5s', { t: [[2.5, poison(1), sand(1)]], tags: CREATURE });
U('dustSprite', 'Dust Sprite', 2, 'fairy', '3 Sand every 2.5s', { t: [[2.5, sand(3)]] });
U('duneGuard', 'Dune Guard', 3, 'person', '5 shield every 2s. Whenever an enemy action misses, gain 2 shield', { t: [[2, shield(5)]], onEnemyMiss: [shield(2)] });
U('stormCaller', 'Storm Caller', 3, 'person', '5 Sand every 3s', { t: [[3, sand(5)]] });
U('mirage', 'Mirage', 3, 'fairy', 'Whenever an enemy action misses, charge a random friendly unit 0.5s', { onEnemyMiss: [charge('random', 0.5)] });
U('duneStalker', 'Dune Stalker', 3, 'scorpion', '2 poison and 2 Sand every 2.5s', { t: [[2.5, poison(2), sand(2)]], tags: CREATURE });
U('bonfireKeeper', 'Bonfire Keeper', 3, 'person', '2 burn every 2s. Gain 2 Heat each time it acts', { t: [[2, burn(2), heat(2)]] });
U('hearthSpirit', 'Hearth Spirit', 3, 'spirit', 'Whenever enemy burn ticks, gain 1 Heat', { onEnemyBurnTick: [heat(1)] });
U('furnace', 'Furnace', 3, 'golem', 'Every 2s, gain 2 Heat. At 20+ Heat, spends 10 to deal 30 damage', { t: [[2, heat(2), special('furnace')]] });
U('shatterGolem', 'Shatter Golem', 4, 'golem', '6 shield every 3s. Whenever an enemy unit is frozen, deal 6 damage', { t: [[3, shield(6)]], onFreeze: [dmg(6, { trigger: true })] });
U('frostWraith', 'Frost Wraith', 4, 'spirit', 'Freezes a random enemy unit for 1s every 2.5s', { t: [[2.5, freeze('random', 1)]] });
U('venomDrinker', 'Venom Drinker', 4, 'person', 'Every 3s, poisons your own fortress by 1. Your units deal +1 damage per poison on you (max +10)', { t: [[3, special('selfPoison', { n: 1 })]], venom: 10 });
U('treasureGolem', 'Treasure Golem', 4, 'golem', 'Once per fight, at 8s, deals damage equal to double your gold', { once: [8, dmg(0, { goldMult: 2 })] });
U('mirror', 'Mirror', 4, 'thing', "Copies its left neighbour's effect at 75% strength", { mirror: 0.75 });
U('denMother', 'Den Mother', 3, 'wolf', '2 heal every 2s. Every 4s, summons a Wolf into an empty slot', { t: [[2, heal(2)], [4, summon('wolf', 6)]], tags: CREATURE });
U('bulwark', 'Bulwark', 4, 'person', 'Every 3s, deals damage equal to half your current shield', { t: [[3, dmg(0, { shieldFrac: 0.5 })]] });
U('ashborn', 'Ashborn', 4, 'spirit', '2 burn every 2s. Once per fight, when your fortress would hit 0, spends all Heat to revive with 4 HP per Heat', { t: [[2, burn(2)]], ashborn: 4 });
U('glassmaker', 'Glassmaker', 3, 'person', 'Every 3s, removes 4 Sand from the enemy to gain 12 shield', { t: [[3, special('glass')]] });
U('wishingWell', 'Wishing Well', 3, 'thing', 'Every 4s, spends 3 Luck to Bless 4 times', { t: [[4, special('well')]] });
U('highRoller', 'High Roller', 4, 'person', '6 damage every 2s. Every 5s, spends 5 Luck so its next hit crits for triple', { t: [[2, dmg(6)], [5, special('prime')]] });
U('juggernaut', 'Juggernaut', 4, 'person', '4 shield every 2s. Every 5s, spends all your shield to deal that much damage', { t: [[2, shield(4)], [5, dmg(0, { spendShield: true })]] });
U('sunSprite', 'Sun Sprite', 3, 'fairy', '4 heal every 1.5s. Whenever you heal, deal 2 damage', { t: [[1.5, heal(4)]], onHeal: [dmg(2, { trigger: true })] });
U('sunShaman', 'Sun Shaman', 4, 'person', 'Every 4s, deals damage equal to half the healing you did in the last 4s', { t: [[4, dmg(0, { healFrac: 0.5 })]] });
U('oasisSpirit', 'Oasis Spirit', 4, 'fairy', '7 heal every 1.5s. Healing past full HP becomes shield', { t: [[1.5, heal(7)]], overheal: true });

// Rares
const RARE = { rare: true };
U('darkKnight', 'Dark Knight', 4, 'person', '6 damage every 2s. +1 damage per 10 missing fortress HP', { ...RARE, t: [[2, dmg(6, { perMissing: 10 })]] });
U('deathKnight', 'Death Knight', 4, 'person', "Dark Knight's effect, and each hit also applies 1 poison", { ...RARE, t: [[2, dmg(6, { perMissing: 10 }), poison(1)]] });
U('witch', 'Witch', 4, 'person', "2 poison every 3s. Every 6s, the enemy's poison ticks one extra time", { ...RARE, t: [[3, poison(2)], [6, special('witch')]] });
U('lich', 'Lich', 4, 'spirit', "3 poison every 3s. Every 5s, completes a neighbour's cooldown instantly", { ...RARE, t: [[3, poison(3)], [5, special('lich')]] });
U('roc', 'Roc', 4, 'wolf', '6 damage every 1.5s, ignores shield. Once per fight, when your fortress would hit 0, it revives at 25% HP', { ...RARE, t: [[1.5, dmg(6, { pierce: true })]], revive: 0.25, tags: CREATURE });
U('manticore', 'Manticore', 4, 'wolf', '8 damage and 2 poison every 2s', { ...RARE, t: [[2, dmg(8), poison(2)]], tags: CREATURE });
U('scorpionQueen', 'Scorpion Queen', 4, 'scorpion', '1 poison every 1.5s. All your poison applications get +1', { ...RARE, t: [[1.5, poison(1)]], queen: 1, tags: CREATURE });
U('djinn', 'Djinn', 4, 'spirit', 'Every 3s, copies the effect of a random friendly unit (never another Djinn)', { ...RARE, t: [[3, special('djinn')]] });
U('ifrit', 'Ifrit', 4, 'spirit', "6 burn every 3s. Enemy burn does not decay while Ifrit isn't frozen", { ...RARE, t: [[3, burn(6)]], ifrit: true });
U('tombKing', 'Tomb King', 4, 'person', '4 damage every 2s. Your "after each fight" bonuses grow twice as fast', { ...RARE, t: [[2, dmg(4)]], tombKing: true });
U('simurgh', 'Simurgh', 4, 'wolf', '5 heal every 1.5s. Each heal also deals half its amount as damage', { ...RARE, t: [[1.5, heal(5, { dmgFrac: 0.5 })]], tags: CREATURE });
U('dragonsHoard', "Dragon's Hoard", 4, 'thing', 'Every 3s, deals damage equal to 25% of gold held (max 15). +2 gold per day', { ...RARE, t: [[3, dmg(0, { goldFrac: 0.25, max: 15 })]], gold: 2 });
U('titan', 'Titan', 4, 'golem', "20 damage every 4s. Can't be frozen", { ...RARE, t: [[4, dmg(20)]], noFreeze: true });
U('fourLeafFairy', 'Four-Leaf Fairy', 4, 'fairy', 'At fight start, Bless 15 times and gain 6 Luck', { ...RARE, startBless: 15, startLuck: 6 });
U('sandworm', 'Sandworm', 4, 'scorpion', "Every 4s, consumes all the enemy's Sand to deal 4 damage per stack, ignoring shield", { ...RARE, t: [[4, special('sandworm', { per: 4 })]], tags: CREATURE });
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

  ['flameSpirit', 'ember', 'fireElemental'], ['salamander', 'ember', 'fireElemental'],
  ['ghoul', 'bone', 'ghast'], ['mummy', 'bone', 'boneGolem'], ['stag', 'berry', 'unicorn'],
  ['thornbush', 'wood', 'ancientTree'], ['trader', 'coin', 'goldGolem'], ['golem', 'stone', 'ironGolem'],
  ['catapult', 'wood', 'siegeTower'],

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
  flame: { id: 'flame', name: 'Flame Pack', price: 4, size: 3, track: 'flame', pool: [['flameSpirit', 3], ['salamander', 3], ['ember', 2]] },
  inferno: { id: 'inferno', name: 'Inferno Pack', price: 6, size: 3, track: 'flame', rare: 'ifrit', pool: [['fireElemental', 3], ['lavaGolem', 3], ['flameSpirit', 1]] },
  tomb: { id: 'tomb', name: 'Tomb Pack', price: 4, size: 3, track: 'tomb', pool: [['ghoul', 3], ['mummy', 3], ['bone', 2]] },
  crypt: { id: 'crypt', name: 'Crypt Pack', price: 6, size: 3, track: 'tomb', rare: 'tombKing', pool: [['boneGolem', 3], ['ghast', 3], ['ghoul', 1]] },
  grove: { id: 'grove', name: 'Grove Pack', price: 4, size: 3, track: 'grove', pool: [['stag', 3], ['thornbush', 3], ['berry', 2]] },
  oasis: { id: 'oasis', name: 'Oasis Pack', price: 6, size: 3, track: 'grove', rare: 'simurgh', pool: [['unicorn', 3], ['ancientTree', 3], ['stag', 1]] },
  caravan: { id: 'caravan', name: 'Caravan Pack', price: 4, size: 3, track: 'caravan', pool: [['camel', 2], ['trader', 3], ['treasureChest', 2], ['coin', 2]] },
  treasury: { id: 'treasury', name: 'Treasury Pack', price: 6, size: 3, track: 'caravan', rare: 'dragonsHoard', pool: [['goldGolem', 3], ['treasureChest', 2], ['trader', 1]] },
  quarry: { id: 'quarry', name: 'Quarry Pack', price: 4, size: 3, track: 'forge', pool: [['golem', 3], ['catapult', 3], ['stone', 2]] },
  foundry: { id: 'foundry', name: 'Foundry Pack', price: 6, size: 3, track: 'forge', rare: 'titan', pool: [['ironGolem', 3], ['siegeTower', 3], ['golem', 1]] },
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
  startGold: 10,
  dayGold: 8,
  winGold: 2,
  winsToFinish: 10,
  lives: 3,
  tableLimit: 10,
  singlePrice: 3,
  ingredientPrice: 1,
  rerollPrice: 1,
  shopSlots: 4,
  rareCap: 50,
  suddenDeath: 30,
  combineTime: 0.9,
};
export const fortressHp = (day) => 40 + 20 * day;
export const wallSlots = (day) => (day >= 7 ? 6 : day >= 4 ? 5 : 4);

// ---------------------------------------------------------------- lookup

export const CARDS = {};
for (const ing of INGREDIENTS) CARDS[ing.id] = { ...ing, kind: 'ingredient', tier: 0, text: `Ingredient. ${ing.theme}.` };
for (const u of UNITS) CARDS[u.id] = u;

export const RECIPES = new Map();
const key = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);
for (const [a, b, result, rare, chance] of RECIPE_LIST) {
  RECIPES.set(key(a, b), { a, b, result, rare: rare || null, chance: chance || 0 });
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
export const SUMMONABLE = new Set(['scorpion', 'wolf']);

export function sellValue(def, inst, ownedTrader = 0) {
  if (def.chest) return Math.min(10, 3 + (inst?.owned || 0)) + ownedTrader;
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
