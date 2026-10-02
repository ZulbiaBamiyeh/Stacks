// Trinkets: passive relics forged from stacks of one resource. Stack 2–5 of
// the same ingredient into a bundle, then drop the bundle on the trinket rack
// to forge a random trinket of that size. Bigger stacks, bigger effects; the
// x5 trinkets are meant to change how a build plays.
//
// Each trinket's `m` is a set of modifiers the sim (and run, for economy
// ones) understands. Modifiers from several trinkets add together.
export const RACK_SLOTS = 5;
export const MAX_STACK = 5;
// Gold to forge, by stack size.
export const FORGE_COST = [0, 0, 1, 2, 3, 4];
export const trinketSellValue = (t) => Math.max(1, TRINKETS[t.id].size - 1);

export const TRINKETS = {};
const T = (id, res, size, name, text, m) => { TRINKETS[id] = { id, res, size, name, text, m, kind: 'trinket' }; };

// ---------------------------------------------------------------- wood: arrows, bark, growth
T('whittledArrowhead', 'wood', 2, 'Whittled Arrowhead', "Your leftmost unit's attacks deal +2 damage.", { leftAdd: { dmg: 2 } });
T('birchSplint', 'wood', 2, 'Birch Splint', 'Your units start each fight 25% charged.', { charge: 0.25 });
T('pineSapCharm', 'wood', 2, 'Pine Sap Charm', 'Every 6s, heal 4.', { every: [[6, { k: 'heal', n: 4 }]] });
T('fletchersQuiver', 'wood', 3, "Fletcher's Quiver", 'Your attacks deal 15% more damage.', { pct: { dmg: 0.15 } });
T('barkMantle', 'wood', 3, 'Bark Mantle', 'Every 5s, gain 6 shield.', { every: [[5, { k: 'shield', n: 6 }]] });
T('woodsmansMark', 'wood', 3, "Woodsman's Mark", 'Your leftmost and rightmost units act 20% faster.', { edgeHaste: 0.2 });
T('heartwoodBow', 'wood', 4, 'Heartwood Bow', 'Your attacks deal +1 damage, and 20% more while the enemy is below half HP.', { add: { dmg: 1 }, execute: 0.2 });
T('livingPalisade', 'wood', 4, 'Living Palisade', 'Start with 12 shield. Whenever your shield is hit, deal 3 damage back.', { start: { shield: 12 }, thorns: 3 });
T('druidsStaff', 'wood', 4, "Druid's Staff", 'Heals are 30% stronger. Healing past full HP becomes shield.', { pct: { heal: 0.3 }, overheal: true });
T('elderGroveCrown', 'wood', 5, 'Crown of the Elder Grove', "Every 4s, all your units' cooldowns jump ahead 0.5s.", { every: [[4, { k: 'chargeAll', s: 0.5 }]] });
T('yggdrasilSeed', 'wood', 5, 'Yggdrasil Seed', '+40 max HP. Every 3s, heal 3% of your max HP.', { start: { maxHp: 40 }, every: [[3, { k: 'healPct', n: 0.03 }]] });
T('thousandArrowQuiver', 'wood', 5, 'Thousand-Arrow Quiver', 'Every attack fires a second arrow for 40% of its damage.', { extraHit: 0.4 });

