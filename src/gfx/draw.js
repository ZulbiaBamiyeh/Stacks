// Everything drawn with canvas 2D: card faces, packs, icons, shop tiles and
// the hand-drawn board/forest textures. Ink-on-paper, Stacklands-adjacent.
import { CARDS, PACKS, SPECIAL_STATS, starMult } from '../content.js';
import { createRng } from '../rng.js';

export const INK = '#2a241c';
export const PAPER = '#f6efdc';
export const CARD_PX = { w: 400, h: 544 };
const FONT = '"Nunito", "Trebuchet MS", sans-serif';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function font(px, weight = 900) {
  return `${weight} ${px}px ${FONT}`;
}

export function fitText(ctx, text, maxW, px, weight = 900, min = 14) {
  let size = px;
  ctx.font = font(size, weight);
  while (ctx.measureText(text).width > maxW && size > min) {
    size -= 1;
    ctx.font = font(size, weight);
  }
  return size;
}

// Paper grain shared by every surface.
let grain = null;
function grainPattern(ctx) {
  if (!grain) {
    const g = canvas(128, 128);
    const gx = g.getContext('2d');
    const img = gx.createImageData(128, 128);
    const r = createRng(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r.next();
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0.5 ? 255 : 0;
      img.data[i + 3] = Math.floor(r.next() * 18);
    }
    gx.putImageData(img, 0, 0);
    grain = g;
  }
  return ctx.createPattern(grain, 'repeat');
}
function applyGrain(ctx, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ glyphs
// Each glyph draws in a -50..50 box.

function fs(c, fill, lw) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (lw !== 0) { if (lw) c.lineWidth = lw; c.stroke(); }
}
function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
}
function poly(c, pts, close = true) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
}

// Draw limbs/blobs as one outlined silhouette: ink pass, then fill pass.
function silhouette(c, fill, parts, outline = 6) {
  for (const pass of [0, 1]) {
    c.strokeStyle = pass ? fill : INK;
    c.fillStyle = pass ? fill : INK;
    for (const p of parts) {
      if (p.line) {
        c.lineWidth = p.w + (pass ? 0 : outline * 2);
        c.beginPath();
        c.moveTo(p.line[0], p.line[1]);
        for (let i = 2; i < p.line.length; i += 2) c.lineTo(p.line[i], p.line[i + 1]);
        c.stroke();
      } else if (p.circle) {
        circle(c, p.circle[0], p.circle[1], p.circle[2] + (pass ? 0 : outline));
        c.fill();
      } else if (p.rect) {
        const [x, y, w, h, r] = p.rect;
        const o = pass ? 0 : outline;
        rrect(c, x - o, y - o, w + o * 2, h + o * 2, r + o);
        c.fill();
      } else if (p.poly) {
        poly(c, p.poly);
        if (!pass) { c.lineWidth = outline * 2; c.stroke(); }
        c.fill();
      }
    }
  }
  c.strokeStyle = INK;
}

