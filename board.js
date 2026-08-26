(() => {
  const CARD_W = 128;
  const CARD_H = 174;
  const PEEK = 56;
  const LIFT_SCALE = 1.085;
  const FOLLOW_TAU = 0.07;
  const SNAP_TAU = 0.048;
  const SCALE_K = 420;
  const SCALE_DAMP = 18;
  const ROT_K = 220;
  const ROT_DAMP = 16;
  const PICKUP_KICK = 2.1;
  const RELEASE_KICK = 1.85;
  const DROP_PAD = 18;
  const THROW_GAIN = 1.12;
  const THROW_LOOKBACK = 0.07;
  const FRICTION = 2.55;
  const RESTITUTION = 0.42;
  const STOP_SPEED = 48;
  const PLACE_SPEED = 560;
  const MAX_THROW = 3200;

  const ICONS = {
    wood: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <rect x="8" y="28" width="50" height="26" rx="8" fill="#c68648" stroke="#2c1810" stroke-width="3"/>
        <path d="M18 35h32M16 41h36M20 47h28" stroke="#2c1810" stroke-width="1.8" stroke-linecap="round" opacity="0.35"/>
        <ellipse cx="58" cy="41" rx="13" ry="14" fill="#e6c484" stroke="#2c1810" stroke-width="3"/>
        <ellipse cx="58" cy="41" rx="8" ry="8.5" fill="none" stroke="#2c1810" stroke-width="2"/>
        <ellipse cx="58" cy="41" rx="3.2" ry="3.4" fill="#c4a06a" stroke="#2c1810" stroke-width="1.6"/>
      </svg>`,
    berries: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <path d="M42 14c12 4 16 16 8 22-12-2-18-12-8-22z" fill="#5c8c45" stroke="#2c1810" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M40 22c0 8-6 12-6 12" fill="none" stroke="#2c1810" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="30" cy="46" r="13" fill="#c44c42" stroke="#2c1810" stroke-width="3"/>
        <circle cx="50" cy="44" r="12.5" fill="#d45a48" stroke="#2c1810" stroke-width="3"/>
        <circle cx="40" cy="58" r="12" fill="#b43e36" stroke="#2c1810" stroke-width="3"/>
        <circle cx="25" cy="41" r="3.2" fill="#f2c2b4"/>
        <circle cx="46" cy="39" r="2.8" fill="#f2c2b4"/>
        <circle cx="36" cy="54" r="2.4" fill="#e8a898"/>
      </svg>`,
    stone: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <path d="M14 48 18 30 34 18 58 20 68 36 62 56 36 62 18 58Z" fill="#b0b6be" stroke="#2c1810" stroke-width="3" stroke-linejoin="round"/>
        <path d="M22 44 30 28 48 24 54 40" fill="#9aa2ac" stroke="#2c1810" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M30 38 44 32 50 48" fill="none" stroke="#2c1810" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
      </svg>`,
    villager: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <rect x="31" y="58" width="7" height="12" rx="2.5" fill="#3a5c86" stroke="#2c1810" stroke-width="2.4"/>
        <rect x="42" y="58" width="7" height="12" rx="2.5" fill="#3a5c86" stroke="#2c1810" stroke-width="2.4"/>
        <rect x="25" y="40" width="30" height="24" rx="9" fill="#4a84b8" stroke="#2c1810" stroke-width="3"/>
        <path d="M18 46c8 2 10 8 10 8M62 46c-8 2-10 8-10 8" fill="none" stroke="#2c1810" stroke-width="2.8" stroke-linecap="round"/>
        <circle cx="40" cy="28" r="13" fill="#f0d4b0" stroke="#2c1810" stroke-width="3"/>
        <path d="M28 24c4-8 20-8 24 0" fill="#3f7eb5" stroke="#2c1810" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="35" cy="28" r="2.2" fill="#2c1810"/>
        <circle cx="45" cy="28" r="2.2" fill="#2c1810"/>
        <path d="M34 34c2.2 3.4 9.8 3.4 12 0" fill="none" stroke="#2c1810" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    tree: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <rect x="35" y="50" width="10" height="22" rx="2" fill="#8a5530" stroke="#2c1810" stroke-width="3"/>
        <circle cx="28" cy="42" r="14" fill="#4e7d38" stroke="#2c1810" stroke-width="3"/>
        <circle cx="52" cy="40" r="13" fill="#5d9344" stroke="#2c1810" stroke-width="3"/>
        <circle cx="40" cy="30" r="18" fill="#5a8f40" stroke="#2c1810" stroke-width="3"/>
        <circle cx="32" cy="28" r="3" fill="#3f6e30" opacity="0.45"/>
        <circle cx="48" cy="34" r="2.6" fill="#3f6e30" opacity="0.4"/>
      </svg>`,
    berrybush: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="50" r="20" fill="#3f6e34" stroke="#2c1810" stroke-width="3"/>
        <circle cx="24" cy="42" r="14" fill="#4e7d38" stroke="#2c1810" stroke-width="3"/>
        <circle cx="56" cy="44" r="13" fill="#5a8a40" stroke="#2c1810" stroke-width="3"/>
        <circle cx="40" cy="34" r="12" fill="#4a7838" stroke="#2c1810" stroke-width="3"/>
        <circle cx="30" cy="38" r="4.2" fill="#c44c42" stroke="#2c1810" stroke-width="2"/>
        <circle cx="48" cy="36" r="4" fill="#d45a48" stroke="#2c1810" stroke-width="2"/>
        <circle cx="40" cy="52" r="4" fill="#b43e36" stroke="#2c1810" stroke-width="2"/>
        <circle cx="54" cy="50" r="3.6" fill="#c44c42" stroke="#2c1810" stroke-width="2"/>
        <circle cx="26" cy="50" r="3.4" fill="#d45a48" stroke="#2c1810" stroke-width="2"/>
      </svg>`,
    towncentre: `
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <rect x="16" y="38" width="48" height="30" fill="#e8c4a0" stroke="#2c1810" stroke-width="3"/>
        <path d="M12 40 40 16 68 40" fill="#c45c32" stroke="#2c1810" stroke-width="3" stroke-linejoin="round"/>
        <rect x="35" y="48" width="10" height="20" rx="1.5" fill="#6a3c22" stroke="#2c1810" stroke-width="2.4"/>
        <rect x="22" y="46" width="10" height="10" fill="#7aabcc" stroke="#2c1810" stroke-width="2.2"/>
        <rect x="48" y="46" width="10" height="10" fill="#7aabcc" stroke="#2c1810" stroke-width="2.2"/>
        <path d="M40 16v-8" stroke="#2c1810" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M40 8h14l-4 6H40z" fill="#3f7eb5" stroke="#2c1810" stroke-width="2" stroke-linejoin="round"/>
      </svg>`,
  };

  const CATALOG = {
    wood: { name: "Wood", kind: "resource", icon: "wood" },
    berries: { name: "Berries", kind: "resource", icon: "berries" },
    stone: { name: "Stone", kind: "resource", icon: "stone" },
    villager: { name: "Villager", kind: "villager", icon: "villager" },
    tree: { name: "Tree", kind: "node", icon: "tree" },
    berrybush: { name: "Berry Bush", kind: "node", icon: "berrybush" },
    towncentre: { name: "Town Centre", kind: "building", icon: "towncentre" },
  };

  const LAYOUT = [
    { types: ["tree"], fx: 0.1, fy: 0.1, rot: -2.4 },
    { types: ["wood", "wood", "wood"], fx: 0.32, fy: 0.06, rot: 1.5 },
    { types: ["stone"], fx: 0.56, fy: 0.12, rot: -1.2 },
    { types: ["berries"], fx: 0.76, fy: 0.1, rot: 2.3 },
    { types: ["villager"], fx: 0.12, fy: 0.5, rot: -1.7 },
    { types: ["berrybush"], fx: 0.5, fy: 0.48, rot: 0.9 },
    { types: ["villager"], fx: 0.74, fy: 0.48, rot: 2.5 },
    { types: ["towncentre"], fx: 0.3, fy: 0.7, rot: -0.7 },
  ];

  const board = document.getElementById("board");
  const stacks = [];
  let zTop = 1;
  let drag = null;
  let lastT = performance.now();

  let nextId = 1;
  const uid = () => nextId++;

  function makeCard(type) {
    const def = CATALOG[type];
    return { id: uid(), type, name: def.name, kind: def.kind, icon: def.icon };
  }

  function stackHeight(n) {
    return (Math.max(n, 1) - 1) * PEEK + CARD_H;
  }

  function restRot() {
    return (Math.random() - 0.5) * 5;
  }

  function clampStack(stack) {
    const w = board.clientWidth;
    const h = board.clientHeight;
    const sh = stackHeight(stack.cards.length);
    stack.x = Math.min(Math.max(12, stack.x), Math.max(12, w - CARD_W - 12));
    stack.y = Math.min(Math.max(12, stack.y), Math.max(12, h - sh - 12));
  }

  function renderCards(stack) {
    stack.el.innerHTML = "";
    stack.el.style.height = `${stackHeight(stack.cards.length)}px`;
    stack.cards.forEach((card, i) => {
      const el = document.createElement("article");
      el.className = "card";
      el.dataset.kind = card.kind;
      el.dataset.index = String(i);
      el.dataset.id = String(card.id);
      el.style.top = `${i * PEEK}px`;
      el.style.zIndex = String(i + 1);
      el.innerHTML = `
        <div class="card-band"></div>
        <div class="card-name">${card.name}</div>
        <div class="card-art">${ICONS[card.icon]}</div>
      `;
      stack.el.appendChild(el);
    });
  }

  function applyTransform(stack) {
    const { x, y, rot, scale } = stack.vis;
    stack.el.style.left = `${x}px`;
    stack.el.style.top = `${y}px`;
    stack.el.style.transform = `rotate(${rot}deg) scale(${scale})`;
    stack.el.style.zIndex = String(stack.z);
  }

  function createStack(types, x, y, rot) {
    const stack = {
      id: uid(),
      cards: types.map(makeCard),
      x,
      y,
      rot,
      z: ++zTop,
      vx: 0,
      vy: 0,
      vis: { x, y, rot, scale: 1, scaleVel: 0, rotVel: 0 },
      el: document.createElement("div"),
    };
    stack.el.className = "stack";
    stack.el.dataset.stackId = String(stack.id);
    renderCards(stack);
    applyTransform(stack);
    board.appendChild(stack.el);
    stacks.push(stack);
    return stack;
  }

  function removeStack(stack) {
    stack.el.remove();
    const i = stacks.indexOf(stack);
    if (i >= 0) stacks.splice(i, 1);
  }

  function splitStack(stack, index) {
    if (index <= 0 || index >= stack.cards.length) return stack;
    const taken = stack.cards.splice(index);
    renderCards(stack);
    applyTransform(stack);
    const neu = {
      id: uid(),
      cards: taken,
      x: stack.vis.x,
      y: stack.vis.y + index * PEEK,
      rot: stack.vis.rot,
      z: ++zTop,
      vx: 0,
      vy: 0,
      vis: {
        x: stack.vis.x,
        y: stack.vis.y + index * PEEK,
        rot: stack.vis.rot,
        scale: stack.vis.scale,
        scaleVel: 0,
        rotVel: 0,
      },
      el: document.createElement("div"),
    };
    neu.el.className = "stack";
    neu.el.dataset.stackId = String(neu.id);
    renderCards(neu);
    applyTransform(neu);
    board.appendChild(neu.el);
    stacks.push(neu);
    return neu;
  }

  function mergeStacks(from, onto) {
    onto.cards.push(...from.cards);
    onto.z = ++zTop;
    renderCards(onto);
    applyTransform(onto);
    removeStack(from);
  }

  function stackFromPoint(clientX, clientY, ignore) {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const card = el.closest?.(".card");
      if (!card) continue;
      const stackEl = card.closest(".stack");
      if (!stackEl || (ignore && stackEl === ignore.el)) continue;
      return stacks.find((s) => s.el === stackEl) || null;
    }

    let best = null;
    let bestZ = -Infinity;
    for (const s of stacks) {
      if (s === ignore) continue;
      const r = s.el.getBoundingClientRect();
      if (
        clientX >= r.left - DROP_PAD &&
        clientX <= r.right + DROP_PAD &&
        clientY >= r.top - DROP_PAD &&
        clientY <= r.bottom + DROP_PAD &&
        s.z > bestZ
      ) {
        bestZ = s.z;
        best = s;
      }
    }
    return best;
  }

  function highlight(target) {
    for (const s of stacks) {
      s.el.classList.toggle("drop-target", s === target);
    }
  }

  function boardPoint(e) {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function recordSample(d, x, y) {
    const t = performance.now() / 1000;
    d.samples.push({ t, x, y });
    const cutoff = t - 0.18;
    while (d.samples.length > 2 && d.samples[0].t < cutoff) d.samples.shift();
  }

  function throwVelocity(d) {
    const samples = d.samples;
    if (!samples || samples.length < 2) return { vx: 0, vy: 0 };
    const now = samples[samples.length - 1].t;
    const endT = now - 0.012;
    const startT = endT - THROW_LOOKBACK;
    let a = samples[0];
    let b = samples[samples.length - 1];
    for (const s of samples) {
      if (s.t <= startT) a = s;
      if (s.t <= endT) b = s;
    }
    const dt = b.t - a.t;
    if (dt < 0.012) return { vx: 0, vy: 0 };
    let vx = (b.x - a.x) / dt;
    let vy = (b.y - a.y) / dt;
    const spd = Math.hypot(vx, vy);
    if (spd > MAX_THROW) {
      const k = MAX_THROW / spd;
      vx *= k;
      vy *= k;
    }
    return { vx, vy };
  }

  function bounceWalls(s) {
    const w = board.clientWidth;
    const h = board.clientHeight;
    const sh = stackHeight(s.cards.length);
    const pad = 12;
    const maxX = Math.max(pad, w - CARD_W - pad);
    const maxY = Math.max(pad, h - sh - pad);
    if (s.vis.x < pad) {
      s.vis.x = pad;
      s.vx = Math.abs(s.vx) * RESTITUTION;
    } else if (s.vis.x > maxX) {
      s.vis.x = maxX;
      s.vx = -Math.abs(s.vx) * RESTITUTION;
    }
    if (s.vis.y < pad) {
      s.vis.y = pad;
      s.vy = Math.abs(s.vy) * RESTITUTION;
    } else if (s.vis.y > maxY) {
      s.vis.y = maxY;
      s.vy = -Math.abs(s.vy) * RESTITUTION;
    }
  }

  function completePending() {
    if (!drag) return;
    const s = drag.stack;
    if (drag.mode === "snap" && stacks.includes(drag.snapOnto) && drag.snapOnto !== s) {
      s.el.classList.remove("settling", "dragging");
      mergeStacks(s, drag.snapOnto);
    } else if (s && stacks.includes(s)) {
      s.x = s.vis.x;
      s.y = s.vis.y;
      s.vx = 0;
      s.vy = 0;
      s.vis.x = s.x;
      s.vis.y = s.y;
      s.vis.scale = 1;
      s.vis.scaleVel = 0;
      s.vis.rot = s.rot;
      s.vis.rotVel = 0;
      s.el.classList.remove("settling", "dragging");
      applyTransform(s);
    }
    document.body.classList.remove("is-dragging");
    highlight(null);
    drag = null;
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const card = e.target.closest?.(".card");
    if (!card) return;
    if (drag) completePending();
    e.preventDefault();

    const stackEl = card.closest(".stack");
    let stack = stacks.find((s) => s.el === stackEl);
    if (!stack) return;

    const index = Number(card.dataset.index) || 0;
    if (index > 0) stack = splitStack(stack, index);

    const p = boardPoint(e);
    stack.z = ++zTop;
    stack.el.classList.add("dragging");
    document.body.classList.add("is-dragging");

    stack.vx = 0;
    stack.vy = 0;
    stack.vis.scaleVel = PICKUP_KICK;
    drag = {
      stack,
      pointerId: e.pointerId,
      grabX: p.x - stack.vis.x,
      grabY: p.y - stack.vis.y,
      pointerX: p.x,
      pointerY: p.y,
      mode: "drag",
      target: null,
      samples: [],
    };
    recordSample(drag, p.x, p.y);
  }

  function onPointerMove(e) {
    if (!drag || drag.mode !== "drag") return;
    if (e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
    const p = boardPoint(e);
    drag.pointerX = p.x;
    drag.pointerY = p.y;
    recordSample(drag, p.x, p.y);
    drag.target = stackFromPoint(e.clientX, e.clientY, drag.stack);
    highlight(drag.target);
  }

  function finishDrag() {
    const stack = drag.stack;
    const target = drag.target;
    const { vx, vy } = throwVelocity(drag);
    const speed = Math.hypot(vx, vy);
    stack.el.classList.remove("dragging");
    document.body.classList.remove("is-dragging");
    highlight(null);

    const placeOn =
      target && stacks.includes(target) && target !== stack && speed < PLACE_SPEED;

    if (placeOn) {
      drag.mode = "snap";
      drag.snapX = target.x;
      drag.snapY = target.y + target.cards.length * PEEK;
      drag.snapOnto = target;
      stack.vx = 0;
      stack.vy = 0;
      stack.el.classList.add("settling");
      stack.vis.scaleVel = RELEASE_KICK * 0.45;
    } else if (speed > STOP_SPEED * 2) {
      drag.mode = "slide";
      stack.vx = vx * THROW_GAIN;
      stack.vy = vy * THROW_GAIN;
      stack.rot = restRot();
      stack.el.classList.add("settling");
      stack.vis.scaleVel = RELEASE_KICK;
    } else {
      drag.mode = "settle";
      stack.x = stack.vis.x;
      stack.y = stack.vis.y;
      stack.vx = 0;
      stack.vy = 0;
      stack.rot = restRot();
      clampStack(stack);
      stack.vis.scaleVel = RELEASE_KICK;
      stack.el.classList.add("settling");
    }
  }

  function onPointerUp(e) {
    if (!drag || drag.mode !== "drag") return;
    if (e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
    finishDrag();
  }

  function spring(pos, vel, target, k, damp, dt) {
    vel += ((target - pos) * k - vel * damp) * dt;
    pos += vel * dt;
    return [pos, vel];
  }

  function follow(pos, target, tau, dt) {
    const a = 1 - Math.exp(-dt / tau);
    return pos + (target - pos) * a;
  }

  function tick(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;

    if (drag && drag.mode === "drag") {
      const s = drag.stack;
      const tx = drag.pointerX - drag.grabX;
      const ty = drag.pointerY - drag.grabY;
      s.vis.x = follow(s.vis.x, tx, FOLLOW_TAU, dt);
      s.vis.y = follow(s.vis.y, ty, FOLLOW_TAU, dt);
      [s.vis.scale, s.vis.scaleVel] = spring(
        s.vis.scale,
        s.vis.scaleVel,
        LIFT_SCALE,
        SCALE_K,
        SCALE_DAMP,
        dt
      );
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, 0, ROT_K, ROT_DAMP, dt);
      recordSample(drag, drag.pointerX, drag.pointerY);
      applyTransform(s);
    } else if (drag && drag.mode === "slide") {
      const s = drag.stack;
      s.vis.x += s.vx * dt;
      s.vis.y += s.vy * dt;
      bounceWalls(s);
      const damp = Math.exp(-FRICTION * dt);
      s.vx *= damp;
      s.vy *= damp;
      const spd = Math.hypot(s.vx, s.vy);
      const lean = Math.max(-9, Math.min(9, s.vx * 0.006));
      const targetScale = spd > 120 ? 1.035 : 1;
      [s.vis.scale, s.vis.scaleVel] = spring(
        s.vis.scale,
        s.vis.scaleVel,
        targetScale,
        SCALE_K,
        SCALE_DAMP,
        dt
      );
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, lean, ROT_K, ROT_DAMP, dt);
      applyTransform(s);
      if (spd < STOP_SPEED) {
        drag.mode = "settle";
        s.x = s.vis.x;
        s.y = s.vis.y;
        s.vx = 0;
        s.vy = 0;
        s.rot = restRot();
        clampStack(s);
      }
    } else if (drag && drag.mode === "snap") {
      const s = drag.stack;
      s.vis.x = follow(s.vis.x, drag.snapX, SNAP_TAU, dt);
      s.vis.y = follow(s.vis.y, drag.snapY, SNAP_TAU, dt);
      [s.vis.scale, s.vis.scaleVel] = spring(
        s.vis.scale,
        s.vis.scaleVel,
        1,
        SCALE_K,
        SCALE_DAMP,
        dt
      );
      [s.vis.rot, s.vis.rotVel] = spring(
        s.vis.rot,
        s.vis.rotVel,
        drag.snapOnto.rot,
        ROT_K,
        ROT_DAMP,
        dt
      );
      applyTransform(s);
      const dx = s.vis.x - drag.snapX;
      const dy = s.vis.y - drag.snapY;
      if (dx * dx + dy * dy < 9 && Math.abs(s.vis.scale - 1) < 0.02) {
        const onto = drag.snapOnto;
        s.el.classList.remove("settling");
        if (stacks.includes(onto) && onto !== s) mergeStacks(s, onto);
        else {
          s.x = s.vis.x;
          s.y = s.vis.y;
          s.rot = s.vis.rot;
        }
        drag = null;
      }
    } else if (drag && drag.mode === "settle") {
      const s = drag.stack;
      s.vis.x = follow(s.vis.x, s.x, 0.06, dt);
      s.vis.y = follow(s.vis.y, s.y, 0.06, dt);
      [s.vis.scale, s.vis.scaleVel] = spring(
        s.vis.scale,
        s.vis.scaleVel,
        1,
        SCALE_K,
        SCALE_DAMP,
        dt
      );
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, s.rot, ROT_K, ROT_DAMP, dt);
      applyTransform(s);
      const still =
        Math.abs(s.vis.scale - 1) > 0.008 ||
        Math.abs(s.vis.scaleVel) > 0.08 ||
        Math.abs(s.vis.rot - s.rot) > 0.15 ||
        Math.abs(s.vis.rotVel) > 2;
      if (!still) {
        s.vis.scale = 1;
        s.vis.scaleVel = 0;
        s.vis.rot = s.rot;
        s.vis.rotVel = 0;
        s.vis.x = s.x;
        s.vis.y = s.y;
        s.el.classList.remove("settling");
        applyTransform(s);
        drag = null;
      }
    }

    requestAnimationFrame(tick);
  }

  function seed() {
    const w = board.clientWidth;
    const h = board.clientHeight;
    for (const item of LAYOUT) {
      const x = item.fx * (w - CARD_W);
      const y = item.fy * (h - CARD_H);
      createStack(item.types, x, y, item.rot);
    }
  }

  board.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  board.addEventListener("dragstart", (e) => e.preventDefault());
  board.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".card")) e.preventDefault();
  });

  seed();
  requestAnimationFrame(tick);
})();