// ---------------------------------------------------------------- stone: shield
T('pebblePouch', 'stone', 2, 'Pebble Pouch', 'Your shield actions give +2 shield.', { add: { shield: 2 } });
T('riverStone', 'stone', 2, 'River Stone', 'Start each fight with 15 shield.', { start: { shield: 15 } });
T('whetstone', 'stone', 2, 'Whetstone', 'Start with 8 shield. Your attacks deal +1 damage while you have shield.', { start: { shield: 8 }, shieldedDmg: 1 });
T('graniteWard', 'stone', 3, 'Granite Ward', 'Start with 8 shield. You gain 50% more shield.', { start: { shield: 8 }, pct: { shield: 0.5 } });
T('spikedPauldron', 'stone', 3, 'Spiked Pauldron', 'Whenever your shield is hit, deal 4 damage back.', { thorns: 4 });
T('cairnToken', 'stone', 3, 'Cairn Token', 'Start with 10 shield. Burn deals half damage to you while you have shield.', { start: { shield: 10 }, shieldBurnCut: 0.5 });
T('bulwarkSigil', 'stone', 4, 'Bulwark Sigil', 'Every 5s, gain shield equal to 4% of your max HP.', { every: [[5, { k: 'shieldPct', n: 0.04 }]] });
T('mountainsPatience', 'stone', 4, "Mountain's Patience", 'Start with 8 shield. Whenever you gain shield, heal 75% of it.', { start: { shield: 8 }, shieldHeal: 0.75 });
T('obsidianSpikes', 'stone', 4, 'Obsidian Spikes', 'Whenever you gain shield, deal half of it as damage.', { spikes: 0.5 });
T('aegisUnbroken', 'stone', 5, 'Aegis of the Unbroken', 'Start with 25 shield. Poison hits your shield before your HP. You gain 45% more shield.', { start: { shield: 25 }, poisonBlock: true, pct: { shield: 0.45 } });
T('golemHeart', 'stone', 5, 'Golem Heart', 'Gain 1 shield whenever any unit acts, on either side.', { shieldPerAct: 1 });
T('titansAnvil', 'stone', 5, "Titan's Anvil", 'Start with 15 shield. Your attacks deal +1 damage for every 4 shield you have.', { start: { shield: 15 }, dmgPerShield: 4 });

// ---------------------------------------------------------------- berry: healing
T('berryBasket', 'berry', 2, 'Berry Basket', 'Your heals restore +1.', { add: { heal: 1 } });
T('jamJar', 'berry', 2, 'Jam Jar', 'Every 7s, heal 5.', { every: [[7, { k: 'heal', n: 5 }]] });
T('sweetNectar', 'berry', 2, 'Sweet Nectar', 'Each heal of 4 or more also removes 1 poison from you.', { cleanseOnHeal: 1, cleanseMin: 4 });
T('brambleWreath', 'berry', 3, 'Bramble Wreath', 'Your heals restore +1, then 35% more.', { add: { heal: 1 }, pct: { heal: 0.35 } });
T('vintnersCup', 'berry', 3, "Vintner's Cup", 'Heal 40% of the burn damage you deal.', { leech: { burn: 0.4 } });
T('hearthLoaf', 'berry', 3, 'Hearth Loaf', 'Healing past full HP becomes shield.', { overheal: true, add: { heal: 1 } });
T('elderberryElixir', 'berry', 4, 'Elderberry Elixir', 'Each heal also removes 2 poison and 2 burn from you.', { cleanseOnHeal: 2, cleanseBurn: true });
T('gardenersLantern', 'berry', 4, "Gardener's Lantern", "Whenever you heal, a random unit's cooldown jumps ahead 0.9s.", { onHealCharge: 0.9 });
T('thornberryCrown', 'berry', 4, 'Thornberry Crown', 'Whenever you heal, deal 50% of it as damage.', { onHealDmg: 0.5 });
T('cornucopia', 'berry', 5, 'Cornucopia', 'Heals are 30% stronger. Every 3s, heal 3% of your max HP.', { pct: { heal: 0.3 }, every: [[3, { k: 'healPct', n: 0.03 }]] });
T('chaliceOfPlenty', 'berry', 5, 'Chalice of Plenty', 'The enemy starts with 3 poison. Heal 60% of the poison damage you deal.', { startEnemy: { poison: 3 }, leech: { poison: 0.6 } });
T('bloodberryVow', 'berry', 5, 'Bloodberry Vow', 'Your heals are more than doubled (+140%), but you lose 1 HP every 1.5s.', { pct: { heal: 1.4 }, every: [[1.5, { k: 'selfDmg', n: 1 }]] });

