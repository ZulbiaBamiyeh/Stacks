// Poison and burn living inside the health bar, The Bazaar style: the fill
// turns toxic green and bubbles when poisoned, and catches fire when burning.
// Both grow stronger with the stack size. Drawn procedurally in a shader that
// sits between the bar's fill and its HP number.
import * as THREE from 'three';

// Inner bar rectangle in the bar plane's local units (see BAR_PX in fortress.js).
const INNER = { cy: 0.025, hx: 4.6833, hy: 0.4917, r: 0.2333 };
// The plane reaches above the bar so flames can lick past its top edge.
const PAD = { x: 0.2, below: 0.15, above: 1.1 };

const vertex = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragment = /* glsl */ `
uniform float uTime;
uniform float uFill;
uniform float uPoison;
uniform float uBurn;
uniform float uSeed;
varying vec2 vPos;

const vec2 C = vec2(0.0, ${INNER.cy.toFixed(4)});
const vec2 HB = vec2(${INNER.hx.toFixed(4)}, ${INNER.hy.toFixed(4)});
const float RAD = ${INNER.r.toFixed(4)};

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec4 over(vec4 dst, vec3 c, float a) {
  float oa = a + dst.a * (1.0 - a);
  vec3 oc = (c * a + dst.rgb * dst.a * (1.0 - a)) / max(oa, 1e-4);
  return vec4(oc, oa);
}

// One layer of rising bubbles. Returns the layer composited over col.
vec4 bubbles(vec4 col, vec2 p, float cell, float speed, float k, float seed, float mask) {
  vec2 q = p;
  q.y -= uTime * speed;
  vec2 g = q / cell;
  vec2 id = floor(g);
  float h = hash(id + seed);
  if (h > 0.1 + 0.3 * k) return col;
  // sideways wobble as it rises
  g.x += sin(uTime * 2.3 + id.y * 1.7 + seed) * 0.12;
  vec2 f = fract(g);
  vec2 o = vec2(0.3 + 0.4 * hash(id + seed * 3.1), 0.3 + 0.4 * hash(id + seed * 7.7));
  float r = (0.15 + 0.2 * hash(id + seed + 5.0)) * (0.85 + 0.35 * k);
  vec2 d = (f - o) * cell;
  r *= cell;
  float dist = length(d);
  float aa = fwidth(dist) * 1.2;
  float body = 1.0 - smoothstep(r - aa, r + aa, dist);
  if (body <= 0.0) return col;
  // bubbles swell a little and pop as they reach the surface
  float top = smoothstep(HB.y - 0.02, HB.y - 0.2, p.y);
  float rim = smoothstep(r * 0.55, r, dist) * body;
  vec3 inner = mix(vec3(0.62, 0.95, 0.36), vec3(0.2, 0.48, 0.12), k);
  col = over(col, inner, body * 0.35 * mask * top);
  // soft shade on the lower half gives each bubble some roundness
  col = over(col, vec3(0.05, 0.2, 0.04), body * smoothstep(0.0, -r, d.y) * 0.18 * mask * top);
  col = over(col, mix(vec3(0.86, 1.0, 0.62), vec3(0.62, 0.9, 0.38), k), rim * 0.7 * mask * top);
  // specular glint, upper left
  float s = length(d - vec2(-0.38, 0.38) * r);
  float glint = 1.0 - smoothstep(r * 0.16, r * 0.3, s);
  col = over(col, vec3(1.0), glint * 0.95 * mask * top);
  return col;
}

void main() {
  vec2 p = vPos - C;
  float inner = sdBox(p, HB, RAD);
  float aa = fwidth(inner) * 1.2;
  float inside = 1.0 - smoothstep(-aa, aa, inner);
  float fillX = -HB.x + 2.0 * HB.x * uFill;
  float fx = fwidth(p.x) * 1.2;
  float xMask = 1.0 - smoothstep(fillX - fx, fillX + fx, p.x);
  float mask = inside * xMask;
  float hN = (p.y + HB.y) / (2.0 * HB.y);
  vec4 col = vec4(0.0);

  if (uPoison > 0.001) {
    float k = uPoison;
    // toxic tint that darkens as the stack grows, with slow churning clouds
    vec3 toxic = mix(vec3(0.52, 0.88, 0.22), vec3(0.08, 0.25, 0.06), k);
    float n = fbm(p * vec2(1.1, 2.4) + vec2(uTime * 0.12 + uSeed, -uTime * 0.32));
    toxic *= 0.78 + 0.42 * n;
    toxic *= 0.82 + 0.3 * hN;
    float streak = smoothstep(0.56, 0.78, fbm(p * vec2(0.7, 3.2) + vec2(-uTime * 0.18, uTime * 0.1) + uSeed));
    toxic = mix(toxic, vec3(0.78, 1.0, 0.5), streak * (0.35 - 0.15 * k));
    col = over(col, toxic, mask * (0.42 + 0.5 * k));
    // a sickly sheen along the surface
    col = over(col, vec3(0.7, 0.95, 0.45), mask * smoothstep(0.75, 1.0, hN) * (0.25 - 0.1 * k));
    col = bubbles(col, p, 0.46, 0.18 + 0.22 * k, k, 1.0 + uSeed, mask);
    col = bubbles(col, p, 0.3, 0.26 + 0.3 * k, k, 9.0 + uSeed, mask);
    col = bubbles(col, p, 0.2, 0.36 + 0.3 * k, k * 0.6, 21.0 + uSeed, mask);
  }

  if (uBurn > 0.001) {
    float k = uBurn;
    // warm glow through the whole fill
    col = over(col, mix(vec3(0.95, 0.42, 0.1), vec3(1.0, 0.55, 0.15), k), mask * (0.14 + 0.24 * k));
    // licking flames: warped noise scrolling upward
    vec2 fq = vec2(p.x * 3.2 + uSeed, p.y * 1.7 - uTime * 2.3);
    float n1 = fbm(fq);
    float n2 = fbm(fq + vec2(n1 * 1.7, -uTime * 0.7));
    float reach = 0.55 + 0.75 * k;
    float flame = n2 * 1.45 - hN / reach * 0.62;
    float shape = smoothstep(0.3, 0.6, flame);
    float heat = clamp((flame - 0.3) * 2.2, 0.0, 1.5) * (0.75 + 0.35 * k);
    vec3 fc = mix(vec3(0.7, 0.1, 0.03), vec3(1.0, 0.38, 0.04), smoothstep(0.0, 0.45, heat));
    fc = mix(fc, vec3(1.0, 0.7, 0.16), smoothstep(0.45, 0.9, heat));
    fc = mix(fc, vec3(1.0, 0.93, 0.62), smoothstep(1.0, 1.4, heat));
    fc *= 0.92 + 0.15 * k + 0.06 * sin(uTime * 19.0 + p.x * 4.0);
    // inside the fill, and spilling over the top edge above it
    float above = step(HB.y - 0.02, p.y) * step(abs(p.x), HB.x) * xMask;
    float spill = above * (1.0 - smoothstep(0.0, 0.25 + 0.75 * k, p.y - HB.y));
    float fm = max(mask, spill * smoothstep(0.08, 0.3, k));
    col = over(col, fc, shape * fm * (0.7 + 0.25 * k));
    // hot rim glow along the top edge
    float rim = above * (1.0 - smoothstep(0.0, 0.14 + 0.1 * k, p.y - HB.y));
    col = over(col, vec3(1.0, 0.55, 0.12), rim * (0.08 + 0.16 * k) * (0.7 + 0.3 * n1));
    // embers drifting up out of it
    vec2 eq = p;
    eq.y -= uTime * (0.7 + 0.5 * k);
    eq.x += sin(eq.y * 3.0 + uTime) * 0.08;
    vec2 eg = eq / 0.2;
    vec2 eid = floor(eg);
    if (hash(eid + 3.3) < 0.1 + 0.3 * k) {
      vec2 eo = vec2(0.2 + 0.6 * hash(eid + 1.9), 0.2 + 0.6 * hash(eid + 4.1));
      float ed = length((fract(eg) - eo) * 0.2);
      float er = 0.014 + 0.012 * hash(eid + 8.0);
      float ea = fwidth(ed);
      float ember = 1.0 - smoothstep(er - ea, er + ea, ed);
      float life = 1.0 - smoothstep(HB.y, HB.y + 0.35 + 0.5 * k, p.y);
      col = over(col, vec3(1.0, 0.9, 0.55), ember * max(mask, above) * life * (0.6 + 0.4 * k));
    }
  }

  gl_FragColor = col;
}`;

