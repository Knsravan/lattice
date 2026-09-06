import type { Rng } from "./types.ts";
import { mulberry32, randInt, centeredBinomial } from "./rng.ts";
import { mod, center } from "./lwe.ts";
import { sha256, concatBytes, utf8, xorStream } from "./hash.ts";

/**
 * Toy ML-KEM (Kyber): the same structure as the real thing, with tunable tiny parameters
 * so every intermediate value fits on screen.
 *
 * Ring:   R_q = Z_q[x] / (x^n + 1)         (polynomials of degree < n, coefficients mod q)
 * Module: vectors of k polynomials.
 *
 * KeyGen:  A random k×k,  s,e small  →  t = A·s + e           pk = (A, t), sk = s
 * Encrypt: r,e1,e2 small             →  u = Aᵀ·r + e1,  v = t·r + e2 + ⌈q/2⌋·m
 * Decrypt: m' = round( v − s·u )      (each coefficient: 1 if near q/2, 0 if near 0)
 *
 * The public key t is "a lattice point A·s plus a wobble e". Recovering s from t
 * is the Module-LWE problem — the same nearest-point-in-a-lattice puzzle as the scenes.
 */

export interface KyberParams {
  n: number; // polynomial degree
  q: number; // modulus
  k: number; // module rank
  eta: number; // noise width
}

export const KYBER_PRESETS: Record<"toy" | "demo" | "realShape", KyberParams> = {
  /** Tiny: everything visible, decryption can occasionally fail (noise is a big share of q). */
  toy: { n: 4, q: 17, k: 2, eta: 1 },
  /** Small but reliable: comfortable margin between noise and q/4. */
  demo: { n: 8, q: 257, k: 2, eta: 1 },
  /** The exact shape of ML-KEM-512 (n=256, q=3329, k=2, eta=2 for encryption noise). */
  realShape: { n: 256, q: 3329, k: 2, eta: 2 },
};

export type Poly = number[]; // length n
export type PolyVec = Poly[]; // length k
export type PolyMat = PolyVec[]; // k×k

export interface KyberPublicKey { A: PolyMat; t: PolyVec; params: KyberParams }
export interface KyberSecretKey { s: PolyVec; params: KyberParams; pkHash: Uint8Array }
export interface KyberCiphertext { u: PolyVec; v: Poly }

// ---------- polynomial arithmetic ----------

export function polyAdd(a: Poly, b: Poly, q: number): Poly {
  return a.map((x, i) => mod(x + b[i], q));
}
export function polySub(a: Poly, b: Poly, q: number): Poly {
  return a.map((x, i) => mod(x - b[i], q));
}
/** Multiply in Z_q[x]/(x^n+1): x^n = −1, so wrapped terms flip sign. */
export function polyMul(a: Poly, b: Poly, q: number): Poly {
  const n = a.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (a[i] === 0) continue;
    for (let j = 0; j < n; j++) {
      if (b[j] === 0) continue;
      const idx = i + j;
      if (idx < n) out[idx] += a[i] * b[j];
      else out[idx - n] -= a[i] * b[j];
    }
  }
  return out.map((x) => mod(x, q));
}
export function polyVecDot(a: PolyVec, b: PolyVec, q: number): Poly {
  const n = a[0].length;
  let acc: Poly = new Array<number>(n).fill(0);
  for (let i = 0; i < a.length; i++) acc = polyAdd(acc, polyMul(a[i], b[i], q), q);
  return acc;
}
export function matVecMul(A: PolyMat, v: PolyVec, q: number, transpose = false): PolyVec {
  const k = A.length;
  const out: PolyVec = [];
  for (let i = 0; i < k; i++) {
    const row: PolyVec = [];
    for (let j = 0; j < k; j++) row.push(transpose ? A[j][i] : A[i][j]);
    out.push(polyVecDot(row, v, q));
  }
  return out;
}

const randomPoly = (n: number, q: number, rng: Rng): Poly => Array.from({ length: n }, () => randInt(rng, 0, q - 1));
const smallPoly = (n: number, q: number, eta: number, rng: Rng): Poly =>
  Array.from({ length: n }, () => mod(centeredBinomial(rng, eta), q));
const smallVec = (p: KyberParams, rng: Rng): PolyVec => Array.from({ length: p.k }, () => smallPoly(p.n, p.q, p.eta, rng));

// ---------- PKE (the lattice part) ----------