// ---------------------------------------------------------------- bone: undeath, growth
T('graveDust', 'bone', 2, 'Grave Dust', '+5 max HP. Enemy heals are 25% weaker.', { start: { maxHp: 5 }, enemyHealCut: 0.25 });
T('ribCageCharm', 'bone', 2, 'Rib-Cage Charm', '+12 max HP.', { start: { maxHp: 12 } });
T('skeletonKey', 'bone', 2, 'Skeleton Key', 'After each win, a random wall unit gains +1 permanently.', { permOnWin: 1 });
T('graveWard', 'bone', 3, 'Grave Ward', '+15 max HP. You take 30% less sudden-death damage.', { start: { maxHp: 15 }, suddenCut: 0.3 });
T('boneFlute', 'bone', 3, 'Bone Flute', "Every 4s, push a random enemy unit's cooldown back 0.8s.", { every: [[4, { k: 'delay', s: 0.8 }]] });
T('ancestorsTooth', 'bone', 3, "Ancestor's Tooth", 'After each fight, a random wall unit gains +1 permanently.', { permAfter: 1 });
T('lichPhylactery', 'bone', 4, "Lich's Phylactery", 'Once per fight, when you would fall, rise again with 15% HP.', { revive: 0.15 });
T('necroticCenser', 'bone', 4, 'Necrotic Censer', '+15 max HP. Enemy heals are 50% weaker and their shield gains 30% weaker.', { start: { maxHp: 15 }, enemyHealCut: 0.5, enemyShieldCut: 0.3 });
T('charnelDrum', 'bone', 4, 'Charnel Drum', "Every 10s, all your units' main numbers grow by 1 for the rest of the fight.", { every: [[10, { k: 'rallyAll', n: 1 }]] });
T('ruinedKingCrown', 'bone', 5, 'Crown of the Ruined King', 'Every 7th enemy action is confused: its damage hits its own fortress and its heals and shields go to you.', { confuse: 7 });
T('boneThrone', 'bone', 5, 'Bone Throne', 'After each fight, two random wall units gain +1 permanently. Your units start fights with +1 to their main number.', { permAfter: 2, rallyStart: 1 });
T('deathlessSigil', 'bone', 5, 'Deathless Sigil', 'Once per fight, when you would fall, rise again with 30% HP and your units act 25% faster from then on.', { revive: 0.3, reviveHaste: 0.25 });

// ---------------------------------------------------------------- ember: burn
T('emberLocket', 'ember', 2, 'Ember Locket', 'Your burn actions apply +1 burn.', { add: { burn: 1 } });
T('tinderbox', 'ember', 2, 'Tinderbox', 'The enemy starts each fight with 4 burn.', { startEnemy: { burn: 4 } });
T('warmingStone', 'ember', 2, 'Warming Stone', 'Start each fight with 4 Heat.', { start: { heat: 4 } });
T('brazierBrooch', 'ember', 3, 'Brazier Brooch', 'You apply 30% more burn.', { pct: { burn: 0.3 } });
T('coalHeart', 'ember', 3, 'Coal Heart', 'Your burn fades slower: it loses a third each tick instead of half.', { burnDecay: 3 });
T('cinderFang', 'ember', 3, 'Cinder Fang', 'Your crits apply 3 burn.', { onCrit: [{ k: 'burn', n: 3 }], critChance: 0.04 });
T('salamanderScale', 'ember', 4, 'Salamander Scale', 'Heal 30% of the burn damage you deal.', { leech: { burn: 0.3 } });
T('smolderingCrown', 'ember', 4, 'Smoldering Crown', 'Your burn ticks 30% faster and each tick deals 30% more.', { burnRate: 0.3, burnTickPct: 0.3 });
T('pyreLantern', 'ember', 4, 'Pyre Lantern', 'Every 3s, apply 3 burn.', { every: [[3, { k: 'burn', n: 3 }]] });
T('volcanoHeart', 'ember', 5, 'Heart of the Volcano', 'Your burn never fades, but you apply 15% less of it.', { burnDecay: Infinity, pct: { burn: -0.15 } });
T('ifritsBrand', 'ember', 5, "Ifrit's Brand", 'Your attacks also apply burn equal to 30% of their damage.', { dmgBurn: 0.3 });
T('wildfireTorch', 'ember', 5, 'Wildfire Torch', 'Your burn actions apply +1. Your burn ignores shield and its ticks deal 60% more.', { add: { burn: 1 }, burnPierce: true, burnTickPct: 0.6 });

