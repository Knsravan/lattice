import type { Vec, Basis } from "./types.ts";

export const dot = (a: Vec, b: Vec): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
export const add = (a: Vec, b: Vec): Vec => a.map((x, i) => x + b[i]);
export const sub = (a: Vec, b: Vec): Vec => a.map((x, i) => x - b[i]);
export const scale = (a: Vec, k: number): Vec => a.map((x) => x * k);
export const norm2 = (a: Vec): number => dot(a, a);
export const norm = (a: Vec): number => Math.sqrt(norm2(a));
export const zeros = (n: number): Vec => new Array<number>(n).fill(0);
export const clone = (a: Vec): Vec => a.slice();
export const cloneBasis = (b: Basis): Basis => b.map(clone);
export const approxEqual = (a: Vec, b: Vec, eps = 1e-9): boolean =>
  a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= eps);

/** Sum of coeffs[i] * basis[i]. */
export function combine(basis: Basis, coeffs: Vec): Vec {
  const out = zeros(basis[0].length);
  for (let i = 0; i < basis.length; i++) {
    const c = coeffs[i];
    if (c === 0) continue;
    const row = basis[i];
    for (let j = 0; j < out.length; j++) out[j] += c * row[j];
  }
  return out;
}

/** Determinant of a square matrix (rows), via Gaussian elimination with partial pivoting. */
export function determinant(m: Basis): number {
  const n = m.length;
  const a = cloneBasis(m);
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return 0;
    if (p !== c) {
      [a[p], a[c]] = [a[c], a[p]];
      det = -det;
    }
    det *= a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return det;
}

/** Inverse of a square matrix (rows). Throws if singular. */
export function inverse(m: Basis): Basis {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...zeros(n).map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) throw new Error("singular matrix");
    [a[p], a[c]] = [a[c], a[p]];
    const inv = 1 / a[c][c];
    for (let k = 0; k < 2 * n; k++) a[c][k] *= inv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f === 0) continue;
      for (let k = 0; k < 2 * n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row) => row.slice(n));
}

/** Solve x * basis = target for real coefficients x (row-vector convention). */
export function coordinates(basis: Basis, target: Vec): Vec {
  // x = target * inverse(basis)
  const inv = inverse(basis);
  const n = basis.length;
  const x = zeros(n);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += target[i] * inv[i][j];
    x[j] = s;
  }
  return x;
}
