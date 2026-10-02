// Procedural low-poly unit models with ink outlines, built from primitives.
// Each returns { root, rig } where rig holds the parts the animator moves.
import * as THREE from 'three';

const INK = new THREE.MeshBasicMaterial({ color: '#2a241c', side: THREE.BackSide });
const mats = new Map();
const mat = (color) => {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
};

const geo = {
  head: new THREE.SphereGeometry(0.16, 14, 10),
  torso: new THREE.CylinderGeometry(0.15, 0.19, 0.36, 10),
  bulkyTorso: new THREE.CylinderGeometry(0.19, 0.23, 0.38, 10),
  leg: new THREE.BoxGeometry(0.1, 0.24, 0.11).translate(0, -0.12, 0),
  arm: new THREE.BoxGeometry(0.08, 0.24, 0.08).translate(0, -0.11, 0),
  hat: new THREE.ConeGeometry(0.21, 0.13, 14),
  band: new THREE.CylinderGeometry(0.165, 0.17, 0.05, 14),
  helmet: new THREE.SphereGeometry(0.175, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  hood: new THREE.ConeGeometry(0.19, 0.3, 12),
  shield: new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14).rotateZ(Math.PI / 2),
  boss: new THREE.SphereGeometry(0.05, 8, 6),
  blade: new THREE.BoxGeometry(0.035, 0.42, 0.07).translate(0, 0.21, 0),
  guard: new THREE.BoxGeometry(0.05, 0.03, 0.18),
  stick: new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6),
  tine: new THREE.BoxGeometry(0.015, 0.12, 0.015),
  bow: new THREE.TorusGeometry(0.24, 0.022, 6, 16, Math.PI * 1.1).rotateZ(-Math.PI * 0.55),
  quiver: new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8),
  shadow: new THREE.CircleGeometry(0.3, 16),
};

function part(g, color, outline = 1.12) {
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  const o = new THREE.Mesh(g, INK);
  o.scale.setScalar(outline);
  m.add(o);
  return m;
}

const SKIN = '#f0d0a8';

export function makeUnitModel(type, team) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const bulky = type === 'warrior';
  const scale = bulky ? 1.12 : 1;

  const legL = part(geo.leg, '#5a4a3c');
  const legR = part(geo.leg, '#5a4a3c');
  legL.position.set(0, 0.24, -0.07);
  legR.position.set(0, 0.24, 0.07);
  const torso = part(bulky ? geo.bulkyTorso : geo.torso, team);
  torso.position.y = 0.42;
  const head = part(geo.head, SKIN);
  head.position.y = 0.73;
  const armL = part(geo.arm, team);
  const armR = part(geo.arm, team);
  armL.position.set(0, 0.57, -0.2 * (bulky ? 1.15 : 1));
  armR.position.set(0, 0.57, 0.2 * (bulky ? 1.15 : 1));
  body.add(legL, legR, torso, head, armL, armR);

  // eyes facing +x (units face along x)
  const eyeG = new THREE.SphereGeometry(0.022, 6, 4);
  for (const z of [-0.055, 0.055]) {
    const e = new THREE.Mesh(eyeG, new THREE.MeshBasicMaterial({ color: '#2a241c' }));
    e.position.set(0.145, 0.75, z);
    body.add(e);
  }

  const handR = new THREE.Group();
  handR.position.y = -0.22;
  armR.add(handR);
  const handL = new THREE.Group();
  handL.position.y = -0.22;
  armL.add(handL);

  if (type === 'villager') {
    const hat = part(geo.hat, '#e8c46a');
    hat.position.y = 0.88;
    const band = part(geo.band, team, 1.06);
    band.position.y = 0.82;
    body.add(hat, band);
    const fork = new THREE.Group();
    const stick = part(geo.stick, '#9b7651', 1.25);
    fork.add(stick);
    for (const z of [-0.04, 0, 0.04]) {
      const t = part(geo.tine, '#b9bfc7', 1.3);
      t.position.set(0, 0.4, z);
      fork.add(t);
    }
    fork.rotation.z = -0.25;
    fork.position.set(0.04, 0.1, 0);
    handR.add(fork);
  } else if (type === 'warrior') {
    const helm = part(geo.helmet, '#b9bfc7');
    helm.position.y = 0.76;
    const plume = part(new THREE.BoxGeometry(0.22, 0.08, 0.05), team, 1.15);
    plume.position.y = 0.95;
    body.add(helm, plume);
    const shield = part(geo.shield, '#c9a24a');
    shield.position.set(0.08, 0.02, -0.05);
    const boss = part(geo.boss, '#e8e2d0');
    boss.position.x = 0.04;
    shield.add(boss);
    handL.add(shield);
    const sword = new THREE.Group();
    sword.add(part(geo.blade, '#e4e8ec', 1.2));
    const g = part(geo.guard, '#8a6a3c', 1.3);
    sword.add(g);
    sword.rotation.z = -1.1;
    handR.add(sword);
  } else if (type === 'archer') {
    const hood = part(geo.hood, team);
    hood.position.y = 0.86;
    body.add(hood);
    const bow = part(geo.bow, '#8a5f3a', 1.3);
    bow.position.set(0.08, 0.02, 0);
    handL.add(bow);
    const quiver = part(geo.quiver, '#7a5a3a');
    quiver.position.set(-0.17, 0.5, 0.08);
    quiver.rotation.x = 0.3;
    body.add(quiver);
  }

  const shadow = new THREE.Mesh(geo.shadow, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  body.scale.setScalar(scale * 1.35);
  return { root, rig: { body, legL, legR, armL, armR, head } };
}

// Simple procedural animation: walk cycle, attack swing, death fall.
export function animateUnit(rig, { state, t, attackT, deadT, ranged }) {
  const { body, legL, legR, armL, armR } = rig;
  if (state === 'dead') {
    const k = Math.min(1, deadT / 0.35);
    body.rotation.z = (k * Math.PI) / 2.1;
    body.position.y = -Math.max(0, deadT - 1) * 0.5;
    return;
  }
  body.rotation.z = 0;
  body.position.y = 0;
  if (state === 'walk') {
    const s = Math.sin(t * 11);
    legL.rotation.z = s * 0.7;
    legR.rotation.z = -s * 0.7;
    armL.rotation.z = -s * 0.5;
    armR.rotation.z = s * 0.5;
    body.position.y = Math.abs(Math.cos(t * 11)) * 0.04;
  } else {
    legL.rotation.z *= 0.8;
    legR.rotation.z *= 0.8;
    armL.rotation.z = ranged ? -1.4 : -0.2;
  }
  // attackT counts up from 0 after each strike
  if (attackT < 0.35) {
    const k = attackT / 0.35;
    armR.rotation.z = ranged ? -1.4 + Math.sin(k * Math.PI) * 0.6 : -2.2 + k * 2.6;
  } else if (state !== 'walk') armR.rotation.z = ranged ? -1.4 : 0.2;
}