export const GLYPHS = {
  dmg(c) {
    c.rotate(Math.PI / 4);
    c.lineWidth = 7;
    poly(c, [-11, 14, -11, -32, 0, -48, 11, -32, 11, 14]); fs(c, '#e8ecef');
    c.save(); c.globalAlpha = 0.35; c.lineWidth = 4; poly(c, [0, -34, 0, 10], false); c.stroke(); c.restore();
    rrect(c, -26, 14, 52, 13, 5); fs(c, '#b07a40');
    rrect(c, -7, 27, 14, 15, 3); fs(c, '#5b3a22');
    circle(c, 0, 46, 7); fs(c, '#e0b23e');
  },
  shield(c) {
    c.beginPath(); c.moveTo(-34, -32); c.quadraticCurveTo(0, -46, 34, -32); c.lineTo(34, 0);
    c.quadraticCurveTo(30, 30, 0, 45); c.quadraticCurveTo(-30, 30, -34, 0); c.closePath(); fs(c, '#82abd6');
    c.save(); c.globalAlpha = 0.4; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, -38); c.lineTo(0, 38); c.moveTo(-30, -6); c.lineTo(30, -6); c.stroke(); c.restore();
  },
  heal(c) {
    c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-52, 6, -44, -40, -12, -35);
    c.bezierCurveTo(-3, -34, 0, -26, 0, -23); c.bezierCurveTo(0, -26, 3, -34, 12, -35);
    c.bezierCurveTo(44, -40, 52, 6, 0, 40); c.closePath(); fs(c, '#e8695d');
    c.save(); c.globalAlpha = 0.65; circle(c, -19, -17, 6); c.fillStyle = '#fff'; c.fill(); c.restore();
  },
  burn(c) {
    c.beginPath(); c.moveTo(0, 44); c.bezierCurveTo(-30, 44, -38, 18, -28, -2); c.bezierCurveTo(-22, -14, -12, -18, -10, -36);
    c.bezierCurveTo(6, -24, 4, -12, 8, -8); c.bezierCurveTo(12, -18, 16, -26, 14, -40); c.bezierCurveTo(34, -20, 40, 6, 32, 24);
    c.bezierCurveTo(26, 38, 14, 44, 0, 44); c.closePath(); fs(c, '#f0873a');
    c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-14, 40, -18, 26, -12, 16); c.bezierCurveTo(-8, 10, -2, 6, -2, -6);
    c.bezierCurveTo(8, 4, 14, 14, 12, 26); c.bezierCurveTo(10, 36, 6, 40, 0, 40); c.closePath(); fs(c, '#ffd45e', 4);
  },
  poison(c) {
    c.beginPath(); c.moveTo(0, -44); c.bezierCurveTo(14, -20, 34, 0, 34, 16); c.bezierCurveTo(34, 34, 18, 44, 0, 44);
    c.bezierCurveTo(-18, 44, -34, 34, -34, 16); c.bezierCurveTo(-34, 0, -14, -20, 0, -44); c.closePath(); fs(c, '#8fbf5a');
    circle(c, -11, 18, 8); fs(c, '#cfe7a8', 3);
    circle(c, 9, 4, 5); fs(c, '#cfe7a8', 3);
  },
  freeze(c) {
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? '#bfe6f7' : INK;
      c.lineWidth = pass ? 7 : 15;
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate((i * Math.PI) / 3);
        c.beginPath(); c.moveTo(0, -42); c.lineTo(0, 42);
        c.moveTo(-12, -32); c.lineTo(0, -22); c.lineTo(12, -32);
        c.moveTo(-12, 32); c.lineTo(0, 22); c.lineTo(12, 32);
        c.stroke(); c.restore();
      }
    }
    c.strokeStyle = INK;
  },
  cold(c) { GLYPHS.freeze(c); },
  haste(c) {
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(-40, -18); c.lineTo(14, -18); c.arc(14, -30, 12, Math.PI / 2, -Math.PI * 0.9, true); c.stroke();
    c.beginPath(); c.moveTo(-40, 2); c.lineTo(30, 2); c.stroke();
    c.beginPath(); c.moveTo(-30, 22); c.lineTo(20, 22); c.arc(20, 34, 12, -Math.PI / 2, Math.PI * 0.8); c.stroke();
  },
  luck(c) {
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(4, 8); c.quadraticCurveTo(10, 30, 24, 44); c.stroke();
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate((i * Math.PI) / 2 + Math.PI / 4);
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-26, -10, -22, -38, -6, -34); c.bezierCurveTo(-2, -33, 0, -28, 0, -26);
      c.bezierCurveTo(0, -28, 2, -33, 6, -34); c.bezierCurveTo(22, -38, 26, -10, 0, 0); c.closePath(); fs(c, '#79b85e', 5);
      c.restore();
    }
  },
  bless(c) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 19 : 44;
      pts.push(Math.cos(a) * r, Math.sin(a) * r + 4);
    }
    poly(c, pts); fs(c, '#f6cf4f');
  },
  heat(c) {
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate((i * Math.PI) / 4);
      poly(c, [-8, -26, 0, -46, 8, -26]); fs(c, '#f39a3a', 5);
      c.restore();
    }
    circle(c, 0, 0, 24); fs(c, '#f8c43c');
  },
  sand(c) {
    c.beginPath(); c.moveTo(-46, 32); c.quadraticCurveTo(-24, -14, 0, -10); c.quadraticCurveTo(22, -6, 46, 32); c.closePath(); fs(c, '#e8c98f');
    c.beginPath(); c.moveTo(-10, 32); c.quadraticCurveTo(10, 4, 30, 6); c.quadraticCurveTo(40, 8, 46, 32); c.closePath(); fs(c, '#d9b06c', 4);
    c.fillStyle = INK;
    for (const [x, y] of [[-20, 16], [-4, 2], [6, 20], [-28, 26], [20, 24]]) { circle(c, x, y, 2.5); c.fill(); }
  },
  charge(c) {
    poly(c, [10, -46, -26, 6, -2, 6, -12, 46, 28, -8, 4, -8, 18, -46]); fs(c, '#ffd84d');
  },
  summon(c) { GLYPHS.wolf(c); },
  clock(c) {
    circle(c, 0, 0, 38); fs(c, null);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -24); c.moveTo(0, 0); c.lineTo(16, 10); c.stroke();
  },
  coin(c) {
    circle(c, 0, 0, 38); fs(c, '#f2c64a');
    c.save(); c.globalAlpha = 0.5; circle(c, 0, 0, 26); c.lineWidth = 4; c.stroke(); c.restore();
    c.save(); c.globalAlpha = 0.55; c.fillStyle = '#fff6cf'; circle(c, -14, -16, 6); c.fill(); c.restore();
  },
  lock(c) {
    c.lineWidth = 9;
    c.beginPath(); c.arc(0, -10, 20, Math.PI, 0); c.stroke();
    rrect(c, -30, -10, 60, 48, 10); fs(c, '#c9c2b0', 7);
    circle(c, 0, 10, 6); c.fillStyle = INK; c.fill();
  },

  // ingredients
  wood(c) {
    c.rotate(-0.25);
    rrect(c, -44, -17, 68, 34, 12); fs(c, '#c98a4b');
    c.save(); c.globalAlpha = 0.35; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-34, -6); c.lineTo(8, -6); c.moveTo(-28, 6); c.lineTo(14, 6); c.stroke(); c.restore();
    c.beginPath(); c.ellipse(26, 0, 14, 18, 0, 0, Math.PI * 2); fs(c, '#ecc98d');
    c.beginPath(); c.ellipse(26, 0, 7, 9, 0, 0, Math.PI * 2); c.lineWidth = 3.5; c.stroke();
  },
  stone(c) {
    poly(c, [-38, 14, -32, -14, -8, -32, 22, -28, 40, -6, 34, 22, 4, 36, -24, 32]); fs(c, '#b9bfc7');
    c.save(); c.globalAlpha = 0.35; c.lineWidth = 4;
    poly(c, [-24, 8, -14, -14, 10, -18, 20, 2], false); c.stroke(); c.restore();
  },
  berry(c) {
    c.beginPath(); c.moveTo(6, -24); c.bezierCurveTo(20, -46, 42, -36, 40, -28); c.bezierCurveTo(30, -18, 14, -18, 6, -24); fs(c, '#6ea251', 5);
    c.lineWidth = 5; c.beginPath(); c.moveTo(4, -24); c.lineTo(-2, -6); c.moveTo(4, -24); c.lineTo(14, -2); c.stroke();
    for (const [x, y, r] of [[-16, 8, 16], [16, 10, 15], [0, 28, 15]]) { circle(c, x, y, r); fs(c, '#cf4b45'); }
    c.fillStyle = '#f6c5b8';
    for (const [x, y] of [[-21, 3], [11, 5], [-5, 23]]) { circle(c, x, y, 3.5); c.fill(); }
  },
  bone(c) {
    c.rotate(-0.6);
    silhouette(c, '#f3ead6', [
      { line: [-28, 0, 28, 0], w: 14 },
      { circle: [-32, -8, 10] }, { circle: [-32, 8, 10] }, { circle: [32, -8, 10] }, { circle: [32, 8, 10] },
    ], 5);
  },
  ember(c) {
    c.beginPath(); c.ellipse(0, 30, 30, 14, 0, 0, Math.PI * 2); fs(c, '#5d4c45');
    c.save(); c.translate(0, -8); c.scale(0.72, 0.72); GLYPHS.burn(c); c.restore();
  },
  mushroom(c) {
    rrect(c, -12, -2, 24, 40, 10); fs(c, '#f3e8cf');
    c.beginPath(); c.moveTo(-42, 4); c.quadraticCurveTo(-40, -40, 0, -42); c.quadraticCurveTo(40, -40, 42, 4); c.closePath(); fs(c, '#d6544c');
    c.fillStyle = '#fff3e6';
    for (const [x, y, r] of [[-20, -14, 6], [6, -26, 5], [22, -8, 6], [-4, -6, 4]]) { circle(c, x, y, r); c.fill(); }
  },
  feather(c) {
    c.rotate(0.5);
    c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(26, -28, 24, 22, 0, 40); c.bezierCurveTo(-24, 22, -26, -28, 0, -46); fs(c, '#9ccfd6');
    c.lineWidth = 4; c.beginPath(); c.moveTo(0, -38); c.lineTo(0, 48); c.stroke();
    c.save(); c.globalAlpha = 0.45; c.lineWidth = 3;
    for (let y = -24; y < 30; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(-16, y - 8); c.moveTo(0, y + 4); c.lineTo(16, y - 4); c.stroke(); }
    c.restore();
  },
  ice(c) {
    // a chunky ice cube with a frosty highlight
    poly(c, [-34, -16, 0, -36, 36, -16, 36, 22, 0, 42, -34, 22]); fs(c, '#cdeefa');
    poly(c, [-34, -16, 0, 4, 36, -16, 0, -36]); fs(c, '#eefaff');
    c.beginPath(); c.moveTo(0, 4); c.lineTo(0, 42); c.stroke();
    c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#fff'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-22, 2); c.lineTo(-22, 20); c.moveTo(-12, -22); c.lineTo(4, -28); c.stroke();
    c.restore();
  },
  crystal(c) {
    poly(c, [0, -46, 26, -20, 26, 22, 0, 46, -26, 22, -26, -20]); fs(c, '#a6dcf2');
    c.save(); c.globalAlpha = 0.45; c.lineWidth = 3.5;
    poly(c, [0, -46, 0, 46], false); c.stroke();
    poly(c, [-26, -20, 0, -6, 26, -20], false); c.stroke(); c.restore();
    c.save(); c.globalAlpha = 0.7; c.fillStyle = '#fff'; poly(c, [-18, -16, -8, -26, -8, 6]); c.fill(); c.restore();
  },
  moonstone(c) {
    circle(c, 0, 0, 38); fs(c, '#6f72ad');
    c.beginPath(); c.arc(0, 0, 24, -Math.PI * 0.6, Math.PI * 0.6); c.arc(12, 0, 20, Math.PI * 0.55, -Math.PI * 0.55, true); c.closePath(); fs(c, '#efeaff', 4);
    c.fillStyle = '#efeaff';
    for (const [x, y] of [[-18, -18], [-22, 14], [20, -24]]) { circle(c, x, y, 2.5); c.fill(); }
  },

  // families (placeholder art for units)
  person(c, fill = '#fbf6ea') {
    silhouette(c, fill, [
      { line: [-34, -16, -10, -2, 0, 0, 12, -4, 32, -24], w: 16 },
      { line: [0, 6, -16, 40], w: 16 },
      { line: [0, 6, 16, 40], w: 16 },
      { line: [0, -14, 0, 14], w: 30 },
      { circle: [0, -28, 17] },
    ]);
    c.fillStyle = INK;
    circle(c, -6, -31, 3); c.fill();
    circle(c, 6, -31, 3); c.fill();
    c.beginPath(); c.ellipse(0, -22, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
  },
  fairy(c) {
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      c.beginPath(); c.ellipse(22, -14, 18, 26, 0.6, 0, Math.PI * 2); fs(c, '#d7ecf7', 5);
      c.beginPath(); c.ellipse(20, 14, 12, 16, -0.5, 0, Math.PI * 2); fs(c, '#e8f4fb', 5);
      c.restore();
    }
    c.save(); c.scale(0.86, 0.86); c.translate(0, 4); GLYPHS.person(c, '#fff8ee'); c.restore();
  },
  wolf(c) {
    silhouette(c, '#d8d3ca', [
      { line: [-26, 0, -42, -16], w: 10 },
      { line: [-22, 8, -24, 34], w: 9 }, { line: [-8, 10, -8, 36], w: 9 },
      { line: [12, 10, 12, 34], w: 9 }, { line: [22, 6, 26, 32], w: 9 },
      { line: [-22, 2, 18, -2], w: 28 },
      { poly: [16, -24, 18, -44, 28, -30] }, { poly: [28, -28, 36, -46, 40, -26] },
      { circle: [28, -14, 15] },
      { line: [32, -10, 46, -4], w: 12 },
    ]);
    c.fillStyle = INK;
    circle(c, 32, -18, 3); c.fill();
    circle(c, 49, -4, 3.5); c.fill();
  },
  scorpion(c) {
    silhouette(c, '#e4b97c', [
      { line: [-16, 18, -30, 30], w: 5 }, { line: [-4, 22, -12, 36], w: 5 }, { line: [8, 22, 6, 36], w: 5 },
      { line: [-20, 12, -36, -4, -32, -24, -16, -32], w: 12 },
      { poly: [-16, -40, -2, -32, -16, -24] },
      { line: [10, 8, 30, -2], w: 8 }, { line: [6, 14, 30, 18], w: 8 },
      { circle: [34, -8, 9] }, { circle: [34, 22, 9] },
      { circle: [-16, 14, 13] }, { circle: [4, 12, 16] },
    ]);
    c.fillStyle = INK;
    circle(c, 10, 6, 2.5); c.fill();
    circle(c, 16, 10, 2.5); c.fill();
  },
  spirit(c) {
    c.beginPath(); c.moveTo(-28, 32); c.lineTo(-28, -6); c.bezierCurveTo(-28, -44, 28, -44, 28, -6); c.lineTo(28, 32);
    c.quadraticCurveTo(21, 22, 14, 32); c.quadraticCurveTo(7, 42, 0, 32); c.quadraticCurveTo(-7, 22, -14, 32); c.quadraticCurveTo(-21, 42, -28, 32);
    c.closePath(); fs(c, '#eef2f6');
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(-9, -10, 4, 6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(9, -10, 4, 6, 0, 0, Math.PI * 2); c.fill();
  },
  golem(c) {
    silhouette(c, '#bdb7ab', [
      { rect: [-42, -10, 14, 34, 6] }, { rect: [28, -10, 14, 34, 6] },
      { rect: [-20, 24, 14, 18, 4] }, { rect: [6, 24, 14, 18, 4] },
      { rect: [-26, -14, 52, 42, 10] },
      { rect: [-14, -40, 28, 24, 7] },
    ]);
    c.fillStyle = '#f6cf4f';
    c.fillRect(-9, -32, 6, 5); c.fillRect(3, -32, 6, 5);
    c.save(); c.globalAlpha = 0.35; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-14, 0); c.lineTo(-2, 8); c.moveTo(8, -4); c.lineTo(14, 10); c.stroke(); c.restore();
  },
  thing(c) { GLYPHS.bless(c); },
};

export function glyph(ctx, name, cx, cy, size, arg) {
  const fn = GLYPHS[name];
  if (!fn) return;
  ctx.save();
  ctx.translate(cx, cy);
  const k = size / 100;
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  fn(ctx, arg);
  ctx.restore();
}

// Wobbly ink blob, used for stat badges.
function blob(ctx, cx, cy, rx, ry, seed) {
  const r = createRng(seed);
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r.next() - 0.5) * 0.08;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// ------------------------------------------------------------------ cards

const NUMERIC = ['dmg', 'heal', 'shield', 'burn', 'poison', 'sand', 'heat', 'luck', 'bless', 'freeze'];

