import type { Basis, Vec, Rng } from "./types.ts";
import { combine, norm, zeros } from "./vec.ts";
import { randInt } from "./rng.ts";
import { lll } from "./lll.ts";
import { babaiNearestPlane } from "./cvp.ts";

/**
 * Scene 4's attack, on "LWE-style" lattices of any dimension.
 *
 *  The lattice:  all integer vectors x with x ≡ s·[I | A] (mod q) — a q-ary lattice, the kind Kyber hides in.
 *  The ball:     target = (a random lattice point) + (a small random wobble).
 *  The attack:   LLL-reduce the public basis, then Babai nearest-plane from the ball.
 *                It "recovers the secret" if it lands on the planted point (or one at least as close).
 *
 * In low dimension LLL finds a good enough basis and the attack wins. As the dimension climbs, LLL
 * still finishes quickly, but its basis is no longer good enough and the attack starts landing on the
 * wrong point. With q = 97 and a wobble of ±3 the success rate falls from ~90% at n ≤ 12 to ~0 at n = 40.
 */
export interface AttackParams {
  q: number;
  /** Each wobble coordinate is a whole number in [-wobble, wobble]. */
  wobble: number;
}

export const ATTACK_PARAMS: AttackParams = { q: 97, wobble: 3 };

export interface PlantedInstance {
  /** Public basis: rows [I_k | A] and [0 | q·I]. Long and skewed. */
  basis: Basis;
  /** The planted lattice point (the secret). */
  point: Vec;
  /** The planted wobble. */
  error: Vec;
  /** The ball the attacker sees: point + error. */
  target: Vec;
}

/** A random LWE-style instance of dimension `dim` (k = ⌊dim/2⌋ secret coordinates). */
export function plantedInstance(dim: number, rng: Rng, params: AttackParams = ATTACK_PARAMS): PlantedInstance {
  const { q, wobble } = params;
  const k = Math.max(1, Math.floor(dim / 2));
  const basis: Basis = [];
  for (let i = 0; i < dim; i++) {
    const row = zeros(dim);
    if (i < k) {
      row[i] = 1;
      for (let j = k; j < dim; j++) row[j] = randInt(rng, 0, q - 1);
    } else row[i] = q;
    basis.push(row);
  }
  const s = Array.from({ length: dim }, () => randInt(rng, -q, q));
  const point = combine(basis, s);
  const error = Array.from({ length: dim }, () => randInt(rng, -wobble, wobble));
  const target = point.map((x, i) => x + error[i]);
  return { basis, point, error, target };
}

/** Kannan's embedding: append the ball as an extra row, so (error, 1) becomes a planted SHORT vector. */
export function embeddingBasis(basis: Basis, target: Vec): Basis {
  return [...basis.map((row) => [...row, 0]), [...target, 1]];
}

export interface AttackResult {
  dim: number;
  /** Babai on the LLL basis landed on the planted point (or one at least as close to the ball). */
  recovered: boolean;
  /** LLL was stopped by the time budget before it finished. */
  gaveUp: boolean;
  /** Length of the shortest vector LLL found in the embedded lattice. */
  shortestFound: number;
  /** Length of the planted short vector (error, 1). */
  planted: number;
}

/** Run the attack once. `shouldStop` lets the caller impose a time budget (then gaveUp = true). */
export function runAttack(inst: PlantedInstance, shouldStop?: () => boolean): AttackResult {
  const dim = inst.basis.length;
  const planted = norm([...inst.error, 1]);
  const fail = { dim, recovered: false, gaveUp: true, shortestFound: NaN, planted };
  const r = lll(inst.basis, 0.99, 1_000_000, { trace: false, shouldStop });
  if (!r.finished) return fail;
  const guess = babaiNearestPlane(r.reduced, inst.target);
  const recovered = guess.distance <= norm(inst.error) + 1e-9;
  const e = lll(embeddingBasis(inst.basis, inst.target), 0.99, 1_000_000, { trace: false, shouldStop });
  if (!e.finished) return fail;
  const shortestFound = Math.min(...e.reduced.map(norm).filter((x) => x > 1e-9));
  return { dim, recovered, gaveUp: false, shortestFound, planted };
}

/**
 * The 3 fixed lattices Scene 4 draws (dim 2, 3, 4): a good basis (short, nearly square)
 * and a bad basis of the SAME lattice (bad = U·good with U whole-numbered, det ±1).
 */
export function showcaseBases(dim: 2 | 3 | 4): { good: Basis; bad: Basis } {
  const good = tilt(dim);
  const U = UNIMODULAR[dim];
  return { good, bad: U.map((row) => combine(good, row)) };
}

const UNIMODULAR: Record<2 | 3 | 4, Basis> = {
  2: [
    [2, 1],
    [3, 2],
  ],
  3: [
    [2, 1, 1],
    [1, 1, 0],
    [3, 2, 2],
  ],
  4: [
    [1, 1, 0, 0],
    [1, 2, 1, 0],
    [0, 1, 2, 1],
    [1, 1, 1, 2],
  ],
};

/** An orthonormal-ish basis gently rotated off the axes (so it doesn't look like graph paper). */
function tilt(dim: number): Basis {
  const b: Basis = Array.from({ length: dim }, (_, i) => zeros(dim).map((_, j) => (i === j ? 1 : 0)));
  const rot = (a: number, c: number, th: number) => {
    for (const row of b) {
      const x = row[a], y = row[c];
      row[a] = Math.cos(th) * x - Math.sin(th) * y;
      row[c] = Math.sin(th) * x + Math.cos(th) * y;
    }
  };
  rot(0, 1, 0.26);
  if (dim >= 3) rot(1, 2, 0.35);
  if (dim >= 4) rot(2, 3, 0.3);
  return b;
}
