import type { Rng } from "./types.ts";
import { randInt, centeredBinomial } from "./rng.ts";

/**
 * Toy Learning-With-Errors encryption of ONE bit (Regev's scheme).
 *
 *   secret  s  in Z_q^n
 *   public  (A, b = A·s + e mod q)   A is m×n, e is small noise
 *   encrypt bit: pick random subset r in {0,1}^m
 *                u = rᵀA mod q,  v = r·b + bit·⌊q/2⌋ mod q
 *   decrypt:     d = v − u·s mod q;  bit = 1 if d is closer to q/2 than to 0
 *
 * Geometrically: b is a lattice point (A·s) plus a wobble (e). Decrypting is
 * finding the nearest lattice point — easy if you know s, hard otherwise.
 */
export interface LweParams {
  n: number; // secret dimension
  m: number; // number of samples (rows of A)
  q: number; // modulus
  eta: number; // noise width (centered binomial)
}

export interface LwePublicKey {
  A: number[][];
  b: number[];
  params: LweParams;
}
export interface LweSecretKey {
  s: number[];
  params: LweParams;
}
export interface LweCiphertext {
  u: number[];
  v: number;
}

export const mod = (x: number, q: number): number => ((x % q) + q) % q;
/** Map to the centered representative in (-q/2, q/2]. */
export const center = (x: number, q: number): number => {
  const r = mod(x, q);
  return r > q / 2 ? r - q : r;
};

export function lweKeygen(params: LweParams, rng: Rng): { pk: LwePublicKey; sk: LweSecretKey } {
  const { n, m, q, eta } = params;
  const s = Array.from({ length: n }, () => randInt(rng, 0, q - 1));
  const A = Array.from({ length: m }, () => Array.from({ length: n }, () => randInt(rng, 0, q - 1)));
  const b = A.map((row) => {
    let acc = 0;
    for (let i = 0; i < n; i++) acc += row[i] * s[i];
    return mod(acc + centeredBinomial(rng, eta), q);
  });
  return { pk: { A, b, params }, sk: { s, params } };
}

export function lweEncrypt(pk: LwePublicKey, bit: 0 | 1, rng: Rng): LweCiphertext {
  const { n, m, q } = pk.params;
  const r = Array.from({ length: m }, () => (rng() < 0.5 ? 0 : 1));
  const u = new Array<number>(n).fill(0);
  let v = 0;
  for (let i = 0; i < m; i++) {
    if (!r[i]) continue;
    for (let j = 0; j < n; j++) u[j] += pk.A[i][j];
    v += pk.b[i];
  }
  return { u: u.map((x) => mod(x, q)), v: mod(v + bit * Math.floor(q / 2), q) };
}

export function lweDecrypt(sk: LweSecretKey, ct: LweCiphertext): 0 | 1 {
  const { q } = sk.params;
  let us = 0;
  for (let i = 0; i < sk.s.length; i++) us += ct.u[i] * sk.s[i];
  const d = center(ct.v - us, q);
  return Math.abs(d) > q / 4 ? 1 : 0;
}

/** The raw "wobble" an attacker sees: the decryption value before rounding. Useful for plots. */
export function lweNoiseTerm(sk: LweSecretKey, ct: LweCiphertext, bit: 0 | 1): number {
  const { q } = sk.params;
  let us = 0;
  for (let i = 0; i < sk.s.length; i++) us += ct.u[i] * sk.s[i];
  return center(ct.v - us - bit * Math.floor(q / 2), q);
}

/** Encrypt a byte array bit by bit (demo only — very inefficient, as real LWE bit-encryption is). */
export function lweEncryptBits(pk: LwePublicKey, bits: (0 | 1)[], rng: Rng): LweCiphertext[] {
  return bits.map((b) => lweEncrypt(pk, b, rng));
}
export function lweDecryptBits(sk: LweSecretKey, cts: LweCiphertext[]): (0 | 1)[] {
  return cts.map((c) => lweDecrypt(sk, c));
}
