import type { Basis, Vec } from "./types.ts";
import { gramSchmidt } from "./lattice.ts";
import { dot, sub, scale, combine, norm2, coordinates, zeros } from "./vec.ts";
import { lll } from "./lll.ts";

export interface CvpResult {
  coeffs: number[];
  point: Vec;
  distance: number;
}

/**
 * Babai's nearest-plane algorithm.
 * With a good (reduced) basis this finds the closest lattice point.
 * With a bad (skewed) basis it is often wrong — that is exactly the secret-key trick.
 */
export function babaiNearestPlane(basis: Basis, target: Vec): CvpResult {
  const n = basis.length;
  const { bstar, B } = gramSchmidt(basis);
  const coeffs = zeros(n);
  let t = target.slice();
  for (let i = n - 1; i >= 0; i--) {
    const c = B[i] === 0 ? 0 : Math.round(dot(t, bstar[i]) / B[i]) + 0;
    coeffs[i] = c;
    t = sub(t, scale(basis[i], c));
  }
  const point = combine(basis, coeffs);
  return { coeffs, point, distance: Math.sqrt(norm2(sub(target, point))) };
}

/** Babai's simpler "round-off" algorithm: round the real coordinates. Even more basis-sensitive. */
export function babaiRounding(basis: Basis, target: Vec): CvpResult {
  const coeffs = coordinates(basis, target).map((x) => Math.round(x) + 0);
  const point = combine(basis, coeffs);
  return { coeffs, point, distance: Math.sqrt(norm2(sub(target, point))) };
}

/**
 * Exact closest vector for small dimensions (intended for dim <= 4):
 * LLL-reduce, take Babai's answer, then exhaustively search a window of
 * coefficients around it in the reduced basis. Coefficients are returned
 * in terms of the ORIGINAL basis.
 */
export function closestVectorExact(basis: Basis, target: Vec, window = 3): CvpResult {
  const { reduced } = lll(basis);
  const n = reduced.length;
  const guess = babaiNearestPlane(reduced, target);
  let best = guess;
  const c = guess.coeffs.slice();
  const rec = (d: number) => {
    if (d === n) {
      const p = combine(reduced, c);
      const d2 = norm2(sub(target, p));
      if (d2 < best.distance * best.distance - 1e-12) {
        best = { coeffs: c.slice(), point: p, distance: Math.sqrt(d2) };
      }
      return;
    }
    const base = guess.coeffs[d];
    for (let k = base - window; k <= base + window; k++) {
      c[d] = k;
      rec(d + 1);
    }
  };
  rec(0);
  // express in original basis
  const origCoeffs = coordinates(basis, best.point).map((x) => Math.round(x) + 0); // +0 normalises -0
  return { coeffs: origCoeffs, point: combine(basis, origCoeffs), distance: best.distance };
}
