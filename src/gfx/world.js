// Scene, camera, board, towers and fixed shop furniture.
import * as THREE from 'three';
import * as D from './draw.js';

export const CARD = { w: 1.1, h: 1.5, t: 0.04, r: 0.1 };

// Phones held upright get a tall board (picked once at load; rotating
// the phone reloads into the other layout between fights).
export const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.1;

const WIDE = {
  board: { x0: -9.3, x1: 9.3, z0: -6.15, z1: 6.15 },
  home: { x: 0, z: 0.15, w: 19.4, h: 13.0 },
  shopZ: -4.8,
  tile: { w: 1.3, h: 1.74 },
  sellX: -8.15,
  packX0: -6.6,
  packX1: 3.9,
  packStep: 1.45,
  shrine: { x: 6.95, z: -4.8, w: 3.0, h: 1.9 },
  market: { xs: [6.2, 7.7], zs: [-2.55, -0.55, 1.45], w: 1.38, h: 1.9, zone: { x0: 5.15, z1: 3.95 }, reroll: { x: 6.95, z: 3.15, w: 3.0, h: 1.0 } },
  table: { x0: -8.9, x1: 5.25, z0: -1.55, z1: 3.05 },
  // where opened packs and new cards land on the table
  spots: { pack: [-6.5, -2.2], loot: [3.8, 0] },
  // trinket rack: five card slots on a velvet shelf under the pack row
  rack: { z: -2.72, x0: -3.45, step: 1.45, n: 5, band: { x0: -4.35, x1: 3.25, z0: -3.72, z1: -1.72 } },
  wall: { z: 4.6, x0: -4.3, step: 1.5, band: { x0: -5.4, x1: 4.3, z0: 3.45, z1: 5.8 } },
  tower: { x: -7.4, z: 4.35, plaque: [0, 1.45] },
  arena: { cz: -20, z0: -26.15, z1: -13.85, enemyZ: -22.45, playerZ: -17.55, enemyTowerZ: -24.55, playerTowerZ: -15.35, x0: -3.75, frame: { w: 19.4, h: 13.6 } },
};

const TALL = {
  board: { x0: -5.3, x1: 5.3, z0: -10.3, z1: 10.3 },
  home: { x: 0, z: 0.35, w: 10.9, h: 21.2 },
  shopZ: -9.0,
  tile: { w: 1.3, h: 1.74 },
  sellX: -4.4,
  packX0: -2.85,
  packX1: 4.45,
  packStep: 1.45,
  shrine: { x: -3.6, z: -6.8, w: 3.0, h: 1.9 },
  market: { xs: [-1.2, 0.25, 1.7, 3.15], zs: [-6.8, -4.85], w: 1.38, h: 1.9, zone: { x0: -2.0, z1: -3.8 }, reroll: { x: -3.6, z: -5.2, w: 3.0, h: 1.0 } },
  table: { x0: -5.05, x1: 5.05, z0: -1.45, z1: 5.15 },
  spots: { pack: [-3.6, -0.5], loot: [2.6, 1.5] },
  rack: { z: -2.6, x0: -2.9, step: 1.45, n: 5, band: { x0: -3.8, x1: 3.8, z0: -3.6, z1: -1.6 } },
  wall: { z: 6.7, x0: -3.75, step: 1.5, band: { x0: -4.85, x1: 4.85, z0: 5.55, z1: 7.9 } },
  tower: { x: -3.7, z: 9.05, plaque: [2.75, 0.05] },
  // further from the home board, so a tall screen's view of it stays clear
  arena: { cz: -24.5, z0: -32.1, z1: -16.9, enemyZ: -26.95, playerZ: -22.05, enemyTowerZ: -29.05, playerTowerZ: -19.85, x0: -3.75, frame: { w: 10.9, h: 16.4 } },
};

export const L = PORTRAIT ? TALL : WIDE;
export const wallX = (i) => L.wall.x0 + i * L.wall.step;
export const arenaX = (i) => L.arena.x0 + i * L.wall.step;
export const rackX = (i) => L.rack.x0 + i * L.rack.step;

