import type { Basis, Vec, Rng } from "./types.ts";
import { dot, sub, scale, norm, norm2, combine, determinant, inverse, cloneBasis, zeros } from "./vec.ts";
import { randInt } from "./rng.ts";

export interface GramSchmidt {
  /** Orthogonalised vectors b*_i. */
  bstar: Basis;
  /** mu[i][j] = <b_i, b*_j> / <b*_j, b*_j> for j < i. */
  mu: number[][];
  /** |b*_i|^2 */
  B: number[];
}

/** Gram–Schmidt orthogonalisation (no normalisation), as used by Babai and LLL. */
export function gramSchmidt(basis: Basis): GramSchmidt {
  const n = basis.length;
  const bstar: Basis = [];
  const mu: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = basis[i].slice();
    mu.push(zeros(n));
    for (let j = 0; j < i; j++) {
      const m = B[j] === 0 ? 0 : dot(basis[i], bstar[j]) / B[j];
      mu[i][j] = m;
      v = sub(v, scale(bstar[j], m));
    }
    bstar.push(v);
    B.push(norm2(v));
  }
  return { bstar, mu, B };
}

/** Integer-coefficient combination of the basis. */
export function latticePoint(basis: Basis, coeffs: number[]): Vec {
  return combine(basis, coeffs);
}

/** |det(B)| — the volume of the fundamental cell. Unchanged by any change of basis. */
export function volume(basis: Basis): number {
  return Math.abs(determinant(basis));
}

/**
 * True when both bases generate the same lattice:
 * the change-of-basis matrix must be integer with determinant ±1.
 */
export function sameLattice(a: Basis, b: Basis, eps = 1e-6): boolean {
  if (a.length !== b.length) return false;
  let inv: Basis;
  try {
    inv = inverse(a);
  } catch {
    return false;
  }
  const n = a.length;
  // U = b * a^{-1}
  const U: Basis = b.map((row) => {
    const out = zeros(n);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += row[i] * inv[i][j];
      out[j] = s;
    }
    return out;
  });
  for (const row of U) for (const x of row) if (Math.abs(x - Math.round(x)) > eps) return false;
  return Math.abs(Math.abs(determinant(U)) - 1) < eps;
}

export interface LatticePointInfo {
  coeffs: number[];
  point: Vec;
}

/**
 * All lattice points with |point| <= radius (Euclidean), capped at maxPoints.
 * Coefficient ranges come from the inverse basis so we enumerate a tight integer box.
 */
export function pointsInBall(basis: Basis, radius: number, maxPoints = 5000): LatticePointInfo[] {
  const n = basis.length;
  const inv = inverse(basis);
  // coefficient k_j = sum_i p_i * inv[i][j]; |k_j| <= radius * |column j of inv|
  const bounds: number[] = [];
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += inv[i][j] * inv[i][j];
    bounds.push(Math.ceil(radius * Math.sqrt(s)));
  }
  const out: LatticePointInfo[] = [];
  const r2 = radius * radius;
  const coeffs = zeros(n);
  const rec = (d: number): boolean => {
    if (d === n) {
      const p = combine(basis, coeffs);
      if (norm2(p) <= r2) {
        out.push({ coeffs: coeffs.slice(), point: p });
        if (out.length >= maxPoints) return false;
      }
      return true;
    }
    for (let k = -bounds[d]; k <= bounds[d]; k++) {
      coeffs[d] = k;
      if (!rec(d + 1)) return false;
    }
    return true;
  };
  rec(0);
  return out;
}

/** Same as pointsInBall but with an axis-aligned box |p_i| <= half[i]. */
export function pointsInBox(basis: Basis, half: number[], maxPoints = 5000): LatticePointInfo[] {
  const radius = norm(half);
  return pointsInBall(basis, radius, Infinity)
    .filter(({ point }) => point.every((x, i) => Math.abs(x) <= half[i] + 1e-9))
    .slice(0, maxPoints);
}

/**
 * Apply random unimodular row operations so the returned basis generates the SAME lattice
 * but with long, skewed vectors. `steps` controls how bad it gets.
 */
export function skewBasis(basis: Basis, rng: Rng, steps = 20, maxCoeff = 3): Basis {
  const b = cloneBasis(basis);
  const n = b.length;
  if (n < 2) return b;
  for (let s = 0; s < steps; s++) {
    const i = randInt(rng, 0, n - 1);
    let j = randInt(rng, 0, n - 2);
    if (j >= i) j++;
    let q = randInt(rng, -maxCoeff, maxCoeff);
    if (q === 0) q = 1;
    // b_i += q * b_j  (determinant unchanged)
    for (let k = 0; k < n; k++) b[i][k] += q * b[j][k];
  }
  return b;
}

/** Identity basis Z^n. */
export function identityBasis(n: number): Basis {
  return Array.from({ length: n }, (_, i) => zeros(n).map((_, j) => (i === j ? 1 : 0)));
}

/** Hadamard ratio in (0,1]: 1 = perfectly orthogonal ("good"), near 0 = very skewed ("bad"). */
export function orthogonalityDefect(basis: Basis): number {
  const vol = volume(basis);
  const prod = basis.reduce((p, v) => p * norm(v), 1);
  if (prod === 0) return 0;
  return Math.pow(vol / prod, 1 / basis.length);
}
