// Particles, projectiles and floating numbers. Everything is a short-lived
// object updated each frame and removed when done.
import * as THREE from 'three';
import * as D from './draw.js';
import { canvasTexture } from './world.js';

export const KIND_COLOR = {
  dmg: '#fff7e6', burn: '#ff9a4a', poison: '#9fd05f', heal: '#ff8f86', shield: '#8fbfee', sand: '#e8c98f',
  freeze: '#bfe9ff', cold: '#bfe9ff', heat: '#ffb347', luck: '#8fd07a', bless: '#ffd84d', sudden: '#e05050', thorns: '#d9c08a',
  gold: '#f2c64a', miss: '#ffffff', charge: '#ffe066',
};

export function createFx(scene) {
  const items = [];
  const texCache = new Map();
  const getTex = (key, draw) => {
    if (!texCache.has(key)) texCache.set(key, canvasTexture(draw()));
    return texCache.get(key);
  };
  const puffTex = () => getTex('puff', D.drawPuff);
  const sparkTex = (c = '#f6cf4f') => getTex(`spark:${c}`, () => D.drawSpark(c));

  function sprite(map, { x, y, z, s = 1, opacity = 1, order = 10, depthTest = true }) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity, depthTest, depthWrite: false }));
    m.position.set(x, y, z);
    m.scale.set(s, s, 1);
    m.renderOrder = order;
    scene.add(m);
    return m;
  }

  function add(obj, life, tick) {
    items.push({ obj, life, age: 0, tick });
  }

  // Rising number, e.g. "-12" in a kind colour.
  function number(pos, text, kind = 'dmg', { big = false, dx = 0, icon = null } = {}) {
    const color = KIND_COLOR[kind] || '#fff';
    const map = getTex(`n:${text}:${color}:${icon}`, () => D.drawNumber(text, color, 96, icon));
    const aspect = map.image.width / map.image.height;
    const s = big ? 1.5 : 1.0;
    const m = sprite(map, { x: pos.x + dx + (Math.random() - 0.5) * 0.9, y: pos.y + 0.5 + Math.random() * 0.3, z: pos.z, s, order: 30, depthTest: false });
    m.scale.set(s * aspect, s, 1);
    const vx = (Math.random() - 0.5) * 0.6;
    add(m, 1.0, (it, dt) => {
      const u = it.age / it.life;
      m.position.y += dt * (1.6 - u * 1.4);
      m.position.x += vx * dt;
      const pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.55 : 1.15 - Math.min(0.15, (u - 0.12));
      m.scale.set(s * aspect * pop, s * pop, 1);
      m.material.opacity = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    });
  }

  function label(pos, text, color = '#fff', size = 1.1, icon = null) {
    const map = getTex(`l:${text}:${color}:${icon}`, () => D.drawNumber(text, color, 64, icon));
    const aspect = map.image.width / map.image.height;
    const m = sprite(map, { x: pos.x, y: pos.y + 0.5, z: pos.z, s: size, order: 30, depthTest: false });
    m.scale.set(size * aspect, size, 1);
    add(m, 1.1, (it, dt) => {
      const u = it.age / it.life;
      m.position.y += dt * 0.9;
      m.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    });
  }

  function puffs(pos, { n = 8, spread = 0.8, s = 0.45, color = null, up = 1.2, life = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const m = sprite(puffTex(), { x: pos.x, y: pos.y + 0.15, z: pos.z, s: s * (0.7 + Math.random() * 0.6), order: 20 });
      if (color) m.material.color.set(color);
      const v = new THREE.Vector3(Math.cos(a) * spread * (0.8 + Math.random()), up * (0.5 + Math.random()), Math.sin(a) * spread * (0.8 + Math.random()));
      const s0 = m.scale.x;
      add(m, life * (0.8 + Math.random() * 0.4), (it, dt) => {
        const u = it.age / it.life;
        m.position.addScaledVector(v, dt * (1 - u));
        const k = s0 * (1 - u * u);
        m.scale.set(k, k, 1);
      });
    }
  }

  function sparkles(pos, { n = 10, color = '#f6cf4f', spread = 1.2, s = 0.35, life = 0.9 } = {}) {
    for (let i = 0; i < n; i++) {
      const m = sprite(sparkTex(color), { x: pos.x, y: pos.y + 0.2, z: pos.z, s, order: 25 });
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * spread * Math.random(), 1 + Math.random() * 2, Math.sin(a) * spread * Math.random());
      const s0 = s * (0.6 + Math.random() * 0.8);
      add(m, life * (0.7 + Math.random() * 0.5), (it, dt) => {
        const u = it.age / it.life;
        v.y -= dt * 3;
        m.position.addScaledVector(v, dt);
        const k = s0 * Math.sin(Math.PI * Math.min(1, u * 1.2));
        m.scale.set(k, k, 1);
        m.material.rotation += dt * 3;
      });
    }
  }

  const ballGeo = new THREE.SphereGeometry(0.13, 12, 10);
  const inkMat = new THREE.MeshBasicMaterial({ color: D.INK, side: THREE.BackSide });

  function projectile(from, to, kind = 'dmg', { arc = 2.2, dur = 0.38, size = 1, onHit = null } = {}) {
    const color = KIND_COLOR[kind] || '#fff';
    const g = new THREE.Group();
    const ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color }));
    const rim = new THREE.Mesh(ballGeo, inkMat);
    rim.scale.setScalar(1.35);
    g.add(ball, rim);
    g.scale.setScalar(size);
    g.position.copy(from);
    scene.add(g);
    const p0 = from.clone();
    const p2 = to.clone();
    const p1 = p0.clone().lerp(p2, 0.5);
    p1.y += arc;
    let trail = 0;
    add(g, dur, (it, dt) => {
      const u = Math.min(1, it.age / it.life);
      const a = p0.clone().lerp(p1, u);
      const b = p1.clone().lerp(p2, u);
      g.position.copy(a.lerp(b, u));
      trail += dt;
      if (trail > 0.03) {
        trail = 0;
        const m = sprite(puffTex(), { x: g.position.x, y: g.position.y, z: g.position.z, s: 0.22 * size, order: 15 });
        m.material.color.set(color);
        add(m, 0.3, (t2) => {
          const k = 0.22 * size * (1 - t2.age / t2.life);
          m.scale.set(k, k, 1);
        });
      }
      if (it.age >= it.life) onHit?.();
    });
  }

  // Wiggle a ring on the floor (shield hit, landing).
  const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  function ring(pos, color = '#fff', { r = 1.4, life = 0.45 } = {}) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.03, pos.z);
    scene.add(m);
    add(m, life, (it) => {
      const u = it.age / it.life;
      const k = r * (0.4 + u);
      m.scale.set(k, k, k);
      m.material.opacity = 1 - u;
    });
  }

  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.age += dt;
      it.tick?.(it, dt);
      if (it.age >= it.life) {
        scene.remove(it.obj);
        it.obj.traverse?.((o) => { if (o.material && o.material !== inkMat) o.material.dispose(); });
        items.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const it of items) scene.remove(it.obj);
    items.length = 0;
  }

  return { number, label, puffs, sparkles, projectile, ring, update, clear };
}

