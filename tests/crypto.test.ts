import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  lweKeygen, lweEncrypt, lweDecrypt, lweNoiseTerm, lweEncryptBits, lweDecryptBits, mod, center,
  mulberry32, sha256, toHex, utf8, xorStream, concatBytes,
  KYBER_PRESETS, kyberKeygen, kyberEncryptBits, kyberDecryptBits, kyberEncaps, kyberDecaps,
  polyMul, polyAdd, polySub, matVecMul, sealMessage, toyKemSizes, mlkemSizes, ML_KEM, openMessage, centeredBinomial, randInt,
} from "../src/core/index.ts";

describe("rng", () => {
  test("seeded rng is deterministic and in [0,1)", () => {
    const a = mulberry32(123), b = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const x = a();
      assert.equal(x, b());
      assert.ok(x >= 0 && x < 1);
    }
  });
  test("randInt covers the whole range; centeredBinomial stays within ±eta", () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(rng, -2, 2));
    assert.deepEqual([...seen].sort((a, b) => a - b), [-2, -1, 0, 1, 2]);
    for (let i = 0; i < 500; i++) assert.ok(Math.abs(centeredBinomial(rng, 2)) <= 2);
  });
});

describe("mod helpers", () => {
  test("mod is non-negative; center is in (-q/2, q/2]", () => {
    assert.equal(mod(-1, 17), 16);
    assert.equal(center(16, 17), -1);
    assert.equal(center(8, 17), 8);
    assert.equal(center(9, 17), -8);
  });
});

describe("lwe", () => {
  const params = { n: 8, m: 24, q: 257, eta: 1 };
  test("encrypt/decrypt round-trips both bits over many keys", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed);
      const { pk, sk } = lweKeygen(params, rng);
      for (let i = 0; i < 10; i++) {
        assert.equal(lweDecrypt(sk, lweEncrypt(pk, 0, rng)), 0);
        assert.equal(lweDecrypt(sk, lweEncrypt(pk, 1, rng)), 1);
      }
    }
  });
  test("noise term is small relative to q", () => {
    const rng = mulberry32(3);
    const { pk, sk } = lweKeygen(params, rng);
    for (let i = 0; i < 50; i++) {
      const ct = lweEncrypt(pk, 1, rng);
      assert.ok(Math.abs(lweNoiseTerm(sk, ct, 1)) < params.q / 4);
    }
  });
  test("bit arrays round-trip", () => {
    const rng = mulberry32(8);
    const { pk, sk } = lweKeygen(params, rng);
    const bits: (0 | 1)[] = [1, 0, 1, 1, 0, 0, 1, 0];
    assert.deepEqual(lweDecryptBits(sk, lweEncryptBits(pk, bits, rng)), bits);
  });
  test("with too much noise for the modulus, decryption fails sometimes", () => {
    const rng = mulberry32(4);
    const { pk, sk } = lweKeygen({ n: 4, m: 40, q: 17, eta: 3 }, rng);
    let wrong = 0;
    for (let i = 0; i < 200; i++) if (lweDecrypt(sk, lweEncrypt(pk, 0, rng)) !== 0) wrong++;
    assert.ok(wrong > 0);
  });
});

