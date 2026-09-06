import type { Rng } from "./types.ts";

/** Seeded PRNG (mulberry32). Same seed => same sequence, so scenes and tests are reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [lo, hi] inclusive. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Small "centered binomial" noise in [-eta, eta], peaked at 0.
 * This is the noise shape real Kyber uses.
 */
export function centeredBinomial(rng: Rng, eta: number): number {
  let s = 0;
  for (let i = 0; i < eta; i++) s += (rng() < 0.5 ? 1 : 0) - (rng() < 0.5 ? 1 : 0);
  return s;
}