// ---------------------------------------------------------------- coin: gold, crits
T('luckyPenny', 'coin', 2, 'Lucky Penny', 'Start each fight with 6 Luck.', { start: { luck: 6 } });
T('coinPurse', 'coin', 2, 'Coin Purse', '+1 gold after each fight.', { gold: 1 });
T('merchantsScale', 'coin', 2, "Merchant's Scale", 'Cards sell for +1 gold.', { sellBonus: 1 });
T('gildedRing', 'coin', 3, 'Gilded Ring', '+2 gold after each fight.', { gold: 2 });
T('bribePurse', 'coin', 3, 'Bribe Purse', "Enemy units start each fight with their cooldowns pushed back 0.6s.", { startDelay: 0.6 });
T('moneybagAmulet', 'coin', 3, 'Moneybag Amulet', 'Your attacks deal +1 damage per 8 gold you hold (max +3).', { dmgPerGold: 8, dmgPerGoldMax: 3 });
T('interestLedger', 'coin', 4, 'Interest Ledger', 'After each fight, gain 1 gold per 5 gold you hold (max 4).', { interest: 4 });
T('goldenIdol', 'coin', 4, 'Golden Idol', 'Start with 5 Luck. Your crits deal x2.5 instead of x2.', { start: { luck: 5 }, critMult: 0.5 });
T('hiredBlades', 'coin', 4, 'Hired Blades', 'Every 4s, deal 4 damage.', { every: [[4, { k: 'dmg', n: 4 }]] });
T('midasCrown', 'coin', 5, 'Midas Crown', '+4 max HP per gold you hold (max 80). +3 gold after each fight.', { hpPerGold: 80, hpGoldMult: 4, gold: 3 });
T('fortunesWheel', 'coin', 5, "Fortune's Wheel", 'Your units have +20% crit chance on top of Luck, and crits deal a quarter more.', { critChance: 0.2, critMult: 0.25 });
T('philosophersCoin', 'coin', 5, "Philosopher's Coin", 'Combining costs 1 less gold, and forging trinkets is free.', { combineDiscount: 1, freeForge: true });

