// Which unit each card sends into battle, and how strong it is.
// Placeholder until every card gets its own unit: cards map to one of the three
// prototype units by what they are, and get tougher with tier.
import { CARDS } from '../content.js';
import { UNIT_TYPES } from './lanes.js';

const RANGED = /archer|ranger|hawkeye|sharpshooter|scout|gambler|rogue|roller|catapult|siege|trebuchet|mage|witch|warlock|pyro|shaman|healer|druid|oracle|hexer|alchemist|keeper|caster|sorc|necromancer|herbalist|smokeweaver|dancer|doctor|trapper|watch/i;
const HEAVY = /knight|guard|warden|champion|paladin|spearman|bulwark|juggernaut|skeleton|mercenary|hunter|golem|titan|smith|clockwork|gearstorm/i;

export function unitTypeFor(def) {
  if (RANGED.test(def.name)) return 'archer';
  if (HEAVY.test(def.name)) return 'warrior';
  if (def.family === 'fairy' || def.family === 'spirit') return 'archer';
  if (def.family === 'golem' || def.family === 'scorpion') return 'warrior';
  if (def.family === 'thing') return def.main === 'shield' ? 'warrior' : 'archer';
  if (def.main === 'shield') return 'warrior';
  return 'villager';
}

// A wall entry ({ id, perm }) becomes a spawner spec for the lane battle.
export function spawnerFor(entry) {
  const def = entry && CARDS[entry.id];
  if (!def || def.kind !== 'unit') return null;
  const type = unitTypeFor(def);
  const base = UNIT_TYPES[type];
  const tier = def.rare ? 4 : Math.max(1, def.tier);
  const m = 1 + 0.4 * (tier - 1);
  return {
    type,
    card: def.id,
    tier,
    stats: {
      name: def.name,
      hp: Math.round(base.hp * m),
      dmg: Math.round(base.dmg * m) + (entry.perm || 0),
      spawn: +(base.spawn * (1 - 0.06 * (tier - 1))).toFixed(2),
    },
  };
}

export const castleHpFor = (day) => 150 + 30 * day;
