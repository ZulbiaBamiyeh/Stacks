import { ART } from "./icons.js";
import { OPENING } from "./content.js";

const CARD_W = 140;
const CARD_H = 140;
const PEEK = 32;
const LIFT_SCALE = 1.085;
const FOLLOW_TAU = 0.02;
const SNAP_TAU = 0.03;
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

export function createView({ board, onCommit }) {
  const stacks = [];
  let zTop = 1;
  let drag = null;
  let lastT = performance.now();
  let interactive = true;
  let parentOf = Object.create(null);
  let selectedId = null;

  function restRot() {
    return (Math.random() - 0.5) * 5;
  }

  function stackHeight(n) {
    return (Math.max(n, 1) - 1) * PEEK + CARD_H;
  }

  function visualHeight(stack) {
    return isPileStack(stack) ? CARD_H : stackHeight(stack.cards.length);
  }

  function clampStack(stack) {
    const w = board.clientWidth;
    const h = board.clientHeight;
    const sh = visualHeight(stack);
    stack.x = Math.min(Math.max(12, stack.x), Math.max(12, w - CARD_W - 12));
    stack.y = Math.min(Math.max(12, stack.y), Math.max(12, h - sh - 12));
  }

  function isPileStack(stack) {
    if (stack.cards.length <= 1) return false;
    const first = stack.cards[0];
    if (!first || first.kind !== "resource") return false;
    return stack.cards.every((c) => c.type === first.type);
  }

  function renderCards(stack) {
    stack.el.innerHTML = "";
    const pile = isPileStack(stack);
    stack.el.classList.toggle("pile", pile);
    if (pile) {
      stack.el.style.height = `${CARD_H}px`;
      const top = stack.cards[stack.cards.length - 1];
      const el = document.createElement("article");
      el.className = "card";
      el.dataset.kind = top.kind;
      el.dataset.type = top.type;
      el.dataset.index = String(stack.cards.length - 1);
      el.dataset.id = String(top.id);
      if (selectedId === top.id) el.classList.add("selected");
      el.style.top = "0px";
      el.style.zIndex = "1";
      const src = ART[top.icon];
      el.innerHTML = `
        ${src ? `<img class="card-face" src="${src}" alt="" draggable="false">` : ""}
        <div class="card-name"></div>
        <div class="card-count">${stack.cards.length}</div>
      `;
      el.querySelector(".card-name").textContent = top.name;
      stack.el.appendChild(el);
    } else {
      stack.el.style.height = `${stackHeight(stack.cards.length)}px`;
      stack.cards.forEach((card, i) => {
        const el = document.createElement("article");
        el.className = "card";
        el.dataset.kind = card.kind;
        el.dataset.type = card.type;
        el.dataset.index = String(i);
        el.dataset.id = String(card.id);
        if (selectedId === card.id) el.classList.add("selected");
        el.style.top = `${i * PEEK}px`;
        el.style.zIndex = String(i + 1);
        const src = ART[card.icon];
        el.innerHTML = `
          ${src ? `<img class="card-face" src="${src}" alt="" draggable="false">` : ""}
          <div class="card-name"></div>
        `;
        el.querySelector(".card-name").textContent = card.name;
        stack.el.appendChild(el);
      });
    }
    if (stack.job) drawWork(stack);
  }

  function drawWork(stack) {
    const bar = document.createElement("div");
    bar.className = "work-bar";
    const fill = document.createElement("div");
    fill.className = "work-fill";
    const pct = stack.job.total ? (100 * stack.job.progress) / stack.job.total : 0;
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    const lab = document.createElement("div");
    lab.className = "work-label";
    lab.textContent = stack.job.label;
    stack.el.appendChild(bar);
    stack.el.appendChild(lab);
  }

  function applyTransform(stack) {
    const { x, y, rot, scale } = stack.vis;
    stack.el.style.left = `${x}px`;
    stack.el.style.top = `${y}px`;
    stack.el.style.transform = `rotate(${rot}deg) scale(${scale})`;
    stack.el.style.zIndex = String(stack.z);
  }

  function mountStack(stack) {
    stack.el = document.createElement("div");
    stack.el.className = "stack";
    if (stack.simId != null) stack.el.dataset.simId = String(stack.simId);
    renderCards(stack);
    applyTransform(stack);
    board.appendChild(stack.el);
    stacks.push(stack);
    return stack;
  }

  function makeStack({ simId, cards, x, y, rot }) {
    const stack = {
      simId,
      cards: cards.map((c) => ({ ...c })),
      x,
      y,
      rot,
      z: ++zTop,
      vx: 0,
      vy: 0,
      job: null,
      vis: { x, y, rot, scale: 1, scaleVel: 0, rotVel: 0 },
    };
    return mountStack(stack);
  }

  function removeStack(stack) {
    stack.el.remove();
    const i = stacks.indexOf(stack);
    if (i >= 0) stacks.splice(i, 1);
  }

  function splitStack(stack, index) {
    if (index <= 0 || index >= stack.cards.length) return stack;
    const wasPile = isPileStack(stack);
    const taken = stack.cards.splice(index);
    renderCards(stack);
    applyTransform(stack);
    return makeStack({
      simId: null,
      cards: taken,
      x: stack.vis.x,
      y: stack.vis.y + (wasPile ? 0 : index * PEEK),
      rot: stack.vis.rot,
    });
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
    for (const s of stacks) s.el.classList.toggle("drop-target", s === target);
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
    const sh = visualHeight(s);
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

  function commit(stack, onto) {
    if (!onCommit || stack.committed) return;
    stack.committed = true;
    const origin = stack.origin;
    if (onto && origin && onto.simId != null && onto.simId === origin.simId && origin.index > 0) {
      return;
    }
    let fromId = stack.simId;
    if (origin && origin.index > 0 && origin.simId != null) {
      const r = onCommit({ kind: "split", stackId: origin.simId, index: origin.index });
      if (r && r.newStackId != null) {
        stack.simId = r.newStackId;
        fromId = r.newStackId;
      }
    }
    if (onto && onto.simId != null && fromId != null) {
      onCommit({ kind: "merge", fromId, ontoId: onto.simId });
    } else if (origin && origin.attached) {
      const sid = fromId != null ? fromId : origin.simId;
      if (sid != null) onCommit({ kind: "detach", stackId: sid });
    }
  }

  function completePending() {
    if (!drag) return;
    const s = drag.stack;
    if (drag.mode === "snap" && stacks.includes(drag.snapOnto) && drag.snapOnto !== s) {
      s.el.classList.remove("settling", "dragging");
      commit(s, drag.snapOnto);
      mergeStacks(s, drag.snapOnto);
    } else if (s && stacks.includes(s)) {
      commit(s, null);
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
    if (!interactive) return;
    if (e.button !== undefined && e.button !== 0) return;
    const card = e.target.closest?.(".card");
    if (!card) return;
    if (drag) completePending();
    e.preventDefault();

    const stackEl = card.closest(".stack");
    let stack = stacks.find((s) => s.el === stackEl);
    if (!stack) return;

    const index = Number(card.dataset.index) || 0;
    const origin = {
      simId: stack.simId,
      index,
      attached: stack.simId != null && parentOf[stack.simId] != null,
    };
    if (index > 0) stack = splitStack(stack, index);
    stack.origin = origin;
    stack.committed = false;

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

    const cardId = Number(card.dataset.id);
    selectedId = cardId;
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
      const merged = target.cards.concat(stack.cards);
      const willPile =
        merged.length > 1 && merged[0].kind === "resource" && merged.every((c) => c.type === merged[0].type);
      drag.snapX = target.x;
      drag.snapY = target.y + (willPile ? 0 : target.cards.length * PEEK);
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

  function pump(now) {
    const dt = Math.min(0.033, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    if (drag && drag.mode === "drag") {
      const s = drag.stack;
      s.vis.x = follow(s.vis.x, drag.pointerX - drag.grabX, FOLLOW_TAU, dt);
      s.vis.y = follow(s.vis.y, drag.pointerY - drag.grabY, FOLLOW_TAU, dt);
      [s.vis.scale, s.vis.scaleVel] = spring(s.vis.scale, s.vis.scaleVel, LIFT_SCALE, SCALE_K, SCALE_DAMP, dt);
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
      [s.vis.scale, s.vis.scaleVel] = spring(s.vis.scale, s.vis.scaleVel, spd > 120 ? 1.035 : 1, SCALE_K, SCALE_DAMP, dt);
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, lean, ROT_K, ROT_DAMP, dt);
      applyTransform(s);
      if (spd < STOP_SPEED) {
        commit(s, null);
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
      [s.vis.scale, s.vis.scaleVel] = spring(s.vis.scale, s.vis.scaleVel, 1, SCALE_K, SCALE_DAMP, dt);
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, drag.snapOnto.rot, ROT_K, ROT_DAMP, dt);
      applyTransform(s);
      const dx = s.vis.x - drag.snapX;
      const dy = s.vis.y - drag.snapY;
      if (dx * dx + dy * dy < 9 && Math.abs(s.vis.scale - 1) < 0.02) {
        const onto = drag.snapOnto;
        s.el.classList.remove("settling");
        if (stacks.includes(onto) && onto !== s) {
          commit(s, onto);
          mergeStacks(s, onto);
        } else {
          commit(s, null);
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
      [s.vis.scale, s.vis.scaleVel] = spring(s.vis.scale, s.vis.scaleVel, 1, SCALE_K, SCALE_DAMP, dt);
      [s.vis.rot, s.vis.rotVel] = spring(s.vis.rot, s.vis.rotVel, s.rot, ROT_K, ROT_DAMP, dt);
      applyTransform(s);
      const still =
        Math.abs(s.vis.scale - 1) > 0.008 ||
        Math.abs(s.vis.scaleVel) > 0.08 ||
        Math.abs(s.vis.rot - s.rot) > 0.15 ||
        Math.abs(s.vis.rotVel) > 2;
      if (!still) {
        commit(s, null);
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
  }

  function seedOpening(snap) {
    const w = board.clientWidth;
    const h = board.clientHeight;
    const laid = OPENING.slice();
    snap.stacks.forEach((ss, i) => {
      const lay = laid[i] || { fx: 0.5, fy: 0.4, rot: restRot() };
      makeStack({
        simId: ss.id,
        cards: ss.cards,
        x: lay.fx * (w - CARD_W),
        y: lay.fy * (h - CARD_H),
        rot: lay.rot,
      });
    });
  }

  function reconcile(snap) {
    parentOf = snap.parentOf || Object.create(null);
    const dragging = drag ? drag.stack : null;
    const pendingSplitOriginId =
      dragging && dragging.origin && dragging.origin.index > 0 && !dragging.committed
        ? dragging.origin.simId
        : null;
    const seen = new Set();
    for (const ss of snap.stacks) {
      seen.add(ss.id);
      let vs = stacks.find((s) => s.simId === ss.id);
      if (!vs) {
        if (dragging && dragging.simId == null) continue;
        let x = board.clientWidth * 0.62;
        let y = board.clientHeight * 0.2;
        const parentId = parentOf[ss.id];
        if (parentId != null) {
          const host = stacks.find((s) => s.cards.some((c) => c.id === parentId));
          if (host) {
            x = host.x + CARD_W + 18;
            y = host.y;
          }
        }
        vs = makeStack({ simId: ss.id, cards: ss.cards, x, y, rot: restRot() });
      } else if (vs !== dragging && !(drag && drag.snapOnto === vs) && ss.id !== pendingSplitOriginId) {
        const same =
          vs.cards.length === ss.cards.length && vs.cards.every((c, i) => c.id === ss.cards[i].id);
        if (!same) {
          vs.cards = ss.cards.map((c) => ({ ...c }));
          renderCards(vs);
        }
      }
      const job = snap.work.find((w) => w.stackId === ss.id);
      if (vs && vs !== dragging) {
        const had = !!vs.job;
        const has = !!job;
        vs.job = job || null;
        if (had !== has) renderCards(vs);
        else if (job) {
          const fill = vs.el.querySelector(".work-fill");
          if (fill) fill.style.width = `${(100 * job.progress) / job.total}%`;
        }
      }
    }
    for (const vs of stacks.slice()) {
      if (vs === dragging) continue;
      if (vs.simId != null && !seen.has(vs.simId)) removeStack(vs);
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

  return {
    pump,
    seedOpening,
    reconcile,
    setInteractive(v) {
      interactive = v;
    },
    getSelected() {
      return selectedId;
    },
    clearSelected() {
      selectedId = null;
      for (const s of stacks) renderCards(s);
    },
    findCard(id) {
      for (const s of stacks) {
        if (s.cards.some((c) => c.id === id)) return s;
      }
      return null;
    },
  };
}
