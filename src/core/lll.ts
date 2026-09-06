import type { Basis } from "./types.ts";
import { cloneBasis, dot, norm2, sub, scale, zeros } from "./vec.ts";

/** One step of LLL, recorded so a scene can replay the reduction as an animation. */
export type LLLStep =
  | { type: "reduce"; i: number; j: number; q: number; basis: Basis }
  | { type: "swap"; i: number; basis: Basis };

export interface LLLResult {
  reduced: Basis;
  trace: LLLStep[];
  /** Number of loop iterations (a rough "work" counter). */
  iterations: number;
}

/**
 * Lenstra–Lenstra–Lovász lattice basis reduction.
 * Returns a "good" basis of the same lattice (short, nearly orthogonal vectors)
 * plus a step-by-step trace. delta in (0.25, 1); 0.99 gives strong reduction.
 *
 * `maxSteps` bounds the work so a browser can bail out on hard high-dimensional inputs.
 */
export function lll(input: Basis, delta = 0.99, maxSteps = 200_000): LLLResult {
  const b = cloneBasis(input);
  const n = b.length;
  const trace: LLLStep[] = [];
  if (n === 0) return { reduced: b, trace, iterations: 0 };

  // Gram–Schmidt data, recomputed incrementally.
  const bstar: Basis = [];
  const B: number[] = zeros(n);
  const mu: number[][] = Array.from({ length: n }, () => zeros(n));

  const gsRow = (i: number) => {
    let v = b[i].slice();
    for (let j = 0; j < i; j++) {
      mu[i][j] = B[j] === 0 ? 0 : dot(b[i], bstar[j]) / B[j];
      v = sub(v, scale(bstar[j], mu[i][j]));
    }
    bstar[i] = v;
    B[i] = norm2(v);
  };
  for (let i = 0; i < n; i++) gsRow(i);

  let k = 1;
  let iterations = 0;
  while (k < n) {
    if (++iterations > maxSteps) break;
    // size-reduce b_k against b_{k-1}..b_0
    for (let j = k - 1; j >= 0; j--) {
      const q = Math.round(mu[k][j]);
      if (q !== 0) {
        for (let t = 0; t < n; t++) b[k][t] -= q * b[j][t];
        // b*_k is unchanged by this; only mu[k][*] moves. Recompute row k exactly.
        gsRow(k);
        trace.push({ type: "reduce", i: k, j, q, basis: cloneBasis(b) });
      }
    }
    // Lovász condition
    if (B[k] >= (delta - mu[k][k - 1] * mu[k][k - 1]) * B[k - 1]) {
      k++;
    } else {
      [b[k], b[k - 1]] = [b[k - 1], b[k]];
      trace.push({ type: "swap", i: k - 1, basis: cloneBasis(b) });
      // Rows at or after the swap depend on the changed b*_{k-1}, b*_k: refresh them all.
      for (let r = k - 1; r < n; r++) gsRow(r);
      k = Math.max(k - 1, 1);
    }
  }
  return { reduced: b, trace, iterations };
}

/** True if the basis satisfies the size-reduction and Lovász conditions. */
export function isLLLReduced(basis: Basis, delta = 0.99, eps = 1e-9): boolean {
  const n = basis.length;
  const bstar: Basis = [];
  const B: number[] = [];
  const mu: number[][] = [];
  for (let i = 0; i < n; i++) {
    let v = basis[i].slice();
    mu.push(zeros(n));
    for (let j = 0; j < i; j++) {
      mu[i][j] = B[j] === 0 ? 0 : dot(basis[i], bstar[j]) / B[j];
      v = sub(v, scale(bstar[j], mu[i][j]));
    }
    bstar.push(v);
    B.push(norm2(v));
  }
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) if (Math.abs(mu[i][j]) > 0.5 + eps) return false;
    if (B[i] < (delta - mu[i][i - 1] * mu[i][i - 1]) * B[i - 1] - eps) return false;
  }
  return true;
}