export function kyberKeygen(params: KyberParams, rng: Rng): { pk: KyberPublicKey; sk: KyberSecretKey } {
  const { n, q, k } = params;
  const A: PolyMat = Array.from({ length: k }, () => Array.from({ length: k }, () => randomPoly(n, q, rng)));
  const s = smallVec(params, rng);
  const e = smallVec(params, rng);
  const As = matVecMul(A, s, q);
  const t = As.map((p, i) => polyAdd(p, e[i], q));
  const pk = { A, t, params };
  return { pk, sk: { s, params, pkHash: hashPublicKey(pk) } };
}

/** Encrypt an n-bit message polynomial (coefficients 0/1). */
export function kyberEncryptBits(pk: KyberPublicKey, m: (0 | 1)[], rng: Rng): KyberCiphertext {
  const { n, q } = pk.params;
  if (m.length !== n) throw new Error(`message must have exactly n=${n} bits`);
  const r = smallVec(pk.params, rng);
  const e1 = smallVec(pk.params, rng);
  const e2 = smallPoly(n, q, pk.params.eta, rng);
  const u = matVecMul(pk.A, r, q, true).map((p, i) => polyAdd(p, e1[i], q));
  const half = Math.round(q / 2);
  const scaled = m.map((bit) => mod(bit * half, q));
  const v = polyAdd(polyAdd(polyVecDot(pk.t, r, q), e2, q), scaled, q);
  return { u, v };
}

/** Decrypt to n bits. Also exposes the raw noisy values so scenes can draw "how close was it". */
export function kyberDecryptBits(sk: KyberSecretKey, ct: KyberCiphertext): { bits: (0 | 1)[]; raw: number[] } {
  const { q } = sk.params;
  const su = polyVecDot(sk.s, ct.u, q);
  const diff = polySub(ct.v, su, q);
  const raw = diff.map((x) => center(x, q));
  const bits = raw.map((x): 0 | 1 => (Math.abs(x) > q / 4 ? 1 : 0));
  return { bits, raw };
}

// ---------- KEM wrapper (what browsers actually use) ----------

function hashPublicKey(pk: KyberPublicKey): Uint8Array {
  const flat = [...pk.A.flat(2), ...pk.t.flat()];
  return sha256(utf8(JSON.stringify([pk.params, flat])));
}
function bitsToBytes(bits: (0 | 1)[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((b, i) => { if (b) out[i >> 3] |= 1 << (i & 7); });
  return out;
}
function seedFrom(bytes: Uint8Array): number {
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}
function ciphertextEqual(a: KyberCiphertext, b: KyberCiphertext): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface EncapsResult { ciphertext: KyberCiphertext; sharedSecret: Uint8Array; m: (0 | 1)[] }

/**
 * Encapsulate: pick a random n-bit m, derive coins from m (so encryption is reproducible),
 * encrypt m, and output sharedSecret = H(m || H(pk)).
 */
export function kyberEncaps(pk: KyberPublicKey, rng: Rng): EncapsResult {
  const m = Array.from({ length: pk.params.n }, (): 0 | 1 => (rng() < 0.5 ? 0 : 1));
  const pkHash = hashPublicKey(pk);
  const coins = sha256(concatBytes(bitsToBytes(m), pkHash));
  const ciphertext = kyberEncryptBits(pk, m, mulberry32(seedFrom(coins)));
  const sharedSecret = sha256(concatBytes(utf8("K"), bitsToBytes(m), pkHash));
  return { ciphertext, sharedSecret, m };
}

/**
 * Decapsulate: decrypt m', re-encrypt with the same derived coins, and only accept if the
 * ciphertext matches (Fujisaki–Okamoto check). On mismatch return a random-looking "reject" key.
 */
export function kyberDecaps(sk: KyberSecretKey, pk: KyberPublicKey, ct: KyberCiphertext): { sharedSecret: Uint8Array; ok: boolean; m: (0 | 1)[] } {
  const { bits: m } = kyberDecryptBits(sk, ct);
  const coins = sha256(concatBytes(bitsToBytes(m), sk.pkHash));
  const again = kyberEncryptBits(pk, m, mulberry32(seedFrom(coins)));
  const ok = ciphertextEqual(again, ct);
  const sharedSecret = ok
    ? sha256(concatBytes(utf8("K"), bitsToBytes(m), sk.pkHash))
    : sha256(concatBytes(utf8("reject"), utf8(JSON.stringify(ct)), sk.pkHash));
  return { sharedSecret, ok, m };
}

/** Demo helper: encrypt a text message with the shared secret (XOR keystream). */
export function sealMessage(sharedSecret: Uint8Array, text: string): Uint8Array {
  return xorStream(sharedSecret, utf8(text));
}
export function openMessage(sharedSecret: Uint8Array, sealed: Uint8Array): string {
  return new TextDecoder().decode(xorStream(sharedSecret, sealed));
}