// ---------------------------------------------------------------- sand: misses
T('hourglassCharm', 'sand', 2, 'Hourglass Charm', 'The enemy starts each fight with 3 Sand.', { startEnemy: { sand: 3 } });
T('duneScarf', 'sand', 2, 'Dune Scarf', 'Whenever an enemy misses, a random unit of yours jumps ahead 0.5s.', { onEnemyMiss: [{ k: 'charge', s: 0.5 }] });
T('mirageBead', 'sand', 2, 'Mirage Bead', 'Whenever an enemy misses, gain 2 shield.', { onEnemyMiss: [{ k: 'shield', n: 2 }] });
T('sandstormJar', 'sand', 3, 'Sandstorm Jar', 'Every 5s, apply 2 Sand.', { every: [[5, { k: 'sand', n: 2 }]] });
T('desertCompass', 'sand', 3, 'Desert Compass', 'The enemy starts with 3 Sand, and Sand can make them miss up to 45% of the time (normally 30%).', { startEnemy: { sand: 3 }, sandCap: 0.15 });
T('scarabBrooch', 'sand', 3, 'Scarab Brooch', 'Whenever an enemy misses, deal 4 damage.', { onEnemyMiss: [{ k: 'dmg', n: 4 }] });
T('pharaohsAnkh', 'sand', 4, "Pharaoh's Ankh", 'Whenever an enemy misses, heal 5.', { onEnemyMiss: [{ k: 'heal', n: 5 }], startEnemy: { sand: 2 } });
T('glassEye', 'sand', 4, 'Glass Eye', 'The enemy starts with 2 Sand. Your units get +2.5% crit chance per Sand on the enemy.', { startEnemy: { sand: 2 }, critPerSand: 0.025 });
T('sphinxRiddle', 'sand', 4, "Sphinx's Riddle", 'The enemy starts with 3 Sand, and each Sand gives 3.5% miss chance instead of 2%.', { startEnemy: { sand: 3 }, sandMiss: 0.015 });
T('simoomEye', 'sand', 5, 'Eye of the Simoom', 'The enemy starts with 3 Sand. Whenever they miss, apply 1 Sand and 3 burn and deal 2 damage.', { startEnemy: { sand: 3 }, onEnemyMiss: [{ k: 'sand', n: 1 }, { k: 'burn', n: 3 }, { k: 'dmg', n: 2 }] });
T('sandsOfTime', 'sand', 5, 'Sands of Time', 'The enemy starts with 4 Sand. Enemy units act 15% slower for every 6 Sand on them (max 45%).', { startEnemy: { sand: 4 }, sandSlow: 6 });
T('mummysWrap', 'sand', 5, "Mummy's Wrap", 'The enemy starts with 4 Sand. Your burn and poison actions apply +1 per 3 Sand on the enemy (max +4).', { startEnemy: { sand: 4 }, sandFuel: 3 });

// ---------------------------------------------------------------- mushroom: poison
T('toadstoolCap', 'mushroom', 2, 'Toadstool Cap', 'Your poison actions apply +1 poison.', { add: { poison: 1 } });
T('sporePouch', 'mushroom', 2, 'Spore Pouch', 'The enemy starts each fight with 2 poison.', { startEnemy: { poison: 2 } });
T('myceliumThread', 'mushroom', 2, 'Mycelium Thread', 'The enemy starts with 1 poison. Heal 20% of the poison damage you deal.', { startEnemy: { poison: 1 }, leech: { poison: 0.2 } });
T('jadestoneSnake', 'mushroom', 3, 'Jadestone Snake', 'You apply 25% more poison.', { pct: { poison: 0.25 } });
T('fungalRing', 'mushroom', 3, 'Fungal Ring', 'Every 7s, apply 2 poison.', { every: [[7, { k: 'poison', n: 2 }]] });
T('sicklyCenser', 'mushroom', 3, 'Sickly Censer', 'Enemy heals are 40% weaker. Every 8s, apply 1 poison.', { enemyHealCut: 0.4, every: [[8, { k: 'poison', n: 1 }]] });
T('plagueMask', 'mushroom', 4, 'Plague Mask', 'Your poison ticks 50% faster.', { poisonRate: 0.5 });
T('witchsCauldron', 'mushroom', 4, "Witch's Cauldron", 'Whenever you heal, apply poison equal to 10% of it (at least 1).', { onHealPoison: 0.1 });
T('rotLantern', 'mushroom', 4, 'Rot Lantern', 'Your poison ticks deal 35% more.', { poisonTickPct: 0.35 });
T('blightHeart', 'mushroom', 5, 'Heart of the Blight', 'The enemy starts with 3 poison. Each time your poison ticks, it grows by 20% (at least 1).', { startEnemy: { poison: 3 }, poisonGrow: 0.2 });
T('mycelialCrown', 'mushroom', 5, 'Mycelial Crown', 'Heal 35% of the poison damage you deal. Your poison actions apply +1.', { leech: { poison: 0.35 }, add: { poison: 1 } });
T('venomChalice', 'mushroom', 5, 'Venom Chalice', 'Your poison actions apply +1. Enemy attacks deal 1 less damage per 6 poison on them (max 5 less).', { add: { poison: 1 }, poisonWeaken: 6 });