describe("hash", () => {
  test("sha256 known vectors", () => {
    assert.equal(toHex(sha256(utf8(""))), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert.equal(toHex(sha256(utf8("abc"))), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert.equal(
      toHex(sha256(utf8("The quick brown fox jumps over the lazy dog"))),
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
  });
  test("sha256 handles multi-block input (>64 bytes)", () => {
    const long = utf8("a".repeat(200));
    assert.equal(toHex(sha256(long)).length, 64);
    assert.equal(toHex(sha256(long)), toHex(sha256(concatBytes(utf8("a".repeat(100)), utf8("a".repeat(100))))));
  });
  test("xorStream is an involution and changes the data", () => {
    const key = sha256(utf8("k"));
    const data = utf8("hello lattice world, this is longer than thirty-two bytes for sure");
    const enc = xorStream(key, data);
    assert.notDeepEqual(Array.from(enc), Array.from(data));
    assert.deepEqual(Array.from(xorStream(key, enc)), Array.from(data));
  });
});

describe("poly arithmetic", () => {
  test("x^n = -1 wraps with a sign flip", () => {
    // (x^3) * (x) in Z_17[x]/(x^4+1) = x^4 = -1 = 16
    assert.deepEqual(polyMul([0, 0, 0, 1], [0, 1, 0, 0], 17), [16, 0, 0, 0]);
    assert.deepEqual(polyMul([1, 1, 0, 0], [1, 1, 0, 0], 17), [1, 2, 1, 0]);
  });
  test("add/sub are inverses", () => {
    const a = [1, 2, 3, 4], b = [16, 0, 5, 9];
    assert.deepEqual(polySub(polyAdd(a, b, 17), b, 17), a);
  });
});

describe("kyber", () => {
  test("demo preset: PKE round-trips n bits for many keys", () => {
    const p = KYBER_PRESETS.demo;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      const { pk, sk } = kyberKeygen(p, rng);
      const m = Array.from({ length: p.n }, (): 0 | 1 => (rng() < 0.5 ? 0 : 1));
      const ct = kyberEncryptBits(pk, m, rng);
      const { bits, raw } = kyberDecryptBits(sk, ct);
      assert.deepEqual(bits, m, `seed ${seed}`);
      assert.equal(raw.length, p.n);
    }
  });
  test("scene preset (n=8, q=97): KEM always agrees, the wobble is t − A·s, all values two digits", () => {
    const p = KYBER_PRESETS.scene;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const { pk, sk, e } = kyberKeygen(p, rng);
      const As = matVecMul(pk.A, sk.s, p.q);
      pk.t.forEach((poly, i) => assert.deepEqual(polySub(poly, As[i], p.q), e[i]));
      const enc = kyberEncaps(pk, rng);
      const dec = kyberDecaps(sk, pk, enc.ciphertext);
      assert.ok(dec.ok, `seed ${seed}`);
      assert.equal(toHex(dec.sharedSecret), toHex(enc.sharedSecret));
      const { raw } = kyberDecryptBits(sk, enc.ciphertext);
      // comfortable margin: the leftover wobble stays under 18 of the 24 hours allowed (worst seen in 5000 keys: 13)
      raw.forEach((x, i) => assert.ok(enc.m[i] ? 48.5 - Math.abs(x) < 18 : Math.abs(x) < 18, `seed ${seed}: ${x}`));
      for (const c of [...pk.t, ...enc.ciphertext.u, enc.ciphertext.v].flat()) assert.ok(c >= 0 && c < 97);
    }
  });
  test("ML-KEM sizes match FIPS 203 for all three parameter sets", () => {
    assert.deepEqual(mlkemSizes(ML_KEM[512]), { publicKey: 800, ciphertext: 768, sharedKey: 32 });
    assert.deepEqual(mlkemSizes(ML_KEM[768]), { publicKey: 1184, ciphertext: 1088, sharedKey: 32 });
    assert.deepEqual(mlkemSizes(ML_KEM[1024]), { publicKey: 1568, ciphertext: 1568, sharedKey: 32 });
  });
  test("toy sizes count exactly what the scene shows (7 bits per number at q = 97)", () => {
    const p = KYBER_PRESETS.scene;
    const rng = mulberry32(3);
    const { pk } = kyberKeygen(p, rng);
    const enc = kyberEncaps(pk, rng);
    const pkNumbers = pk.A.flat(2).length + pk.t.flat().length; // 32 + 16
    const ctNumbers = enc.ciphertext.u.flat().length + enc.ciphertext.v.length; // 16 + 8
    const sizes = toyKemSizes(p);
    assert.equal(sizes.publicKey, Math.ceil((pkNumbers * 7) / 8));
    assert.equal(sizes.ciphertext, Math.ceil((ctNumbers * 7) / 8));
    assert.equal(sizes.sharedKey, enc.sharedSecret.length);
    assert.deepEqual(sizes, { publicKey: 42, ciphertext: 21, sharedKey: 32 });
  });
  test("toy preset: mostly works, and every value is small enough to display", () => {
    const p = KYBER_PRESETS.toy;
    let ok = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed);
      const { pk, sk } = kyberKeygen(p, rng);
      const m = Array.from({ length: p.n }, (): 0 | 1 => (rng() < 0.5 ? 0 : 1));
      const ct = kyberEncryptBits(pk, m, rng);
      if (kyberDecryptBits(sk, ct).bits.every((b, i) => b === m[i])) ok++;
      for (const poly of [...pk.t, ...ct.u, ct.v]) for (const c of poly) assert.ok(c >= 0 && c < p.q);
    }
    assert.ok(ok >= 70, `toy params should mostly work, got ${ok}/100`);
  });
  test("realShape preset (n=256, q=3329): KEM agrees on the shared secret", () => {
    const rng = mulberry32(2024);
    const { pk, sk } = kyberKeygen(KYBER_PRESETS.realShape, rng);
    const enc = kyberEncaps(pk, rng);
    const dec = kyberDecaps(sk, pk, enc.ciphertext);
    assert.ok(dec.ok);
    assert.equal(toHex(dec.sharedSecret), toHex(enc.sharedSecret));
    assert.deepEqual(dec.m, enc.m);
  });
  test("KEM: tampered ciphertext is rejected with a different key", () => {
    const rng = mulberry32(99);
    const { pk, sk } = kyberKeygen(KYBER_PRESETS.demo, rng);
    const enc = kyberEncaps(pk, rng);
    const tampered = { u: enc.ciphertext.u, v: enc.ciphertext.v.map((x, i) => (i === 0 ? (x + 1) % pk.params.q : x)) };
    const dec = kyberDecaps(sk, pk, tampered);
    assert.equal(dec.ok, false);
    assert.notEqual(toHex(dec.sharedSecret), toHex(enc.sharedSecret));
  });
  test("wrong secret key does not recover the shared secret", () => {
    const rng = mulberry32(5);
    const alice = kyberKeygen(KYBER_PRESETS.demo, rng);
    const eve = kyberKeygen(KYBER_PRESETS.demo, rng);
    const enc = kyberEncaps(alice.pk, rng);
    const dec = kyberDecaps(eve.sk, alice.pk, enc.ciphertext);
    assert.notEqual(toHex(dec.sharedSecret), toHex(enc.sharedSecret));
  });
  test("message seal/open with the shared secret", () => {
    const rng = mulberry32(1);
    const { pk, sk } = kyberKeygen(KYBER_PRESETS.demo, rng);
    const enc = kyberEncaps(pk, rng);
    const dec = kyberDecaps(sk, pk, enc.ciphertext);
    const sealed = sealMessage(enc.sharedSecret, "meet me at the lattice 🔐");
    assert.equal(openMessage(dec.sharedSecret, sealed), "meet me at the lattice 🔐");
  });
  test("encrypt rejects wrong message length", () => {
    const { pk } = kyberKeygen(KYBER_PRESETS.demo, mulberry32(1));
    assert.throws(() => kyberEncryptBits(pk, [0, 1], mulberry32(2)));
  });
});