const tex = (cv, { repeat = null, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
};
export { tex as canvasTexture };

export function roundedShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Flat face lying on XZ, facing +Y, UVs mapped 0..1 across the rect.
export function faceGeometry(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedShape(w, h, r), 6);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function slabGeometry(w, h, r, depth) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}

const INK = new THREE.Color(D.INK);

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#86b07c');
  scene.fog = new THREE.Fog('#86b07c', 60, 120);

  const camera = new THREE.PerspectiveCamera(21, 1, 0.5, 400);

  const hemi = new THREE.HemisphereLight('#fffaf0', '#c9d8b8', 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e2', 1.35);
  sun.position.set(-6, 20, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  sun.shadow.intensity = 0.55;
  scene.add(sun);
  scene.add(sun.target);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Ground: doodle forest all around.
  const forestTex = tex(D.drawForest(), { repeat: [16, 16], aniso: anisotropy });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: forestTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.32, -10);
  ground.receiveShadow = true;
  scene.add(ground);

  function makeBoard(cx, cz, w, d, grassCanvas) {
    const g = new THREE.Group();
    const grass = tex(grassCanvas, { repeat: [w / 6, d / 6], aniso: anisotropy });
    const side = new THREE.MeshLambertMaterial({ color: '#5f7d55' });
    const top = new THREE.MeshLambertMaterial({ map: grass });
    g.userData.top = top;
    g.userData.side = side;
    g.userData.repeat = [w / 6, d / 6];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), [side, side, top, side, side, side]);
    slab.position.y = -0.15;
    slab.receiveShadow = true;
    g.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.3, d + 0.22), new THREE.MeshBasicMaterial({ color: INK }));
    rim.position.y = -0.152;
    g.add(rim);
    // soft drop shadow under the board on the forest floor
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.4, d + 1.4), new THREE.MeshBasicMaterial({ color: '#2f4a2c', transparent: true, opacity: 0.18 }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(0.35, -0.31, 0.45);
    g.add(shade);
    g.position.set(cx, 0, cz);
    scene.add(g);
    return g;
  }

  const B = L.board;
  const home = makeBoard(0, 0, B.x1 - B.x0, B.z1 - B.z0, D.drawGrass());
  const A = L.arena;
  const arena = makeBoard(0, A.cz, B.x1 - B.x0, A.z1 - A.z0, D.drawGrass({ base: '#c6c98f', tuft: 'rgba(110,105,55,0.4)', seed: 8 }));

  // Repaint the land for a theme (meadow, flame, tomb, grove, caravan, forge, frost).
  let theme = 'meadow';
  renderer.localClippingEnabled = true;
  const swapMap = (mat, cv, repeat) => {
    const old = mat.map;
    mat.map = tex(cv, { repeat, aniso: anisotropy });
    mat.needsUpdate = true;
    old?.dispose();
  };
  function applyTheme(next, maps) {
    swapMap(ground.material, maps.ground, [16, 16]);
    swapMap(home.userData.top, maps.home, home.userData.repeat);
    swapMap(arena.userData.top, maps.arena, arena.userData.repeat);
    home.userData.side.color.set(D.THEMES[next].side);
    arena.userData.side.color.set(D.THEMES[next].side);
  }

  // The new land washes over the old one from the shrine's corner: a
  // clipping plane sweeps across copies of the board and forest painted in
  // the new theme, led by a band of light.
  const SWEEP_DIR = new THREE.Vector3(1, 0, -0.7).normalize(); // toward the shrine
  const SWEEP_FROM = -17;
  const SWEEP_TO = 17;
  let sweep = null;
  function finishSweep() {
    if (!sweep) return;
    applyTheme(sweep.next, sweep.maps);
    for (const m of [...sweep.overlays, sweep.edge, sweep.glow]) {
      scene.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    sweep = null;
  }
  function setTheme(next, { animate = false } = {}) {
    if (!D.THEMES[next] || next === theme) return;
    theme = next;
    const maps = { ground: D.drawThemeGround(next), home: D.drawThemeBoard(next), arena: D.drawThemeBoard(next, { arena: true }) };
    if (sweep) finishSweep();
    if (!animate) { applyTheme(next, maps); return; }
    const plane = new THREE.Plane(SWEEP_DIR.clone(), SWEEP_FROM);
    const overlay = (w, d, cv, repeat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex(cv, { repeat, aniso: anisotropy }), clippingPlanes: [plane] }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.renderOrder = -1;
      scene.add(m);
      return m;
    };
    const B2 = L.board;
    const overlays = [
      overlay(240, 240, maps.ground, [16, 16], 0, -0.315, -10),
      overlay(B2.x1 - B2.x0, B2.z1 - B2.z0, maps.home, home.userData.repeat, 0, 0.0012, 0),
      overlay(B2.x1 - B2.x0, A.z1 - A.z0, maps.arena, arena.userData.repeat, 0, 0.0012, A.cz),
    ];
    // the leading edge: a bright core line and a soft wide glow
    const band = (width, color, opacity) => {
      const geo = new THREE.PlaneGeometry(90, width);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      // long axis along the front, perpendicular to the sweep direction
      m.rotation.y = Math.atan2(-SWEEP_DIR.x, -SWEEP_DIR.z);
      m.renderOrder = 8;
      scene.add(m);
      return m;
    };
    const accent = { flame: '#ff9a4a', tomb: '#c9b8ff', grove: '#c8ff9a', caravan: '#ffe27a', forge: '#ffc28a', frost: '#cdefff', meadow: '#fff6c8' }[next] || '#fff6c8';
    const edge = band(0.18, '#ffffff', 0.85);
    const glow = band(1.6, accent, 0.4);
    sweep = { t: 0, dur: 2.4, plane, overlays, edge, glow, maps, next };
  }
  function updateTheme(dt) {
    if (!sweep) return;
    sweep.t += dt;
    const u = Math.min(1, sweep.t / sweep.dur);
    const k = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const c = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * k;
    sweep.plane.constant = c;
    // the plane's surface (n·p + c = 0) lies at p = -c n
    for (const m of [sweep.edge, sweep.glow]) m.position.set(-c * SWEEP_DIR.x, 0.03, -c * SWEEP_DIR.z);
    sweep.glow.material.opacity = 0.4 * Math.sin(Math.PI * u) + 0.1;
    if (u >= 1) finishSweep();
  }

  // Arena midline: a faint dashed ink line between the two walls.
  const midCv = D.canvas(2048, 64);
  {
    const c = midCv.getContext('2d');
    c.strokeStyle = 'rgba(42,36,28,0.22)';
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.setLineDash([46, 40]);
    c.beginPath(); c.moveTo(40, 32); c.lineTo(2008, 32); c.stroke();
  }
  const mid = new THREE.Mesh(new THREE.PlaneGeometry(16, 0.5), new THREE.MeshBasicMaterial({ map: tex(midCv), transparent: true, depthWrite: false }));
  mid.rotation.x = -Math.PI / 2;
  mid.position.set(0, 0.003, A.cz);
  scene.add(mid);

  // ---------------------------------------------------------------- props

  const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  function outlined(geo, color, scale = 1.06) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.castShadow = true;
    m.receiveShadow = true;
    const o = new THREE.Mesh(geo, outlineMat);
    o.scale.setScalar(scale);
    m.add(o);
    return m;
  }

  function makeTower(x, z, roof, flag) {
    const g = new THREE.Group();
    const stone = '#ddd5c0';
    const base = outlined(new THREE.CylinderGeometry(0.95, 1.05, 1.3, 20), stone, 1.045);
    base.position.y = 0.65;
    g.add(base);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = outlined(new THREE.BoxGeometry(0.32, 0.3, 0.3), stone, 1.15);
      m.position.set(Math.cos(a) * 0.86, 1.42, Math.sin(a) * 0.86);
      m.rotation.y = -a;
      g.add(m);
    }
    const top = outlined(new THREE.ConeGeometry(0.98, 1.25, 20), roof, 1.05);
    top.position.y = 2.0;
    g.add(top);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), new THREE.MeshBasicMaterial({ color: INK }));
    pole.position.y = 2.95;
    g.add(pole);
    const banner = outlined(new THREE.BoxGeometry(0.5, 0.3, 0.03), flag, 1.12);
    banner.position.set(0.27, 3.22, 0);
    g.add(banner);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#4a3b30' }));
    door.position.set(0, 0.12, 1.02);
    door.scale.y = 1.3;
    g.add(door);
    g.position.set(x, 0, z);
    g.userData.banner = banner;
    scene.add(g);
    return g;
  }

  const homeTower = makeTower(L.tower.x, L.tower.z, '#d06a5a', '#f2c64a');
  // Arena towers stand beside each wall; the health bars take the space behind the walls.
  const arenaPlayerTower = makeTower(-7.7, A.playerZ, '#d06a5a', '#f2c64a');
  const arenaEnemyTower = makeTower(-7.7, A.enemyZ, '#6f6ba6', '#e9e3d0');
  arenaPlayerTower.scale.setScalar(0.9);
  arenaEnemyTower.scale.setScalar(0.9);
  arenaPlayerTower.visible = arenaEnemyTower.visible = !PORTRAIT;

  // Wall band + parapet
  const band = L.wall.band;
  const bw = band.x1 - band.x0;
  const bd = band.z1 - band.z0;
  const bandMesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), new THREE.MeshLambertMaterial({ map: tex(D.drawWallBand(Math.round(bw * 100), Math.round(bd * 100)), { aniso: anisotropy }), alphaTest: 0.5 }));
  bandMesh.rotation.x = -Math.PI / 2;
  bandMesh.position.set((band.x0 + band.x1) / 2, 0.002, (band.z0 + band.z1) / 2);
  bandMesh.receiveShadow = true;
  scene.add(bandMesh);
  const merlonGeo = new THREE.BoxGeometry(0.46, 0.3, 0.34);
  for (let x = band.x0 + 0.35; x < band.x1 - 0.2; x += 0.82) {
    const m = outlined(merlonGeo, '#d8d0bb', 1.12);
    m.position.set(x, 0.15, band.z0 + 0.05);
    scene.add(m);
  }
  // connecting wall from tower to band
  if (!PORTRAIT) {
    const link = outlined(new THREE.BoxGeometry(band.x0 - L.tower.x - 0.7, 0.45, 0.6), '#d8d0bb', 1.04);
    link.position.set((band.x0 + L.tower.x + 0.7) / 2 - 0.05, 0.22, L.tower.z);
    scene.add(link);
  }

  // Trinket rack
  {
    const rb = L.rack.band;
    const rw = rb.x1 - rb.x0;
    const rd = rb.z1 - rb.z0;
    const k = 100;
    const cvr = D.drawRackBand(Math.round(rw * k), Math.round(rd * k), L.rack.n, (CARD.w + 0.14) * k, (CARD.h + 0.14) * k, L.rack.step * k, (L.rack.x0 - rb.x0) * k);
    const rack = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), new THREE.MeshLambertMaterial({ map: tex(cvr, { aniso: anisotropy }), alphaTest: 0.5 }));
    rack.rotation.x = -Math.PI / 2;
    rack.position.set((rb.x0 + rb.x1) / 2, 0.002, (rb.z0 + rb.z1) / 2);
    rack.receiveShadow = true;
    scene.add(rack);
  }

  // Arena wall bands
  for (const [z, flip] of [[A.playerZ, 1], [A.enemyZ, -1]]) {
    const w2 = 6 * L.wall.step + 0.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w2, 2.4), new THREE.MeshLambertMaterial({ map: tex(D.drawWallBand(Math.round(w2 * 100), 240, z | 0)), alphaTest: 0.5 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(arenaX(2.5), 0.002, z);
    m.receiveShadow = true;
    scene.add(m);
    for (let x = arenaX(0) - 0.6; x < arenaX(5) + 0.8; x += 0.82) {
      const mm = outlined(merlonGeo, '#d8d0bb', 1.12);
      mm.position.set(x, 0.15, z - flip * 1.22);
      scene.add(mm);
    }
  }

  // ---------------------------------------------------------------- tiles

  const tileMat = new THREE.MeshLambertMaterial({ color: '#2b2724' });
  function makeTile(w, h, cv, { x, z, y = 0 } = {}) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(slabGeometry(w, h, 0.16, 0.06), tileMat);
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);
    const mat = new THREE.MeshLambertMaterial({ map: tex(cv, { aniso: anisotropy }), transparent: true });
    const face = new THREE.Mesh(faceGeometry(w, h, 0.16), mat);
    face.position.y = 0.062;
    face.receiveShadow = true;
    g.add(face);
    g.position.set(x, y, z);
    g.userData = { w, h, face, mat };
    scene.add(g);
    g.setCanvas = (c) => {
      mat.map.dispose();
      mat.map = tex(c, { aniso: anisotropy });
      mat.needsUpdate = true;
    };
    return g;
  }

  function makeDecal(w, h, cv, x, z, y = 0.004) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(cv, { aniso: anisotropy }), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 2;
    scene.add(m);
    m.setCanvas = (c) => {
      m.material.map.dispose();
      m.material.map = tex(c, { aniso: anisotropy });
      m.material.needsUpdate = true;
    };
    return m;
  }

  // ---------------------------------------------------------------- camera

  const view = {
    target: new THREE.Vector3(0, 0, 0.3),
    goal: new THREE.Vector3(0, 0, 0.3),
    dist: 30,
    goalDist: 30,
    zoom: 1,
    tilt: 0.3,
    shake: 0,
    frameW: 25,
    frameH: 16.6,
  };

  function fitDistance(w, h) {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const tanV = Math.tan(vfov / 2);
    // Portrait screens crop the sides (pan to see them) so cards stay readable.
    const fw = camera.aspect < 1 && !PORTRAIT ? w * Math.max(0.55, camera.aspect) : w;
    const dH = (h / 2) / tanV;
    const dW = (fw / 2) / (tanV * camera.aspect);
    return Math.max(dH, dW) * 1.02;
  }

  function frame(cx, cz, w, h) {
    view.goal.set(cx, 0, cz);
    view.frameW = w;
    view.frameH = h;
    view.goalDist = fitDistance(w, h);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.goalDist = fitDistance(view.frameW, view.frameH);
  }

  function updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 4.5);
    view.target.lerp(view.goal, k);
    view.dist += (view.goalDist * view.zoom - view.dist) * k;
    const sx = view.shake > 0 ? (Math.random() - 0.5) * view.shake : 0;
    const sz = view.shake > 0 ? (Math.random() - 0.5) * view.shake : 0;
    view.shake = Math.max(0, view.shake - dt * 1.6);
    camera.position.set(
      view.target.x + sx,
      view.target.y + view.dist * Math.cos(view.tilt),
      view.target.z + view.dist * Math.sin(view.tilt) + sz,
    );
    camera.lookAt(view.target.x + sx, 0, view.target.z + sz);
    scene.fog.near = view.dist + 12;
    scene.fog.far = view.dist + 90;
    sun.position.set(view.target.x - 6, 20, view.target.z + 9);
    sun.target.position.set(view.target.x, 0, view.target.z);
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function pointerRay(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  }
  function groundPoint(clientX, clientY, y = 0) {
    pointerRay(clientX, clientY);
    plane.constant = -y;
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  function toScreen(v) {
    const p = v.clone().project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  return {
    THREE, renderer, scene, camera, view, anisotropy, arena,
    towers: { home: homeTower, player: arenaPlayerTower, enemy: arenaEnemyTower },
    frame, resize, updateCamera, pointerRay, groundPoint, toScreen, makeTile, makeDecal, outlined, setTheme, updateTheme,
    render: () => renderer.render(scene, camera),
  };
}