// ---------------------------------------------------------------- feather: speed
T('quillCharm', 'feather', 2, 'Quill Charm', 'Your units act 6% faster.', { haste: 0.06 });
T('gullFeather', 'feather', 2, 'Gull Feather', 'Your units start each fight 30% charged.', { charge: 0.3 });
T('swiftPlume', 'feather', 2, 'Swift Plume', 'Your units act 4% faster, and your attacks deal +2 against a shielded enemy.', { haste: 0.04, vsShieldAdd: 2 });
T('falconHood', 'feather', 3, 'Falcon Hood', 'Your units act 9% faster.', { haste: 0.09 });
T('windChime', 'feather', 3, 'Wind Chime', "Every 4s, a random unit's cooldown jumps ahead 0.6s.", { every: [[4, { k: 'charge', s: 0.6 }]] });
T('hawkTalon', 'feather', 3, 'Hawk Talon', 'Half of your attack damage ignores shield, and your attacks deal +1 against a shielded enemy.', { pierceFrac: 0.5, vsShieldAdd: 1 });
T('rocsPinion', 'feather', 4, "Roc's Pinion", 'Your units start each fight 60% charged.', { charge: 0.6 });
T('tempestFan', 'feather', 4, 'Tempest Fan', 'Freezes on your units are half as long. Your units act 8% faster.', { freezeResist: 0.5, haste: 0.08 });
T('stormKite', 'feather', 4, 'Storm Kite', 'Whenever one of your units acts, the unit to its right jumps ahead 0.4s.', { chain: 0.4 });
T('phoenixPlume', 'feather', 5, 'Phoenix Plume', 'Once per fight, when you would fall, rise again with 20% HP and 15 Heat.', { revive: 0.2, reviveHeat: 15 });
T('zephyrCrown', 'feather', 5, 'Zephyr Crown', 'Your units act 20% faster, and their speed cap rises from +50% to +80%.', { haste: 0.2, hasteCap: 0.3 });
T('wingsOfIcarus', 'feather', 5, 'Wings of Icarus', 'Your units act 30% faster, but you lose 2 HP every 2s.', { haste: 0.3, hasteCap: 0.1, every: [[2, { k: 'selfDmg', n: 2 }]] });

// ---------------------------------------------------------------- crystal: freeze, magic
T('frostShard', 'crystal', 2, 'Frost Shard', 'The enemy starts with 2 Cold. Your freezes last 35% longer.', { startEnemy: { cold: 2 }, pct: { freeze: 0.35 } });
T('prismChip', 'crystal', 2, 'Prism Chip', '+5% rare chance when combining.', { rareOdds: 5 });
T('rimeBead', 'crystal', 2, 'Rime Bead', 'The enemy starts each fight with 4 Cold.', { startEnemy: { cold: 4 } });
T('glacialLens', 'crystal', 3, 'Glacial Lens', 'Your freezes last 50% longer.', { pct: { freeze: 0.5 } });
T('hoarfrostCharm', 'crystal', 3, 'Hoarfrost Charm', 'Every 4s, freeze a random enemy unit for 1s.', { every: [[4, { k: 'freeze', dur: 1 }]] });
T('shatterGem', 'crystal', 3, 'Shatter Gem', 'Your attacks deal 35% more while any enemy unit is frozen.', { frozenVuln: 0.35 });
T('seersOrb', 'crystal', 4, "Seer's Orb", '+12% rare chance when combining. Start each fight with 4 Luck.', { rareOdds: 12, start: { luck: 4 } });
T('iceCrown', 'crystal', 4, 'Ice Crown', 'Whenever you freeze a unit, apply 1 Cold.', { onFreeze: [{ k: 'cold', n: 1 }] });
T('frozenHeart', 'crystal', 4, 'Frozen Heart', "Your units can't be frozen. Start with 20 shield.", { freezeImmune: true, start: { shield: 20 } });
T('wintersGrasp', 'crystal', 5, "Winter's Grasp", 'Your freezes last 30% longer and each one deals 6 damage.', { pct: { freeze: 0.3 }, onFreeze: [{ k: 'dmg', n: 6 }] });
T('starfallPrism', 'crystal', 5, 'Starfall Prism', 'Every 4s, a random unit of yours casts its action again.', { every: [[4, { k: 'recast' }]] });
T('mirrorOfEternity', 'crystal', 5, 'Mirror of Eternity', 'Every 4th action of yours happens twice.', { echo: 4 });

