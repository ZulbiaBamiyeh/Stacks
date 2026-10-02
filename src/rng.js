// Small seeded RNG (mulberry32). State is a single uint32 so it can be saved.
export function createRng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    get state() { return s; },
    set state(v) { s = v >>> 0; },
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let r = next() * total;
      for (const [v, w] of pairs) {
        r -= w;
        if (r < 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
  };
}

export const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;
