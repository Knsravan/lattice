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
  /** False when the run was cut short by `maxSteps` or `shouldStop`. */
  finished: boolean;
}

export interface LLLOptions {
  /** Record every step (default true). Turn off for big runs: each step copies the basis. */
  trace?: boolean;
  /** Polled every few iterations; return true to give up (e.g. a time budget). */
  shouldStop?: () => boolean;
}

/**
 * Lenstra–Lenstra–Lovász lattice basis reduction.
 * Returns a "good" basis of the same lattice (short, nearly orthogonal vectors)
 * plus a step-by-step trace. delta in (0.25, 1); 0.99 gives strong reduction.
 *
 * Gram–Schmidt data is updated incrementally (textbook formulas), so each step is O(n)
 * and n = 40 runs in well under a second.
 * `maxSteps` bounds the work so a browser can bail out on hard high-dimensional inputs.
 */
export function lll(input: Basis, delta = 0.99, maxSteps = 200_000, opts: LLLOptions = {}): LLLResult {
  const record = opts.trace ?? true;
  const b = cloneBasis(input);
  const n = b.length;
  const trace: LLLStep[] = [];
  if (n === 0) return { reduced: b, trace, iterations: 0, finished: true };

  // Gram–Schmidt data: mu[i][j] and B[i] = |b*_i|^2.
  const B: number[] = zeros(n);
  const mu: number[][] = Array.from({ length: n }, () => zeros(n));
  const bstar: Basis = [];
  for (let i = 0; i < n; i++) {
    let v = b[i].slice();
    for (let j = 0; j < i; j++) {
      mu[i][j] = B[j] === 0 ? 0 : dot(b[i], bstar[j]) / B[j];
      v = sub(v, scale(bstar[j], mu[i][j]));
    }
    bstar.push(v);
    B[i] = norm2(v);
  }

  let k = 1;
  let iterations = 0;
  let finished = true;
  while (k < n) {
    if (++iterations > maxSteps || (opts.shouldStop && (iterations & 63) === 0 && opts.shouldStop())) {
      finished = false;
      break;
    }
    // size-reduce b_k against b_{k-1}..b_0
    for (let j = k - 1; j >= 0; j--) {
      const q = Math.round(mu[k][j]);
      if (q !== 0) {
        const bk = b[k], bj = b[j];
        for (let t = 0; t < n; t++) bk[t] -= q * bj[t];
        // b*_k is unchanged by this; only mu[k][0..j] moves.
        mu[k][j] -= q;
        for (let l = 0; l < j; l++) mu[k][l] -= q * mu[j][l];
        if (record) trace.push({ type: "reduce", i: k, j, q, basis: cloneBasis(b) });
      }
    }
    // Lovász condition
    const m = mu[k][k - 1];
    if (B[k] >= (delta - m * m) * B[k - 1]) {
      k++;
    } else {
      [b[k], b[k - 1]] = [b[k - 1], b[k]];
      if (record) trace.push({ type: "swap", i: k - 1, basis: cloneBasis(b) });
      // Standard update of the Gram–Schmidt data after swapping b_{k-1} and b_k.
      for (let j = 0; j < k - 1; j++) [mu[k][j], mu[k - 1][j]] = [mu[k - 1][j], mu[k][j]];
      const Bnew = B[k] + m * m * B[k - 1];
      if (Bnew === 0) break; // degenerate input
      const mNew = (m * B[k - 1]) / Bnew;
      B[k] = (B[k - 1] * B[k]) / Bnew;
      B[k - 1] = Bnew;
      mu[k][k - 1] = mNew;
      for (let i = k + 1; i < n; i++) {
        const t = mu[i][k];
        mu[i][k] = mu[i][k - 1] - m * t;
        mu[i][k - 1] = t + mNew * mu[i][k];
      }
      k = Math.max(k - 1, 1);
    }
  }
  return { reduced: b, trace, iterations, finished };
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