// ---------------------------------------------------------------- moonstone: low HP, night
T('moonCharm', 'moonstone', 2, 'Moon Charm', 'Below half HP, your units act 10% faster.', { lowHaste: 0.1 });
T('nightBloom', 'moonstone', 2, 'Night Bloom', 'The first time you drop below half HP, gain 15 shield.', { lastStand: [[0.5, { k: 'shield', n: 15 }]] });
T('wolfsbaneSprig', 'moonstone', 2, 'Wolfsbane Sprig', 'Your wolves deal +1 damage.', { kinAdd: [{ kin: 'wolf', k: 'dmg', n: 1 }] });
T('lunarTear', 'moonstone', 3, 'Lunar Tear', 'Your attacks deal +1 damage per 50 HP you are missing (max +2).', { missingDmg: 50, missingDmgMax: 2 });
T('eclipsePendant', 'moonstone', 3, 'Eclipse Pendant', 'The first time you drop below 40% HP, heal 25.', { lastStand: [[0.4, { k: 'heal', n: 25 }]] });
T('howlingTotem', 'moonstone', 3, 'Howling Totem', 'Your creatures act 12% faster.', { creatureHaste: 0.12 });
T('bloodMoonIdol', 'moonstone', 4, 'Blood Moon Idol', 'Below half HP, your attacks deal 45% more.', { lowDmgPct: 0.45 });
T('silverCrescent', 'moonstone', 4, 'Silver Crescent', 'Below half HP, heal 30% of the attack damage you deal.', { lowLeech: 0.3 });
T('werewolfFang', 'moonstone', 4, 'Werewolf Fang', 'Below half HP, your creatures act 25% faster and deal +1 damage.', { lowCreature: { haste: 0.25, dmg: 1 } });
T('eclipseCrown', 'moonstone', 5, 'Crown of the Eclipse', 'You start fights at 70% HP, but your units act 30% faster and attack for 30% more.', { startHp: 0.7, haste: 0.3, hasteCap: 0.1, pct: { dmg: 0.3 } });
T('nightmareLantern', 'moonstone', 5, 'Nightmare Lantern', 'At 75%, 50% and 25% HP: gain 12 shield and freeze every enemy unit for 0.8s.', { lastStand: [[0.75, { k: 'shield', n: 12 }, { k: 'freezeAll', dur: 0.8 }], [0.5, { k: 'shield', n: 12 }, { k: 'freezeAll', dur: 0.8 }], [0.25, { k: 'shield', n: 12 }, { k: 'freezeAll', dur: 0.8 }]] });
T('selenesMirror', 'moonstone', 5, "Selene's Mirror", 'Below half HP, 45% of the attack damage you take is dealt back.', { lowReflect: 0.45 });