export function cardStats(def, perm = 0, live = null, stars = 0, att = 1) {
  const sm = starMult(def, stars, att);
  const stats = [];
  const seen = new Set();
  const extra = [def.once?.slice(1), def.onNeighbourAct, def.onOppositeAct].filter(Boolean);
  for (const [, ...acts] of [...(def.t || []), ...extra.map((a) => [0, ...a])]) {
    for (const a0 of acts) {
      const list = a0.k === 'alt' ? a0.list : [a0];
      for (const a of list) {
        if (a.k === 'special' && SPECIAL_STATS[a.fx]) {
          for (const sp of SPECIAL_STATS[a.fx](a)) {
            if (seen.has(sp.k)) continue;
            seen.add(sp.k);
            if (live && live[sp.k] != null) stats.push({ k: sp.k, n: live[sp.k], delta: typeof sp.n === 'number' ? Math.sign(live[sp.k] - sp.n) : 0 });
            else stats.push({ ...sp });
          }
          continue;
        }
        if (!NUMERIC.includes(a.k) || seen.has(a.k)) continue;
        seen.add(a.k);
        let n = a.k === 'freeze' ? `${+(a.dur * (1 + 0.25 * stars)).toFixed(2)}s` : Math.round((a.n + (a.k === def.main ? perm : 0)) * sm);
        const grows = ['pct', 'perGold', 'goldFrac', 'goldMult', 'shieldFrac', 'spendShield', 'healFrac', 'ramp', 'perAlly', 'perEnemy', 'ifEnemy',
          'perShield', 'perMissing', 'perDay', 'perFrozen', 'perOwned', 'perEmpty', 'perFamily', 'perTable', 'ifOppEmpty'].some((k) => a[k]);
        if (a.k !== 'freeze' && (grows || a.n === 0)) n = a.n ? `${n}+` : '*';
        // During a fight (or on the wall) show the live value, marked when it moved.
        if (live && live[a.k] != null && a.k !== 'freeze') {
          const base = Math.round((a.n + (a.k === def.main ? perm : 0)) * sm);
          const v = live[a.k];
          stats.push({ k: a.k, n: v, delta: Math.sign(v - base) });
          continue;
        }
        stats.push({ k: a.k, n });
      }
    }
  }
  if (!stats.length && def.startLuck) stats.push({ k: 'luck', n: def.startLuck });
  return stats.slice(0, 2);
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export function cardColors(def) {
  if (def.kind === 'ingredient') return { body: '#8e9ea6', header: '#728189', title: '#ffffff', art: '#a9b7be' };
  if (def.rare) return { body: '#f1d37a', header: '#3b3346', title: '#f6d77a', art: '#f8e6a6' };
  if (def.summon) return { body: '#e3e9ef', header: '#c9d3dc', title: INK, art: '#eef2f6' };
  if (def.track) return { body: '#b8dcc2', header: '#94c4a3', title: INK, art: '#d4ebda' };
  return [
    null,
    { body: '#efe6cc', header: '#e0d0a2', title: INK, art: '#f8f1dc' },
    { body: '#f3cf8c', header: '#e4b465', title: INK, art: '#f9e3b8' },
    { body: '#eea98b', header: '#dc8a69', title: INK, art: '#f6cdb8' },
    { body: '#cdbbe3', header: '#b29bd0', title: INK, art: '#e3d8f0' },
  ][def.tier];
}

const ART_TINT = {
  dmg: '#f7ead0', burn: '#fbdcc2', poison: '#e2efcb', heal: '#f8dcd8', shield: '#dce8f3', sand: '#f3e4c6',
  bless: '#f8eec6', luck: '#e3f0d6', freeze: '#dbf0f8', heat: '#fbe0bf',
};

export function drawCard(def, { perm = 0, art = null, summon = false, meals = 0, live = null, stack = 1, stars = 0, att = 1 } = {}) {
  const { w, h } = CARD_PX;
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  const col = cardColors(summon ? { ...def, summon: true } : def);
  const R = 30;
  const HEAD = 78;

  ctx.save();
  rrect(ctx, 5, 5, w - 10, h - 10, R);
  ctx.clip();
  ctx.fillStyle = col.body;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = col.header;
  ctx.fillRect(0, 0, w, HEAD);
  ctx.fillStyle = INK;
  ctx.fillRect(0, HEAD - 3, w, 6);
  ctx.restore();

  // Title
  ctx.fillStyle = col.title;
  ctx.textBaseline = 'middle';
  const tierW = def.tier ? 46 : 0;
  const starW = (stars ? stars * 40 + 8 : 0) + (att > 1 ? 40 : 0);
  fitText(ctx, def.name, w - 48 - tierW - starW, 38, 900, 20);
  ctx.fillText(def.name, 24, HEAD / 2 + 3);
  // attuned to the bound shrine: a teal diamond after the name and stars
  if (att > 1) {
    const dx = 24 + ctx.measureText(def.name).width + 26 + stars * 40;
    const dy = HEAD / 2 + 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dx, dy - 17); ctx.lineTo(dx + 13, dy); ctx.lineTo(dx, dy + 17); ctx.lineTo(dx - 13, dy);
    ctx.closePath();
    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#4fc1a6'; ctx.fill();
    ctx.restore();
    ctx.fillStyle = col.title;
  }
  // stars from merging copies, right after the name
  if (stars) {
    const nameW = ctx.measureText(def.name).width;
    for (let i = 0; i < stars; i++) {
      const sx = 24 + nameW + 26 + i * 40;
      const sy = HEAD / 2 + 2;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 8.5 : 20;
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = def.rare ? '#fff1a0' : '#ffd84a';
      ctx.fill();
      ctx.lineWidth = 0.01;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = col.title;
  }
  if (def.tier && !def.rare) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.font = font(24, 900);
    ctx.textAlign = 'right';
    ctx.fillText(ROMAN[def.tier], w - 24, HEAD / 2 + 3);
    ctx.restore();
  } else if (def.rare) {
    glyph(ctx, 'bless', w - 40, HEAD / 2 + 2, 36);
  }

  // Art window
  const ax = 44;
  const ay = HEAD + 26;
  const aw = w - 88;
  const ah = aw;
  const main = def.main || def.kind;
  if (art) {
    ctx.save();
    rrect(ctx, ax, ay, aw, ah, 26);
    ctx.clip();
    const s = Math.max(aw / art.width, ah / art.height);
    ctx.drawImage(art, ax + (aw - art.width * s) / 2, ay + (ah - art.height * s) / 2, art.width * s, art.height * s);
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    rrect(ctx, ax, ay, aw, ah, 26);
    ctx.stroke();
  } else {
    const cx = w / 2;
    const cy = ay + ah / 2;
    ctx.fillStyle = def.kind === 'ingredient' ? col.art : ART_TINT[main] || col.art;
    circle(ctx, cx, cy, aw / 2 - 6);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    circle(ctx, cx, cy, aw / 2 - 6);
    ctx.stroke();
    ctx.restore();
    if (def.kind === 'ingredient') {
      glyph(ctx, def.id, cx, cy, 190);
    } else {
      const fam = def.family === 'thing' ? (GLYPHS[main] ? main : 'bless') : def.family;
      glyph(ctx, fam, cx, cy + 4, def.family === 'thing' ? 160 : 210);
      if (def.rare) {
        for (const [x, y, s] of [[-108, -84, 30], [104, -96, 24], [112, 70, 20], [-112, 88, 18]]) glyph(ctx, 'bless', cx + x, cy + y, s);
      }
    }
  }

  // Bundles: a big count badge in the corner of the art window.
  if (stack > 1) {
    const bx = w - 78;
    const byy = HEAD + 70;
    ctx.fillStyle = INK;
    circle(ctx, bx, byy, 50);
    ctx.fill();
    ctx.fillStyle = ['', '', '#e3b98a', '#d7dde4', '#f3cf5a', '#c9a8f2'][stack];
    circle(ctx, bx, byy, 42);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = font(44, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${stack}`, bx, byy + 3);
  }

  // Hunger pill for eaters: meals eaten and the next evolution.
  if (def.eats) {
    const ev = def.eats.evolve;
    const label = ev ? `ate ${meals}/${ev[0]}` : `ate ${meals}`;
    ctx.font = font(26, 900);
    const tw = ctx.measureText(label).width;
    const pw = tw + 64;
    const px = w / 2 - pw / 2;
    const py = HEAD + 14;
    ctx.fillStyle = INK;
    rrect(ctx, px, py, pw, 40, 20);
    ctx.fill();
    glyph(ctx, def.eats.foods[0], px + 24, py + 20, 30);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + 44, py + 22);
  }

  // Bottom badges
  const by = h - 58;
  if (def.kind === 'unit') {
    const stats = cardStats(def, perm, live, stars, att);
    if (stats.length) {
      ctx.font = font(40, 900);
      const parts = stats.map((s) => ({ ...s, tw: ctx.measureText(String(s.n)).width }));
      const inner = parts.reduce((a, p) => a + 40 + 6 + p.tw, 0) + (parts.length - 1) * 16;
      const bw = inner + 44;
      ctx.fillStyle = INK;
      blob(ctx, 22 + bw / 2, by, bw / 2, 30, def.id.length * 13);
      ctx.fill();
      let x = 22 + 22;
      for (const p of parts) {
        glyph(ctx, p.k, x + 20, by, 40);
        ctx.fillStyle = p.delta > 0 ? '#9be37f' : p.delta < 0 ? '#ff9a8a' : '#fff';
        ctx.textAlign = 'left';
        ctx.font = font(40, 900);
        ctx.fillText(String(p.n), x + 46, by + 2);
        x += 40 + 6 + p.tw + 16;
      }
    }
    const cd = def.t[0]?.[0] ?? def.once?.[0];
    if (cd) {
      ctx.font = font(32, 900);
      const label = `${cd}s`;
      const tw = ctx.measureText(label).width;
      const bw = tw + 72;
      ctx.fillStyle = INK;
      blob(ctx, w - 22 - bw / 2, by, bw / 2, 28, def.id.length * 7);
      ctx.fill();
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w - 22 - bw + 34, by, 12, 0, Math.PI * 2);
      ctx.moveTo(w - 22 - bw + 34, by);
      ctx.lineTo(w - 22 - bw + 34, by - 8);
      ctx.moveTo(w - 22 - bw + 34, by);
      ctx.lineTo(w - 22 - bw + 40, by + 4);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(label, w - 22 - bw + 54, by + 2);
    } else if (!cardStats(def).length) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.55;
      ctx.textAlign = 'center';
      ctx.font = font(26, 800);
      ctx.fillText('passive', w / 2, by + 2);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.75;
    ctx.textAlign = 'center';
    ctx.font = font(26, 800);
    ctx.fillText('ingredient', w / 2, by + 2);
    ctx.globalAlpha = 1;
  }

  applyGrain(ctx, w, h);
  // Outline
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  rrect(ctx, 5, 5, w - 10, h - 10, R);
  ctx.stroke();
  return cv;
}

export function drawCardBack() {
  const { w, h } = CARD_PX;
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e9dfc4';
  rrect(ctx, 5, 5, w - 10, h - 10, 30);
  ctx.fill();
  ctx.save();
  rrect(ctx, 26, 26, w - 52, h - 52, 20);
  ctx.clip();
  ctx.fillStyle = '#3f5a4a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,240,210,0.18)';
  ctx.lineWidth = 3;
  for (let i = -h; i < w + h; i += 34) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#e9dfc4';
  circle(ctx, w / 2, h / 2, 74); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  glyph(ctx, 'dmg', w / 2, h / 2, 96);
  applyGrain(ctx, w, h);
  ctx.lineWidth = 10;
  rrect(ctx, 5, 5, w - 10, h - 10, 30);
  ctx.stroke();
  return cv;
}

// ------------------------------------------------------------------ packs

export const PACK_COLORS = {
  village: '#efd47e', wild: '#a3cf8e', desert: '#e8bb7c',
  flame: '#f29d6c', inferno: '#e9735a', tomb: '#bdb3cf', crypt: '#998cb6',
  grove: '#93cb9f', oasis: '#6fbfae', caravan: '#f2d06c', treasury: '#e2b43e',
  quarry: '#adb8c2', foundry: '#8c99a6',
};

function packGlyphs(pack) {
  const ids = pack.pool.map(([id]) => id).slice(0, 3);
  return ids.map((id) => {
    const d = CARDS[id];
    return d.kind === 'ingredient' ? id : d.family === 'thing' ? d.main || 'bless' : d.family;
  });
}

export function drawPack(packId) {
  const pack = PACKS[packId];
  const { w, h } = CARD_PX;
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  const band = PACK_COLORS[packId] || '#ddd';
  ctx.save();
  rrect(ctx, 5, 5, w - 10, h - 10, 22);
  ctx.clip();
  ctx.fillStyle = '#d8b88a';
  ctx.fillRect(0, 0, w, h);
  // crimped ends
  ctx.fillStyle = '#c6a272';
  ctx.fillRect(0, 0, w, 54);
  ctx.fillRect(0, h - 54, w, 54);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (const y of [54, h - 54]) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + ((x / 20) % 2 ? 7 : -7));
    ctx.stroke();
  }
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (let x = 14; x < w; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, 44); ctx.moveTo(x, h - 44); ctx.lineTo(x, h - 8); ctx.stroke();
  }
  ctx.restore();
  // band
  ctx.fillStyle = band;
  ctx.fillRect(0, 96, w, 170);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 96); ctx.lineTo(w, 96); ctx.moveTo(0, 266); ctx.lineTo(w, 266); ctx.stroke();
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [a, b] = pack.name.split(' ');
  fitText(ctx, a, w - 60, 62, 900);
  ctx.fillText(a, w / 2, 160);
  ctx.font = font(36, 900);
  ctx.fillText(b, w / 2, 220);

  const gl = packGlyphs(pack);
  gl.forEach((g, i) => {
    const x = w / 2 + (i - (gl.length - 1) / 2) * 104;
    ctx.fillStyle = '#f6efdc';
    circle(ctx, x, 356, 46); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    glyph(ctx, g, x, 358, 70);
  });
  ctx.fillStyle = INK;
  ctx.font = font(28, 800);
  ctx.fillText(`${pack.size} cards${pack.rare ? ' · rare?' : ''}`, w / 2, 436);
  if (pack.rare) {
    glyph(ctx, 'bless', 48, 128, 34);
    glyph(ctx, 'bless', w - 48, 128, 34);
  }
  applyGrain(ctx, w, h);
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  rrect(ctx, 5, 5, w - 10, h - 10, 22);
  ctx.stroke();
  return cv;
}

// ------------------------------------------------------------------ shop tiles

const TILE = '#2b2724';

function tileBase(w, h) {
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = TILE;
  rrect(ctx, 0, 0, w, h, 34);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 4;
  rrect(ctx, 14, 14, w - 28, h - 28, 24);
  ctx.stroke();
  return { cv, ctx };
}

export function priceTag(ctx, x, y, price, size = 44) {
  ctx.font = font(size, 900);
  ctx.textBaseline = 'middle';
  const label = String(price);
  const tw = ctx.measureText(label).width;
  const total = tw + size * 0.95;
  const x0 = x - total / 2;
  glyph(ctx, 'coin', x0 + size * 0.38, y, size * 0.78);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(label, x0 + size * 0.9, y + 2);
}

export function drawTile(kind, opts = {}) {
  const W = 300;
  const H = 400;
  if (kind === 'pack') {
    const { cv, ctx } = tileBase(W, H);
    const pack = PACKS[opts.pack];
    ctx.drawImage(drawPack(opts.pack), 55, 34, 190, 258);
    priceTag(ctx, W / 2, 340, pack.price, 54);
    if (opts.cantAfford) {
      ctx.fillStyle = 'rgba(43,39,36,0.5)';
      ctx.fillRect(0, 0, W, H);
    }
    return cv;
  }
  if (kind === 'sell') {
    const { cv, ctx } = tileBase(W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(64, 900);
    ctx.fillText('Sell', W / 2, 150);
    glyph(ctx, 'coin', W / 2, 260, 90);
    ctx.globalAlpha = 0.55;
    ctx.font = font(26, 800);
    ctx.fillText('drop a card', W / 2, 345);
    return cv;
  }
  if (kind === 'single') {
    const { cv, ctx } = tileBase(W, H);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 5;
    rrect(ctx, 40, 30, W - 80, 290, 22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (opts.price != null) priceTag(ctx, W / 2, 358, opts.price, 50);
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.font = font(32, 900);
      ctx.fillText('sold', W / 2, 358);
    }
    return cv;
  }
  if (kind === 'reroll') {
    const cv = canvas(600, 220);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = TILE;
    rrect(ctx, 0, 0, 600, 220, 40);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(110, 110, 44, -Math.PI * 0.2, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    poly(ctx, [146, 50, 156, 92, 116, 84]);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(64, 900);
    ctx.fillText('Reroll', 186, 104);
    priceTag(ctx, 500, 110, 1, 58);
    return cv;
  }
  if (kind === 'shrine') {
    // A carved stone altar with an offering bowl per track; each bowl's rim
    // fills toward the next unlock (5, then 12) and glows once unlocked.
    const W = 600;
    const H = 380;
    const cv = canvas(W, H);
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4a4038');
    g.addColorStop(1, '#2f2924');
    ctx.fillStyle = g;
    rrect(ctx, 0, 0, W, H, 40);
    ctx.fill();
    // carved border with rune ticks
    ctx.strokeStyle = 'rgba(242,214,140,0.55)';
    ctx.lineWidth = 4;
    rrect(ctx, 14, 14, W - 28, H - 28, 30);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242,214,140,0.45)';
    for (let x = 60; x < W - 40; x += 48) { ctx.fillRect(x, 11, 10, 3); ctx.fillRect(x + 20, H - 14, 10, 3); }
    // title plaque between two candles
    ctx.fillStyle = '#f6efdc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(40, 900);
    ctx.fillText('Shrine', W / 2, 48);
    for (const cx of [W / 2 - 112, W / 2 + 112]) {
      ctx.fillStyle = '#efe4c8';
      ctx.fillRect(cx - 7, 42, 14, 26);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(cx - 7, 42, 14, 26);
      const fg = ctx.createRadialGradient(cx, 32, 1, cx, 32, 20);
      fg.addColorStop(0, 'rgba(255,220,120,0.9)');
      fg.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, 32, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.ellipse(cx, 32, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    const tracks = opts.tracks || [];
    const cols = 3;
    tracks.forEach((t, i) => {
      const cx = 108 + (i % cols) * 192;
      const cy = 148 + Math.floor(i / cols) * 132;
      const R = 42;
      const [s1, s2] = opts.steps || [5, 10];
      const lvl = t.fed >= s2 ? 2 : t.fed >= s1 ? 1 : 0;
      if (lvl) {
        const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.7);
        halo.addColorStop(0, lvl === 2 ? 'rgba(242,198,74,0.55)' : 'rgba(159,211,138,0.45)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, Math.PI * 2); ctx.fill();
      }
      // bowl
      ctx.fillStyle = '#1f1b18';
      ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f6efdc';
      ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.fill();
      glyph(ctx, t.feed, cx, cy, 52);
      // progress rim: to 5 then to 12, with a notch at 5
      const a0 = -Math.PI / 2;
      ctx.lineCap = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
      const p = Math.min(1, t.fed / s2);
      if (p > 0) {
        ctx.strokeStyle = lvl === 2 ? '#f2c64a' : lvl === 1 ? '#9fd38a' : '#f6efdc';
        ctx.beginPath(); ctx.arc(cx, cy, R + 2, a0, a0 + p * Math.PI * 2); ctx.stroke();
      }
      const an = a0 + (s1 / s2) * Math.PI * 2;
      ctx.strokeStyle = '#1f1b18';
      ctx.lineWidth = 4;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * (R - 4), cy + Math.sin(an) * (R - 4)); ctx.lineTo(cx + Math.cos(an) * (R + 9), cy + Math.sin(an) * (R + 9)); ctx.stroke();
      // sealed bowls: dimmed, with a padlock
      if (t.sealed) {
        ctx.fillStyle = 'rgba(31,27,24,0.68)';
        ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#cfc6b4'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy - 6, 11, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = '#cfc6b4';
        rrect(ctx, cx - 17, cy - 6, 34, 26, 6); ctx.fill();
        ctx.fillStyle = '#1f1b18'; ctx.beginPath(); ctx.arc(cx, cy + 6, 4, 0, Math.PI * 2); ctx.fill();
      }
      // name and count
      ctx.fillStyle = t.sealed ? 'rgba(255,255,255,0.35)' : lvl ? '#fff' : 'rgba(255,255,255,0.8)';
      ctx.font = font(22, 900);
      ctx.textAlign = 'center';
      ctx.fillText(t.sealed ? t.name : `${t.name} ${Math.min(t.fed, s2)}/${lvl ? s2 : s1}`, cx, cy + R + 28);
      if (lvl === 2) glyph(ctx, 'bless', cx + R - 2, cy - R + 4, 26);
      if (t.bound) {
        ctx.fillStyle = '#f2c64a';
        rrect(ctx, cx - 34, cy - R - 22, 68, 22, 11); ctx.fill();
        ctx.fillStyle = INK; ctx.font = font(15, 900);
        ctx.fillText('BOUND', cx, cy - R - 10);
      }
    });
    return cv;
  }
  throw new Error(kind);
}

// Small text plaque (wall/tower labels, slot locks).
export function drawLabel(text, { w = 512, h = 128, size = 64, color = INK, bg = null, align = 'center', alpha = 1 } = {}) {
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  if (bg) { ctx.fillStyle = bg; rrect(ctx, 0, 0, w, h, h / 2); ctx.fill(); }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  fitText(ctx, text, w - 24, size, 900);
  ctx.fillText(text, align === 'center' ? w / 2 : 12, h / 2 + 3);
  return cv;
}

export function drawSlot({ locked = false, label = '' } = {}) {
  const cv = canvas(300, 400);
  const ctx = cv.getContext('2d');
  ctx.strokeStyle = INK;
  ctx.globalAlpha = locked ? 0.22 : 0.4;
  ctx.lineWidth = 8;
  ctx.setLineDash([22, 16]);
  ctx.lineCap = 'round';
  rrect(ctx, 14, 14, 272, 372, 30);
  ctx.stroke();
  ctx.setLineDash([]);
  if (locked) {
    ctx.globalAlpha = 0.4;
    glyph(ctx, 'lock', 150, 170, 80);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = font(40, 900);
    ctx.fillText(label, 150, 260);
  } else if (label) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(90, 900);
    ctx.fillText(label, 150, 200);
  }
  return cv;
}

// ------------------------------------------------------------------ ground

function scatterTufts(ctx, r, n, w, h, color, scale = 1) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r.next() * w;
    const y = r.next() * h;
    const s = (6 + r.next() * 6) * scale;
    ctx.lineWidth = 2.2 * scale;
    ctx.beginPath();
    for (let k = -1; k <= 1; k++) {
      ctx.moveTo(x + k * s * 0.45, y);
      ctx.quadraticCurveTo(x + k * s * 0.5, y - s * 0.6, x + k * s * 0.8 + (r.next() - 0.5) * 3, y - s * (k === 0 ? 1.2 : 0.9));
    }
    ctx.stroke();
  }
}

function speckle(ctx, r, n, w, h, colors, size = 1.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.05 + r.next() * 0.08;
    ctx.beginPath();
    ctx.arc(r.next() * w, r.next() * h, size + r.next() * size * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function flowers(ctx, r, n, w, h, colors) {
  for (let i = 0; i < n; i++) {
    const x = r.next() * w;
    const y = r.next() * h;
    ctx.fillStyle = colors[i % colors.length];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tileable: everything is drawn 9 times (wrapped) so edges match.
function wrapped(ctx, w, h, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    ctx.save();
    ctx.translate(dx, dy);
    fn();
    ctx.restore();
  }
}

export function drawGrass({ base = '#a8cd99', tuft = 'rgba(70,110,60,0.42)', seed = 3, size = 512, flowersOn = true } = {}) {
  const cv = canvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = createRng(seed);
  wrapped(ctx, size, size, () => {
    const rr = createRng(seed);
    speckle(ctx, rr, 220, size, size, ['#ffffff', '#5f8f55', '#d9e8c4']);
    scatterTufts(ctx, rr, 16, size, size, tuft);
    if (flowersOn) flowers(ctx, rr, 4, size, size, ['#fffaf0', '#f4d3e0', '#fff4c2']);
  });
  void r;
  applyGrain(ctx, size, size);
  return cv;
}

// Watercolour blob + wobbly ink outline.
function wcBlob(ctx, r, cx, cy, rx, ry, fill, { ink = true, passes = 3 } = {}) {
  const pts = (k, jitter) => {
    const out = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const j = 1 + (r.next() - 0.5) * jitter;
      out.push([cx + Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j]);
    }
    return out;
  };
  const path = (p) => {
    ctx.beginPath();
    for (let i = 0; i <= p.length; i++) {
      const a = p[i % p.length];
      const b = p[(i + 1) % p.length];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      i ? ctx.quadraticCurveTo(a[0], a[1], mx, my) : ctx.moveTo(mx, my);
    }
    ctx.closePath();
  };
  ctx.fillStyle = fill;
  for (let i = 0; i < passes; i++) {
    ctx.globalAlpha = 0.42;
    path(pts(0.94 + i * 0.03, 0.12));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (ink) {
    ctx.strokeStyle = 'rgba(42,36,28,0.7)';
    ctx.lineWidth = 2.4;
    path(pts(1, 0.08));
    ctx.stroke();
  }
}

function tree(ctx, r, x, y, s) {
  const kind = r.int(4);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const greens = ['#7fae6e', '#93bd7c', '#6f9f6a', '#a5c98a', '#88b6a0', '#b9b97a'];
  const g = greens[r.int(greens.length)];
  // ground shadow
  ctx.fillStyle = 'rgba(40,70,40,0.16)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.1, y + s * 0.05, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 0 || kind === 3) {
    // round tree
    ctx.strokeStyle = 'rgba(42,36,28,0.75)';
    ctx.lineWidth = 2.6;
    ctx.fillStyle = '#9b7b5a';
    ctx.beginPath(); ctx.rect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5); ctx.fill(); ctx.stroke();
    wcBlob(ctx, r, x, y - s * 0.78, s * 0.42, s * 0.4, g);
    ctx.strokeStyle = 'rgba(42,36,28,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const sx = x + (r.next() - 0.5) * s * 0.4;
      const sy = y - s * 0.8 + (r.next() - 0.5) * s * 0.3;
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  } else if (kind === 1) {
    // pine
    ctx.strokeStyle = 'rgba(42,36,28,0.75)';
    ctx.lineWidth = 2.6;
    ctx.fillStyle = '#8a6a4c';
    ctx.beginPath(); ctx.rect(x - s * 0.05, y - s * 0.25, s * 0.1, s * 0.25); ctx.fill(); ctx.stroke();
    const pg = ['#5f9466', '#6a9e72', '#7aa877'][r.int(3)];
    for (let i = 0; i < 3; i++) {
      const ty = y - s * (0.2 + i * 0.32);
      const tw = s * (0.42 - i * 0.1);
      ctx.fillStyle = pg;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x - tw, ty);
      ctx.lineTo(x, ty - s * 0.48);
      ctx.lineTo(x + tw, ty);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  } else {
    // poplar
    ctx.strokeStyle = 'rgba(42,36,28,0.75)';
    ctx.lineWidth = 2.6;
    wcBlob(ctx, r, x, y - s * 0.75, s * 0.24, s * 0.62, g);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.1); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const by = y - s * (0.45 + i * 0.17);
      ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x - s * 0.12, by - s * 0.1); ctx.moveTo(x, by); ctx.lineTo(x + s * 0.12, by - s * 0.1); ctx.stroke();
    }
  }
}

function bush(ctx, r, x, y, s) {
  const g = ['#6f9f78', '#7cae86', '#8db58a', '#7aa59c'][r.int(4)];
  ctx.fillStyle = 'rgba(40,70,40,0.14)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.05, s * 0.7, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy, k] of [[-0.35, -0.2, 0.32], [0.05, -0.32, 0.4], [0.4, -0.18, 0.3]]) {
    wcBlob(ctx, r, x + dx * s, y + dy * s, s * k, s * k * 0.85, g);
  }
}

function sheep(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(42,36,28,0.8)';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#4a4440';
  ctx.fillRect(x - s * 0.2, y, s * 0.06, s * 0.16);
  ctx.fillRect(x + s * 0.12, y, s * 0.06, s * 0.16);
  ctx.fillStyle = '#fbf8f0';
  for (const [dx, dy] of [[-0.18, -0.06], [0, -0.12], [0.18, -0.06], [-0.08, 0.04], [0.1, 0.04]]) {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#fbf8f0';
  for (const [dx, dy] of [[-0.18, -0.06], [0, -0.12], [0.18, -0.06], [-0.08, 0.04], [0.1, 0.04]]) {
    ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#4a4440';
  ctx.beginPath(); ctx.ellipse(x + s * 0.32, y - s * 0.06, s * 0.09, s * 0.11, 0.3, 0, Math.PI * 2); ctx.fill();
}

function mushroomDoodle(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(42,36,28,0.7)';
  ctx.lineWidth = 1.6;
  ctx.fillStyle = '#f3e8cf';
  ctx.fillRect(x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.2);
  ctx.fillStyle = '#d8655b';
  ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.16, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
}

function rock(ctx, r, x, y, s) {
  wcBlob(ctx, r, x, y, s * 0.4, s * 0.26, ['#b5bdb4', '#a9b3ac', '#c2c6b8'][r.int(3)]);
}

export function drawForest({ size = 1024, seed = 11, base = '#8bb680', density = 1 } = {}) {
  const cv = canvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  wrapped(ctx, size, size, () => {
    const r = createRng(seed);
    speckle(ctx, r, 500, size, size, ['#ffffff', '#4f7f4a', '#c9dfb5'], 3);
    scatterTufts(ctx, r, 70, size, size, 'rgba(55,90,50,0.4)', 1.3);
    flowers(ctx, r, 18, size, size, ['#fffaf0', '#f4d3e0', '#fff4c2']);
    const items = [];
    const n = Math.round(24 * density);
    for (let i = 0; i < n; i++) items.push({ t: r.next() < 0.68 ? 'tree' : 'bush', x: r.next() * size, y: r.next() * size, s: 70 + r.next() * 60 });
    for (let i = 0; i < 7; i++) items.push({ t: 'rock', x: r.next() * size, y: r.next() * size, s: 40 + r.next() * 30 });
    for (let i = 0; i < 6; i++) items.push({ t: 'mush', x: r.next() * size, y: r.next() * size, s: 30 });
    for (let i = 0; i < 4; i++) items.push({ t: 'sheep', x: r.next() * size, y: r.next() * size, s: 46 });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.t === 'tree') tree(ctx, r, it.x, it.y, it.s);
      else if (it.t === 'bush') bush(ctx, r, it.x, it.y, it.s * 0.8);
      else if (it.t === 'rock') rock(ctx, r, it.x, it.y, it.s);
      else if (it.t === 'mush') mushroomDoodle(ctx, it.x, it.y, it.s);
      else sheep(ctx, it.x, it.y, it.s);
    }
  });
  applyGrain(ctx, size, size);
  return cv;
}

// ---------------------------------------------------------------- themed lands
// Unlocking a shrine track repaints the world: the forest around the board
// and the board's own cloth. Each theme has a ground painter (tileable) and
// board colours.
const INKA = (a) => `rgba(42,36,28,${a})`;

function charredTree(ctx, r, x, y, s, burning) {
  ctx.fillStyle = 'rgba(20,8,6,0.25)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.1, y + s * 0.04, s * 0.45, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1f1714';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r.next() - 0.5) * s * 0.1, y - s * 0.9); ctx.stroke();
  ctx.lineWidth = s * 0.05;
  for (let i = 0; i < 4; i++) {
    const by = y - s * (0.35 + i * 0.14);
    const dir = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + dir * s * 0.18, by - s * 0.08, x + dir * s * (0.26 + r.next() * 0.1), by - s * 0.22); ctx.stroke();
  }
  // glowing embers in the bark
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = r.chance(0.5) ? '#ff8a3a' : '#ffd25a';
    ctx.beginPath(); ctx.arc(x + (r.next() - 0.5) * s * 0.08, y - r.next() * s * 0.8, s * 0.018, 0, Math.PI * 2); ctx.fill();
  }
  if (burning) {
    ctx.save();
    ctx.translate(x, y - s * 0.98);
    const k = s / 150;
    ctx.scale(k, k);
    ctx.lineWidth = 3 / k;
    ctx.strokeStyle = INKA(0.7);
    GLYPHS.burn(ctx);
    ctx.restore();
  }
}

function lavaPool(ctx, r, x, y, s) {
  wcBlob(ctx, r, x, y, s * 0.62, s * 0.3, '#2e1712');
  const g = ctx.createRadialGradient(x, y, 2, x, y, s * 0.5);
  g.addColorStop(0, '#fff1a0');
  g.addColorStop(0.35, '#ffb43a');
  g.addColorStop(1, '#e0441c');
  wcBlob(ctx, r, x, y, s * 0.5, s * 0.22, g, { ink: false });
  ctx.fillStyle = 'rgba(46,23,18,0.55)';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + (r.next() - 0.5) * s * 0.6, y + (r.next() - 0.5) * s * 0.2, s * 0.08, s * 0.03, 0, 0, Math.PI * 2); ctx.fill(); }
}

function lavaRiver(ctx, r, w, h) {
  const y0 = r.next() * h;
  const pts = [];
  for (let x = -40; x <= w + 40; x += 40) pts.push([x, y0 + Math.sin(x / 90 + r.next()) * 30 + (r.next() - 0.5) * 18]);
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2e1712'; ctx.lineWidth = 26; path(); ctx.stroke();
  ctx.strokeStyle = '#e8501f'; ctx.lineWidth = 18; path(); ctx.stroke();
  ctx.strokeStyle = '#ffb43a'; ctx.lineWidth = 9; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,241,160,0.8)'; ctx.lineWidth = 3; path(); ctx.stroke();
}

function tombstone(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(30,25,40,0.2)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.12, y + s * 0.03, s * 0.34, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  const w = s * 0.42;
  const h = s * 0.62;
  ctx.fillStyle = ['#b9b6c4', '#a8a5b6', '#c4c1cc'][r.int(3)];
  ctx.strokeStyle = INKA(0.8);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h + w / 2);
  ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2;
  if (r.chance(0.5)) { ctx.beginPath(); ctx.moveTo(x, y - h * 0.82); ctx.lineTo(x, y - h * 0.38); ctx.moveTo(x - w * 0.22, y - h * 0.66); ctx.lineTo(x + w * 0.22, y - h * 0.66); ctx.stroke(); }
  else for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w * 0.25, y - h * (0.7 - i * 0.14)); ctx.lineTo(x + w * 0.25, y - h * (0.7 - i * 0.14)); ctx.stroke(); }
  ctx.fillStyle = '#7f9a6a';
  ctx.beginPath(); ctx.ellipse(x - w * 0.3, y - 2, s * 0.08, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
}

function deadTree(ctx, r, x, y, s) {
  ctx.strokeStyle = '#4b4150';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.5, x - s * 0.04, y - s * 0.95); ctx.stroke();
  ctx.lineWidth = s * 0.035;
  for (let i = 0; i < 5; i++) {
    const by = y - s * (0.4 + i * 0.11);
    const dir = r.chance(0.5) ? 1 : -1;
    const len = s * (0.18 + r.next() * 0.16);
    ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + dir * len * 0.5, by - len * 0.2, x + dir * len, by - len * 0.7); ctx.stroke();
  }
}

function boneDoodle(ctx, x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#f3ecdc';
  ctx.strokeStyle = INKA(0.7);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.rect(-s * 0.3, -s * 0.05, s * 0.6, s * 0.1);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) ctx.arc(sx * s * 0.3, sy * s * 0.06, s * 0.07, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function coinPile(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(90,60,10,0.22)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 4, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  const n = 9 + r.int(8);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const cx = x + (r.next() - 0.5) * s * (1 - t) * 1.1;
    const cy = y - t * s * 0.45 + (r.next() - 0.5) * 6;
    ctx.fillStyle = r.chance(0.3) ? '#f8dc78' : '#efc24a';
    ctx.strokeStyle = INKA(0.75);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.13, s * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,110,20,0.6)';
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.08, s * 0.04, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

function jewel(ctx, r, x, y, s) {
  const col = [['#e04a5a', '#ff9aa6'], ['#3a7ae0', '#9cc4ff'], ['#2fae6a', '#9ff0c0'], ['#9b5de0', '#d9b8ff']][r.int(4)];
  ctx.strokeStyle = INKA(0.8);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.3, y - s * 0.12); ctx.lineTo(x, y + s * 0.3); ctx.lineTo(x - s * 0.3, y - s * 0.12); ctx.closePath();
  ctx.fillStyle = col[0]; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.12, y - s * 0.12); ctx.lineTo(x - s * 0.12, y - s * 0.12); ctx.closePath();
  ctx.fillStyle = col[1]; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.2, s * 0.04, 0, Math.PI * 2); ctx.fill();
}

function chest(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(90,60,10,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 5, y + 3, s * 0.55, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INKA(0.85);
  ctx.lineWidth = 2.4;
  ctx.fillStyle = '#9a5f34';
  ctx.fillRect(x - s * 0.4, y - s * 0.32, s * 0.8, s * 0.32); ctx.strokeRect(x - s * 0.4, y - s * 0.32, s * 0.8, s * 0.32);
  // open lid with treasure heaped inside
  ctx.fillStyle = '#b8743f';
  ctx.beginPath(); ctx.moveTo(x - s * 0.4, y - s * 0.32); ctx.lineTo(x - s * 0.36, y - s * 0.62); ctx.lineTo(x + s * 0.36, y - s * 0.62); ctx.lineTo(x + s * 0.4, y - s * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#efc24a';
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.34, s * 0.36, s * 0.12, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e2b94e';
  for (const bx of [-0.25, 0.25]) { ctx.fillRect(x + bx * s - s * 0.04, y - s * 0.32, s * 0.08, s * 0.32); ctx.strokeRect(x + bx * s - s * 0.04, y - s * 0.32, s * 0.08, s * 0.32); }
  jewel(ctx, r, x + s * 0.12, y - s * 0.42, s * 0.22);
}

function anvil(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(30,30,30,0.22)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 3, s * 0.5, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5c5f66';
  ctx.strokeStyle = INKA(0.85);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.3, y - s * 0.5); ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.48, x + s * 0.58, y - s * 0.4);
  ctx.lineTo(x + s * 0.2, y - s * 0.36); ctx.lineTo(x + s * 0.14, y - s * 0.16); ctx.lineTo(x + s * 0.3, y); ctx.lineTo(x - s * 0.36, y); ctx.lineTo(x - s * 0.2, y - s * 0.16);
  ctx.lineTo(x - s * 0.26, y - s * 0.36); ctx.lineTo(x - s * 0.5, y - s * 0.4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - s * 0.46, y - s * 0.48, s * 0.7, s * 0.04);
}

function gear(ctx, x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#8c8f96';
  ctx.strokeStyle = INKA(0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  const teeth = 8;
  for (let i = 0; i < teeth * 2; i++) {
    const rr = i % 2 ? s * 0.38 : s * 0.48;
    const t = (i / (teeth * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6d74';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function snowPine(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(60,100,140,0.18)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.12, y + s * 0.03, s * 0.45, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INKA(0.75);
  ctx.lineWidth = 2.4;
  ctx.fillStyle = '#7a5c44';
  ctx.fillRect(x - s * 0.05, y - s * 0.18, s * 0.1, s * 0.18); ctx.strokeRect(x - s * 0.05, y - s * 0.18, s * 0.1, s * 0.18);
  for (let i = 0; i < 3; i++) {
    const ty = y - s * (0.15 + i * 0.27);
    const tw = s * (0.42 - i * 0.1);
    ctx.fillStyle = ['#4f7f6a', '#5a8c74', '#64977d'][i];
    ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - s * 0.38); ctx.lineTo(x + tw, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
    // snow on each tier
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x - tw * 0.55, ty - s * 0.16); ctx.lineTo(x, ty - s * 0.38); ctx.lineTo(x + tw * 0.55, ty - s * 0.16);
    ctx.quadraticCurveTo(x + tw * 0.2, ty - s * 0.1, x, ty - s * 0.15); ctx.quadraticCurveTo(x - tw * 0.2, ty - s * 0.1, x - tw * 0.55, ty - s * 0.16); ctx.fill();
  }
}

function iceShards(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(60,110,150,0.18)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 3, s * 0.45, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INKA(0.7);
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * s * 0.18 + (r.next() - 0.5) * 6;
    const hh = s * (0.35 + r.next() * 0.45);
    const ww = s * (0.08 + r.next() * 0.06);
    const lean = (r.next() - 0.5) * s * 0.2;
    ctx.fillStyle = r.chance(0.5) ? '#bfe6f6' : '#d9f2fb';
    ctx.beginPath(); ctx.moveTo(x + dx - ww, y); ctx.lineTo(x + dx + lean, y - hh); ctx.lineTo(x + dx + ww, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.moveTo(x + dx - ww * 0.3, y - 3); ctx.lineTo(x + dx + lean * 0.7, y - hh * 0.8); ctx.stroke();
    ctx.strokeStyle = INKA(0.7);
  }
}

function frozenPond(ctx, r, x, y, s) {
  wcBlob(ctx, r, x, y, s * 0.7, s * 0.32, '#a9d8ec');
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - s * 0.4, y - s * 0.06); ctx.lineTo(x - s * 0.1, y - s * 0.14); ctx.moveTo(x + s * 0.05, y + s * 0.08); ctx.lineTo(x + s * 0.35, y); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,120,150,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - s * 0.1, y); ctx.lineTo(x + s * 0.05, y + s * 0.12); ctx.lineTo(x + s * 0.12, y + s * 0.02); ctx.stroke();
}

function bigMushroom(ctx, r, x, y, s) {
  ctx.fillStyle = 'rgba(30,60,30,0.2)';
  ctx.beginPath(); ctx.ellipse(x + 6, y + 3, s * 0.4, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INKA(0.8);
  ctx.lineWidth = 2.4;
  ctx.fillStyle = '#f3e8cf';
  ctx.beginPath(); ctx.moveTo(x - s * 0.08, y); ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.3, x - s * 0.06, y - s * 0.45); ctx.lineTo(x + s * 0.06, y - s * 0.45); ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.3, x + s * 0.08, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ['#d6544c', '#9b6fd0', '#e08a3c'][r.int(3)];
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.46, s * 0.36, s * 0.24, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3e6';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + (r.next() - 0.5) * s * 0.5, y - s * (0.5 + r.next() * 0.12), s * 0.04, 0, Math.PI * 2); ctx.fill(); }
}

function glowDots(ctx, r, n, w, h, color, size) {
  for (let i = 0; i < n; i++) {
    const x = r.next() * w;
    const y = r.next() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, size * 3, 0, Math.PI * 2); ctx.fill();
  }
}

export const THEMES = {
  meadow: { side: '#5f7d55', board: { base: '#a8cd99' } },
  flame: {
    side: '#5a2a20',
    ground(ctx, r, size) {
      speckle(ctx, r, 600, size, size, ['#ff9a4a', '#2a1210', '#a8442e'], 3);
      for (let i = 0; i < 2; i++) lavaRiver(ctx, r, size, size);
      const items = [];
      for (let i = 0; i < 22; i++) items.push({ t: 'tree', x: r.next() * size, y: r.next() * size, s: 80 + r.next() * 60, burning: r.chance(0.35) });
      for (let i = 0; i < 7; i++) items.push({ t: 'pool', x: r.next() * size, y: r.next() * size, s: 70 + r.next() * 60 });
      for (let i = 0; i < 6; i++) items.push({ t: 'rock', x: r.next() * size, y: r.next() * size, s: 40 + r.next() * 30 });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.t === 'tree') charredTree(ctx, r, it.x, it.y, it.s, it.burning);
        else if (it.t === 'pool') lavaPool(ctx, r, it.x, it.y, it.s);
        else wcBlob(ctx, r, it.x, it.y, it.s * 0.4, it.s * 0.26, '#4a2c26');
      }
      glowDots(ctx, r, 40, size, size, 'rgba(255,170,70,0.75)', 2.2);
    },
    groundBase: '#5b2b24',
    board: {
      base: '#c08060',
      paint(ctx, r, size) {
        speckle(ctx, r, 260, size, size, ['#3a2420', '#f0a070', '#7a3a2a']);
        scatterTufts(ctx, r, 10, size, size, 'rgba(60,25,15,0.35)');
        // cracks with a faint glow
        for (let i = 0; i < 4; i++) {
          let x = r.next() * size;
          let y = r.next() * size;
          ctx.lineCap = 'round';
          for (const [c, lw] of [['rgba(255,140,60,0.35)', 5], ['rgba(60,25,15,0.6)', 1.6]]) {
            ctx.strokeStyle = c; ctx.lineWidth = lw;
            ctx.beginPath(); ctx.moveTo(x, y);
            let px = x; let py = y;
            for (let k = 0; k < 4; k++) { px += (r.next() - 0.5) * 40; py += 10 + r.next() * 18; ctx.lineTo(px, py); }
            ctx.stroke();
          }
          void x; void y;
        }
        glowDots(ctx, r, 8, size, size, 'rgba(255,170,70,0.55)', 1.6);
      },
    },
  },
  tomb: {
    side: '#4a4656',
    groundBase: '#6d6a7c',
    ground(ctx, r, size) {
      speckle(ctx, r, 500, size, size, ['#ffffff', '#3e3a4a', '#9a96aa'], 3);
      scatterTufts(ctx, r, 50, size, size, 'rgba(50,45,60,0.4)', 1.2);
      const items = [];
      for (let i = 0; i < 26; i++) items.push({ t: 'stone', x: r.next() * size, y: r.next() * size, s: 60 + r.next() * 30 });
      for (let i = 0; i < 12; i++) items.push({ t: 'tree', x: r.next() * size, y: r.next() * size, s: 90 + r.next() * 60 });
      for (let i = 0; i < 16; i++) items.push({ t: 'bone', x: r.next() * size, y: r.next() * size, s: 26 + r.next() * 14 });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.t === 'stone') tombstone(ctx, r, it.x, it.y, it.s);
        else if (it.t === 'tree') deadTree(ctx, r, it.x, it.y, it.s);
        else boneDoodle(ctx, it.x, it.y, it.s, r.next() * Math.PI);
      }
      // low mist
      for (let i = 0; i < 14; i++) wcBlob(ctx, r, r.next() * size, r.next() * size, 90, 26, 'rgba(240,238,250,0.16)', { ink: false });
    },
    board: {
      base: '#b4aec2',
      paint(ctx, r, size) {
        speckle(ctx, r, 220, size, size, ['#ffffff', '#6a6578', '#d6d2e0']);
        scatterTufts(ctx, r, 12, size, size, 'rgba(70,64,84,0.38)');
        for (let i = 0; i < 3; i++) boneDoodle(ctx, r.next() * size, r.next() * size, 18, r.next() * Math.PI);
      },
    },
  },
  grove: {
    side: '#3f6e45',
    groundBase: '#5f9a5c',
    ground(ctx, r, size) {
      speckle(ctx, r, 500, size, size, ['#ffffff', '#3d6e3c', '#b9dca5'], 3);
      scatterTufts(ctx, r, 90, size, size, 'rgba(40,80,40,0.45)', 1.6);
      flowers(ctx, r, 50, size, size, ['#fffaf0', '#f4c3d6', '#fff4c2', '#cfe0ff']);
      const items = [];
      for (let i = 0; i < 34; i++) items.push({ t: 'tree', x: r.next() * size, y: r.next() * size, s: 90 + r.next() * 70 });
      for (let i = 0; i < 10; i++) items.push({ t: 'mush', x: r.next() * size, y: r.next() * size, s: 60 + r.next() * 40 });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) (it.t === 'tree' ? tree : bigMushroom)(ctx, r, it.x, it.y, it.s);
      glowDots(ctx, r, 36, size, size, 'rgba(255,245,150,0.8)', 1.8);
    },
    board: {
      base: '#a3d48c',
      paint(ctx, r, size) {
        speckle(ctx, r, 220, size, size, ['#ffffff', '#4f8f45', '#d9f0c4']);
        scatterTufts(ctx, r, 22, size, size, 'rgba(60,110,50,0.45)');
        flowers(ctx, r, 12, size, size, ['#fffaf0', '#f4c3d6', '#fff4c2', '#cfe0ff']);
      },
    },
  },
  caravan: {
    side: '#8a6424',
    groundBase: '#d8b264',
    ground(ctx, r, size) {
      speckle(ctx, r, 600, size, size, ['#fff6d8', '#a9802f', '#f0d48c'], 3);
      // dune ripples
      ctx.strokeStyle = 'rgba(150,110,40,0.3)';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 40; i++) {
        const x = r.next() * size; const y = r.next() * size;
        ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.quadraticCurveTo(x, y - 12, x + 40, y); ctx.stroke();
      }
      const items = [];
      for (let i = 0; i < 18; i++) items.push({ t: 'pile', x: r.next() * size, y: r.next() * size, s: 60 + r.next() * 50 });
      for (let i = 0; i < 9; i++) items.push({ t: 'chest', x: r.next() * size, y: r.next() * size, s: 70 + r.next() * 30 });
      for (let i = 0; i < 26; i++) items.push({ t: 'jewel', x: r.next() * size, y: r.next() * size, s: 22 + r.next() * 18 });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.t === 'pile') coinPile(ctx, r, it.x, it.y, it.s);
        else if (it.t === 'chest') chest(ctx, r, it.x, it.y, it.s);
        else jewel(ctx, r, it.x, it.y, it.s);
      }
      glowDots(ctx, r, 40, size, size, 'rgba(255,250,220,0.9)', 1.6);
    },
    board: {
      base: '#ead08a',
      paint(ctx, r, size) {
        speckle(ctx, r, 260, size, size, ['#fff8e0', '#b48a3a', '#f6dc98']);
        for (let i = 0; i < 6; i++) {
          const x = r.next() * size; const y = r.next() * size;
          ctx.fillStyle = '#efc24a'; ctx.strokeStyle = INKA(0.6); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        glowDots(ctx, r, 10, size, size, 'rgba(255,255,230,0.9)', 1.3);
      },
    },
  },
  forge: {
    side: '#55524f',
    groundBase: '#85807b',
    ground(ctx, r, size) {
      speckle(ctx, r, 700, size, size, ['#ffffff', '#3c3a38', '#b0aba4'], 3);
      const items = [];
      for (let i = 0; i < 26; i++) items.push({ t: 'rock', x: r.next() * size, y: r.next() * size, s: 50 + r.next() * 50 });
      for (let i = 0; i < 8; i++) items.push({ t: 'anvil', x: r.next() * size, y: r.next() * size, s: 60 + r.next() * 20 });
      for (let i = 0; i < 12; i++) items.push({ t: 'gear', x: r.next() * size, y: r.next() * size, s: 30 + r.next() * 30 });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.t === 'rock') {
          wcBlob(ctx, r, it.x, it.y, it.s * 0.42, it.s * 0.28, ['#9a958f', '#8a857f', '#a8a39c'][r.int(3)]);
          if (r.chance(0.35)) { ctx.strokeStyle = 'rgba(255,140,50,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(it.x - it.s * 0.15, it.y - 2); ctx.lineTo(it.x + it.s * 0.1, it.y - it.s * 0.1); ctx.stroke(); }
        } else if (it.t === 'anvil') anvil(ctx, it.x, it.y, it.s);
        else gear(ctx, it.x, it.y, it.s, r.next());
      }
      glowDots(ctx, r, 30, size, size, 'rgba(255,170,80,0.8)', 1.5);
    },
    board: {
      base: '#c4bdb3',
      paint(ctx, r, size) {
        speckle(ctx, r, 420, size, size, ['#ffffff', '#5a5650', '#9a948c'], 2);
        for (let i = 0; i < 8; i++) wcBlob(ctx, r, r.next() * size, r.next() * size, 7, 5, '#a59e95');
      },
    },
  },
  frost: {
    side: '#6f93a8',
    groundBase: '#e2eff6',
    ground(ctx, r, size) {
      speckle(ctx, r, 500, size, size, ['#ffffff', '#8db3c8', '#c9e2ee'], 3);
      const items = [];
      for (let i = 0; i < 30; i++) items.push({ t: 'pine', x: r.next() * size, y: r.next() * size, s: 80 + r.next() * 60 });
      for (let i = 0; i < 6; i++) items.push({ t: 'pond', x: r.next() * size, y: r.next() * size, s: 110 + r.next() * 60 });
      for (let i = 0; i < 12; i++) items.push({ t: 'ice', x: r.next() * size, y: r.next() * size, s: 50 + r.next() * 40 });
      for (let i = 0; i < 10; i++) items.push({ t: 'mound', x: r.next() * size, y: r.next() * size, s: 60 + r.next() * 40 });
      items.sort((a, b) => (a.t === 'pond' ? -1 : 0) - (b.t === 'pond' ? -1 : 0) || a.y - b.y);
      for (const it of items) {
        if (it.t === 'pine') snowPine(ctx, r, it.x, it.y, it.s);
        else if (it.t === 'pond') frozenPond(ctx, r, it.x, it.y, it.s);
        else if (it.t === 'ice') iceShards(ctx, r, it.x, it.y, it.s);
        else wcBlob(ctx, r, it.x, it.y, it.s * 0.5, it.s * 0.22, '#f6fbfe');
      }
      // falling snow
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 160; i++) { ctx.beginPath(); ctx.arc(r.next() * size, r.next() * size, 1 + r.next() * 1.8, 0, Math.PI * 2); ctx.fill(); }
    },
    board: {
      base: '#eef6fa',
      paint(ctx, r, size) {
        speckle(ctx, r, 240, size, size, ['#ffffff', '#9cc2d6', '#d4e8f2']);
        ctx.strokeStyle = 'rgba(120,170,200,0.45)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 10; i++) {
          const x = r.next() * size; const y = r.next() * size;
          for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 5, y - Math.sin(a) * 5); ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); ctx.stroke(); }
        }
      },
    },
  },
};

// The forest/wasteland around the board, for a theme.
export function drawThemeGround(theme, { size = 1024, seed = 11 } = {}) {
  const T = THEMES[theme];
  if (!T?.ground) return drawForest({ size, seed });
  const cv = canvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = T.groundBase;
  ctx.fillRect(0, 0, size, size);
  wrapped(ctx, size, size, () => T.ground(ctx, createRng(seed), size));
  applyGrain(ctx, size, size);
  return cv;
}

// The board's cloth, for a theme.
export function drawThemeBoard(theme, { size = 512, seed = 3, arena = false } = {}) {
  const T = THEMES[theme];
  if (!T?.board?.paint) return arena ? drawGrass({ base: '#c6c98f', tuft: 'rgba(110,105,55,0.4)', seed: 8 }) : drawGrass();
  const cv = canvas(size, size);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = T.board.base;
  ctx.fillRect(0, 0, size, size);
  if (arena) { ctx.fillStyle = 'rgba(120,100,60,0.12)'; ctx.fillRect(0, 0, size, size); }
  wrapped(ctx, size, size, () => T.board.paint(ctx, createRng(seed + (arena ? 5 : 0)), size));
  applyGrain(ctx, size, size);
  return cv;
}

// The wall band printed along the bottom of the board (top-down stones).
export function drawWallBand(wPx, hPx, seed = 5) {
  const cv = canvas(wPx, hPx);
  const ctx = cv.getContext('2d');
  const r = createRng(seed);
  ctx.fillStyle = '#cfc8b4';
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 40);
  ctx.fill();
  ctx.save();
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 40);
  ctx.clip();
  const rows = 6;
  const rh = hPx / rows;
  for (let row = 0; row < rows; row++) {
    let x = row % 2 ? -40 : 0;
    while (x < wPx) {
      const sw = 70 + r.next() * 70;
      const tone = ['#d8d1bd', '#c9c2ad', '#ddd7c4', '#c2bba6'][r.int(4)];
      ctx.fillStyle = tone;
      rrect(ctx, x + 4, row * rh + 4, sw - 8, rh - 8, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,36,28,0.28)';
      ctx.lineWidth = 3;
      ctx.stroke();
      x += sw;
    }
  }
  ctx.restore();
  applyGrain(ctx, wPx, hPx);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 40);
  ctx.stroke();
  return cv;
}

// ---------------------------------------------------------------- trinkets

// Metal by stack size: bronze, silver, gold, starmetal.
export const TRINKET_METAL = {
  2: { body: '#c8956a', dark: '#8a5a36', light: '#ecc39c', name: 'Bronze' },
  3: { body: '#b9c3cf', dark: '#6f7c8c', light: '#e8eef5', name: 'Silver' },
  4: { body: '#e9c25a', dark: '#a87b1c', light: '#fff0b0', name: 'Gold' },
  5: { body: '#a98ae0', dark: '#5d3fa0', light: '#e8dcff', name: 'Starmetal' },
};

export function drawTrinket(def, { art = null } = {}) {
  const { w, h } = CARD_PX;
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  const M = TRINKET_METAL[def.size];
  const R = 30;
  // body: dark cloth inside a metal frame
  ctx.save();
  rrect(ctx, 5, 5, w - 10, h - 10, R);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, M.light);
  g.addColorStop(0.5, M.body);
  g.addColorStop(1, M.dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2f2a3a';
  rrect(ctx, 22, 22, w - 44, h - 44, 22);
  ctx.fill();
  ctx.restore();
  // corner rivets
  for (const [x, y] of [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]]) {
    ctx.fillStyle = M.light;
    circle(ctx, x, y, 9);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // name plate
  ctx.fillStyle = M.body;
  rrect(ctx, 40, 36, w - 80, 66, 18);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, def.name, w - 110, 34, 900, 16);
  ctx.fillText(def.name, w / 2, 71);
  // art medallion
  const cx = w / 2;
  const cy = 252;
  const rad = 128;
  if (art) {
    ctx.save();
    circle(ctx, cx, cy, rad);
    ctx.clip();
    const sc = Math.max((rad * 2) / art.width, (rad * 2) / art.height);
    ctx.drawImage(art, cx - (art.width * sc) / 2, cy - (art.height * sc) / 2, art.width * sc, art.height * sc);
    ctx.restore();
  } else {
    const rg = ctx.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, rad);
    rg.addColorStop(0, '#5b4f72');
    rg.addColorStop(1, '#3a3249');
    ctx.fillStyle = rg;
    circle(ctx, cx, cy, rad);
    ctx.fill();
    // placeholder: the resource it was forged from, ringed with sparkles
    ctx.fillStyle = '#f6efdc';
    circle(ctx, cx, cy, 78);
    ctx.fill();
    glyph(ctx, def.res, cx, cy, 120);
    const sp = [[-98, -70, 26], [96, -84, 22], [104, 76, 18], [-104, 82, 16]];
    for (const [x, y, z] of sp.slice(0, def.size - 1)) glyph(ctx, 'bless', cx + x, cy + y, z);
  }
  ctx.lineWidth = 10;
  ctx.strokeStyle = M.body;
  circle(ctx, cx, cy, rad + 4);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  circle(ctx, cx, cy, rad + 9);
  ctx.stroke();
  // pips: one resource token per item in the stack
  const n = def.size;
  const step = 58;
  const x0 = cx - ((n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    ctx.fillStyle = '#f6efdc';
    circle(ctx, x, 438, 24);
    ctx.fill();
    ctx.strokeStyle = M.body;
    ctx.lineWidth = 5;
    ctx.stroke();
    glyph(ctx, def.res, x, 438, 34);
  }
  ctx.fillStyle = M.light;
  ctx.font = font(22, 900);
  ctx.textAlign = 'center';
  ctx.fillText(`${M.name.toUpperCase()} TRINKET`, cx, 492);
  // outer outline
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  rrect(ctx, 5, 5, w - 10, h - 10, R);
  ctx.stroke();
  return cv;
}

// The shelf the trinkets sit on: a strip of dark velvet with five
// gold-edged slots.
export function drawRackBand(wPx, hPx, slots, slotW, slotH, step, x0) {
  const cv = canvas(wPx, hPx);
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, hPx);
  g.addColorStop(0, '#5a3d58');
  g.addColorStop(1, '#3e2a40');
  ctx.fillStyle = g;
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 36);
  ctx.fill();
  // velvet nap
  const r = createRng(11);
  ctx.save();
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 36);
  ctx.clip();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r.chance(0.5) ? '#fff' : '#000';
    ctx.fillRect(r.next() * wPx, r.next() * hPx, 2, 6);
  }
  ctx.restore();
  // gold trim
  ctx.strokeStyle = '#e2b94e';
  ctx.lineWidth = 6;
  rrect(ctx, 16, 16, wPx - 32, hPx - 32, 26);
  ctx.stroke();
  // slots
  for (let i = 0; i < slots; i++) {
    const x = x0 + i * step - slotW / 2;
    const y = (hPx - slotH) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    rrect(ctx, x, y, slotW, slotH, 22);
    ctx.fill();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = 'rgba(242,214,140,0.65)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(242,214,140,0.5)';
    ctx.save();
    ctx.translate(x + slotW / 2, y + slotH / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-12, -12, 24, 24);
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  rrect(ctx, 4, 4, wPx - 8, hPx - 8, 36);
  ctx.stroke();
  return cv;
}

// Floating combat numbers, optionally followed by an icon. Canvas fits the text.
export function drawNumber(text, color, size = 96, icon = null) {
  const probe = canvas(8, 8).getContext('2d');
  probe.font = font(size, 900);
  const tw = probe.measureText(text).width;
  const iw = icon ? size * 0.95 : 0;
  const h = Math.round(size * 1.35);
  const w = Math.ceil(tw + iw + size * 0.5);
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.font = font(size, 900);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size / 6;
  ctx.strokeStyle = INK;
  const x0 = size * 0.25;
  ctx.strokeText(text, x0, h / 2 + size * 0.04);
  ctx.fillStyle = color;
  ctx.fillText(text, x0, h / 2 + size * 0.04);
  if (icon) {
    const cx = x0 + tw + iw / 2 + size * 0.05;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = size / 14;
    circle(ctx, cx, h / 2, iw * 0.46);
    ctx.fill();
    ctx.stroke();
    glyph(ctx, icon, cx, h / 2, iw * 0.66);
  }
  return cv;
}

export function drawPuff() {
  const cv = canvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  return cv;
}

export function drawSpark(color = '#f6cf4f') {
  const cv = canvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.translate(64, 64);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? 16 : 52;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return cv;
}

export function drawIconSprite(name, bg = PAPER) {
  const cv = canvas(128, 128);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  circle(ctx, 64, 64, 56);
  ctx.fill();
  ctx.stroke();
  glyph(ctx, name, 64, 66, 76);
  return cv;
}

// Data URL icons for the HTML HUD.
const iconCache = new Map();
export function iconURL(name, size = 64) {
  const k = `${name}:${size}`;
  if (!iconCache.has(k)) {
    const cv = canvas(size, size);
    glyph(cv.getContext('2d'), name, size / 2, size / 2, size * 0.9);
    iconCache.set(k, cv.toDataURL());
  }
  return iconCache.get(k);
}