export function createBarFx(BAR, seed = 0) {
  const h = BAR.h + PAD.below + PAD.above;
  const geo = new THREE.PlaneGeometry(BAR.w + PAD.x * 2, h);
  geo.translate(0, (PAD.above - PAD.below) / 2, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 }, uFill: { value: 1 }, uPoison: { value: 0 }, uBurn: { value: 0 }, uSeed: { value: seed } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return {
    mesh,
    // fill: displayed HP fraction; poison/burn: stack sizes on this side.
    update(dt, fill, poisonK, burnK) {
      const u = mat.uniforms;
      u.uTime.value += dt;
      u.uFill.value = fill;
      u.uPoison.value += (poisonK - u.uPoison.value) * Math.min(1, dt * 3);
      u.uBurn.value += (burnK - u.uBurn.value) * Math.min(1, dt * 3);
      if (u.uPoison.value < 0.002) u.uPoison.value = 0;
      if (u.uBurn.value < 0.002) u.uBurn.value = 0;
      mesh.visible = u.uPoison.value > 0 || u.uBurn.value > 0;
    },
    reset() {
      mat.uniforms.uPoison.value = 0;
      mat.uniforms.uBurn.value = 0;
      mesh.visible = false;
    },
  };
}

// How strong each effect looks for a given stack. Poison saturates around 200,
// burn (which halves every tick) around 80. Square roots so small stacks show.
export const poisonLevel = (n) => (n > 0 ? Math.max(0.12, Math.sqrt(Math.min(1, n / 200))) : 0);
export const burnLevel = (n) => (n > 0 ? Math.max(0.14, Math.sqrt(Math.min(1, n / 80))) : 0);