// ---------------------------------------------------------------- ice: Cold and shatter
T('snowflakeBrooch', 'ice', 2, 'Snowflake Brooch', 'The enemy starts each fight with 3 Cold.', { startEnemy: { cold: 3 } });
T('icicleCharm', 'ice', 2, 'Icicle Charm', 'Every 7s, freeze a random enemy unit for 0.5s. Your attacks deal 15% more while any enemy unit is frozen.', { every: [[7, { k: 'freeze', dur: 0.5 }]], frozenVuln: 0.15 });
T('frostWard', 'ice', 2, 'Frost Ward', 'Start with 10 shield. Freezes on your units are 25% shorter.', { start: { shield: 10 }, freezeResist: 0.25 });
T('chillwindHorn', 'ice', 3, 'Chillwind Horn', 'Every 6s, apply 2 Cold.', { every: [[6, { k: 'cold', n: 2 }]] });
T('rimecrustMail', 'ice', 3, 'Rimecrust Mail', 'Start with 10 shield. The enemy starts with 2 Cold.', { start: { shield: 10 }, startEnemy: { cold: 2 } });
T('permafrostSeal', 'ice', 3, 'Permafrost Seal', 'The enemy starts with 2 Cold, and Cold can slow them by up to 75% (normally 50%).', { startEnemy: { cold: 2 }, coldCap: 0.25 });
T('glacialHeart', 'ice', 4, 'Glacial Heart', "Start with 15 shield. Cold can't slow your units.", { start: { shield: 15 }, coldImmune: true });
T('avalancheDrum', 'ice', 4, 'Avalanche Drum', 'Every 6s, deal damage equal to the Cold on the enemy.', { every: [[6, { k: 'detonateCold' }]] });
T('frostbiteFang', 'ice', 4, 'Frostbite Fang', 'Your attacks deal +1 damage per 4 Cold on the enemy (max +4).', { coldDmg: 4, coldDmgMax: 4 });
T('heartOfWinter', 'ice', 5, 'Heart of Winter', 'The enemy starts with 6 Cold and gains 1 more every 3s.', { startEnemy: { cold: 6 }, every: [[3, { k: 'cold', n: 1 }]] });
T('absoluteZero', 'ice', 5, 'Absolute Zero', 'Every 5s, if the enemy has 15+ Cold, freeze every enemy unit for 1s. Every 4s, apply 2 Cold.', { every: [[5, { k: 'freezeAll', dur: 1, minCold: 15 }], [4, { k: 'cold', n: 2 }]] });
T('shatterglassCrown', 'ice', 5, 'Shatterglass Crown', 'Your attacks deal 40% more while any enemy unit is frozen, and each freeze deals 4 damage.', { frozenVuln: 0.4, onFreeze: [{ k: 'dmg', n: 4 }] });

export const TRINKET_IDS = Object.keys(TRINKETS);

// trinkets by resource and stack size
export const TK_BY = {};
for (const t of Object.values(TRINKETS)) {
  TK_BY[t.res] ??= {};
  (TK_BY[t.res][t.size] ??= []).push(t.id);
}

// Merge the modifiers of several trinkets: numbers add, lists join, nested
// objects merge. A few keys take the strongest instead of adding.
const STRONGEST_MIN = new Set(['confuse', 'echo']);
const STRONGEST_MAX = new Set(['burnDecay', 'revive', 'startHp']);
export function aggregate(ids) {
  const out = {};
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (Array.isArray(v)) dst[k] = [...(dst[k] || []), ...v];
      else if (v && typeof v === 'object') merge((dst[k] ??= {}), v);
      else if (typeof v === 'boolean') dst[k] = dst[k] || v;
      else if (STRONGEST_MIN.has(k)) dst[k] = dst[k] ? Math.min(dst[k], v) : v;
      else if (STRONGEST_MAX.has(k)) dst[k] = k === 'startHp' ? Math.min(dst[k] ?? 1, v) : Math.max(dst[k] || 0, v);
      else dst[k] = (dst[k] || 0) + v;
    }
  };
  for (const id of ids) if (TRINKETS[id]) merge(out, TRINKETS[id].m);
  return out;
}

// Sanity check at load: every resource has 3 trinkets at each size.
for (const [res, bySize] of Object.entries(TK_BY)) {
  for (let n = 2; n <= MAX_STACK; n++) if ((bySize[n] || []).length !== 3) throw new Error(`Trinkets: ${res} x${n} has ${(bySize[n] || []).length}`);
}