// Persistent per-fortress status visuals: shield dome and drifting motes.
export function createFortressFx(scene, tower) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#9cc8f2', transparent: true, opacity: 0, depthWrite: false }),
  );
  const domeRim = new THREE.Mesh(
    new THREE.RingGeometry(1.52, 1.66, 48),
    new THREE.MeshBasicMaterial({ color: '#5d93c9', transparent: true, opacity: 0, depthWrite: false }),
  );
  domeRim.rotation.x = -Math.PI / 2;
  domeRim.position.y = 0.02;
  g.add(dome, domeRim);
  g.position.copy(tower.position);
  scene.add(g);

  let pulse = 0;
  let shield = 0;
  return {
    hit() { pulse = 1; },
    set(s) { shield = s; },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 3);
      const k = shield > 0 ? Math.min(1.25, 0.9 + Math.log10(1 + shield) * 0.2) : 0.6;
      const goal = shield > 0 ? 0.22 + pulse * 0.25 : 0;
      dome.material.opacity += (goal - dome.material.opacity) * (1 - Math.exp(-dt * 8));
      domeRim.material.opacity = Math.min(1, dome.material.opacity * 3);
      dome.scale.setScalar(k * (1 + pulse * 0.08));
      domeRim.scale.setScalar(k * (1 + pulse * 0.08));
      dome.visible = dome.material.opacity > 0.01;
      domeRim.visible = dome.visible;
    },
    reset() { shield = 0; pulse = 0; dome.material.opacity = 0; },
  };
}
