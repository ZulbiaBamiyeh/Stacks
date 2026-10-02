// The fight field: a long board in the forest with a castle at each end.
// Renders a lane battle (src/proto/lanes.js) with 3D units, arrows and effects.
import * as THREE from 'three';
import * as D from './draw.js';
import { FIELD, slotZ } from '../proto/lanes.js';
import { makeUnitModel, animateUnit } from '../proto/models.js';

const TEAM = ['#d9644f', '#6c68ad'];

export function createBattlefield({ world, fx, sfx, origin = new THREE.Vector3(40, 0, -10) }) {
  const { scene } = world;
  const O = origin;
  const W = (x, z, y = 0) => new THREE.Vector3(O.x + x, y, O.z + z);

  world.makeBoard(O.x, O.z, FIELD.half * 2 + 3, FIELD.depth + 1.5, D.drawGrass({ base: '#b9cf92', tuft: 'rgba(90,110,55,0.4)', seed: 21 }));
  const towers = [
    world.makeTower(O.x - FIELD.castleX - 0.4, O.z, '#d06a5a', '#f2c64a'),
    world.makeTower(O.x + FIELD.castleX + 0.4, O.z, '#6f6ba6', '#e9e3d0'),
  ];
  for (const t of towers) t.scale.setScalar(1.05);

  const cardPos = (side, i) => W((side === 0 ? -1 : 1) * (FIELD.castleX - 2.3), slotZ(i));

  const units = new Map();
  const arrows = new Map();
  const hpGeo = new THREE.PlaneGeometry(1, 1);
  const arrowGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5).rotateZ(Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({ color: '#4a3826' });
  let battle = null;

  function makeView(u) {
    const { root, rig } = makeUnitModel(u.type, TEAM[u.side]);
    const size = 1 + 0.1 * ((u.tier || 1) - 1);
    root.scale.setScalar(size);
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(hpGeo, new THREE.MeshBasicMaterial({ color: '#2a241c', depthTest: false }));
    bg.scale.set(0.62, 0.11, 1);
    const fill = new THREE.Mesh(hpGeo.clone().translate(0.5, 0, 0), new THREE.MeshBasicMaterial({ color: u.side === 0 ? '#7ccf6a' : '#e8695d', depthTest: false }));
    fill.position.x = -0.29;
    fill.scale.set(0.58, 0.07, 1);
    bg.renderOrder = 40;
    fill.renderOrder = 41;
    bar.add(bg, fill);
    bar.position.y = 1.45;
    bar.visible = false;
    root.add(bar);
    scene.add(root);
    const p = W(u.x, u.z);
    root.position.copy(p);
    return { root, rig, bar, fill, atkT: 9, deadT: 0, t: Math.random() * 3, hitT: 0, pos: p.clone(), size };
  }

  function clear() {
    for (const v of units.values()) scene.remove(v.root);
    units.clear();
    for (const a of arrows.values()) scene.remove(a);
    arrows.clear();
    battle = null;
  }

  // hooks.onSpawn(side, slot) lets the caller bounce the spawner card.
  function handle(e, hooks = {}) {
    switch (e.type) {
      case 'spawn': {
        hooks.onSpawn?.(e.side, e.slot);
        const u = battle.units.find((x) => x.id === e.id);
        if (u) {
          const v = makeView(u);
          units.set(u.id, v);
          fx.puffs(v.pos, { n: 4, s: 0.25, spread: 0.5 });
        }
        break;
      }
      case 'attack': {
        const v = units.get(e.id);
        if (v) v.atkT = 0;
        if (!e.ranged) sfx.hit();
        break;
      }
      case 'shoot': {
        const a = new THREE.Mesh(arrowGeo, arrowMat);
        scene.add(a);
        arrows.set(e.id, a);
        sfx.shoot();
        break;
      }
      case 'land': {
        const a = arrows.get(e.id);
        if (a) { scene.remove(a); arrows.delete(e.id); }
        break;
      }
      case 'hit': {
        const v = units.get(e.id);
        if (v) { v.hitT = 0.15; v.bar.visible = true; }
        break;
      }
      case 'death': {
        const v = units.get(e.id);
        if (v) { v.bar.visible = false; fx.puffs(v.pos, { n: 5, s: 0.3, spread: 0.6 }); }
        break;
      }
      case 'castle': {
        const t = towers[e.side];
        const p = t.position.clone().setY(2.2);
        if (!e.siege) {
          fx.number(p, `-${e.amount}`, 'dmg', { dx: (Math.random() - 0.5) * 1.5 });
          fx.puffs(p.clone().setY(1.2), { n: 2, s: 0.3, spread: 0.8 });
          t.userData.kick = 1;
          sfx.hit();
        }
        break;
      }
      case 'end':
        fx.puffs(towers[1 - e.winner].position.clone().setY(1.5), { n: 20, spread: 2.2, s: 0.6 });
        break;
      default:
    }
  }

  function sync(dt) {
    for (const t of towers) {
      t.userData.kick = Math.max(0, (t.userData.kick || 0) - dt * 4);
      const k = t.userData.kick;
      t.scale.set(1.05 * (1 + k * 0.04), 1.05 * (1 - k * 0.07), 1.05 * (1 + k * 0.04));
    }
    if (!battle) return;
    const cam = world.camera;
    const seen = new Set();
    for (const u of battle.units) {
      let v = units.get(u.id);
      if (!v) { v = makeView(u); units.set(u.id, v); }
      seen.add(u.id);
      v.pos.lerp(W(u.x, u.z), 1 - Math.exp(-dt * 18));
      v.root.position.copy(v.pos);
      v.root.rotation.y = u.facing > 0 ? 0 : Math.PI;
      v.t += dt * (u.state === 'walk' ? u.T.speed / 1.6 : 1);
      v.atkT += dt;
      if (u.state === 'dead') v.deadT += dt;
      v.hitT = Math.max(0, v.hitT - dt);
      animateUnit(v.rig, { state: u.state, t: v.t, attackT: v.atkT, deadT: v.deadT, ranged: u.T.range > 1 });
      v.rig.body.scale.setScalar((u.type === 'warrior' ? 1.12 : 1) * 1.35 * (1 + v.hitT * 0.8));
      v.fill.scale.x = 0.58 * Math.max(0, u.hp / u.max);
      v.bar.quaternion.copy(cam.quaternion);
      if (u.state === 'dead' && v.deadT > 1.6) v.root.visible = false;
    }
    for (const [id, v] of units) if (!seen.has(id)) { scene.remove(v.root); units.delete(id); }
    for (const p of battle.projectiles) {
      const a = arrows.get(p.id);
      if (!a) continue;
      const k = Math.min(1, p.t / p.dur);
      a.position.copy(W(p.x, p.z, 0.75 + Math.sin(Math.PI * k) * 1.2));
      a.rotation.set(0, p.tx - p.sx > 0 ? 0 : Math.PI, Math.cos(Math.PI * k) * 0.9);
    }
  }

  return {
    origin: O, W, towers, cardPos, handle, sync, clear,
    start(b) { clear(); battle = b; },
    frame(view) {
      view.tilt = 0.72;
      world.frame(O.x, O.z + 1.2, FIELD.half * 2 + 3, FIELD.depth + 4);
    },
  };
}
