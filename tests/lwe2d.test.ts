import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encode2d, decode2d, halfStepOf, safeWobble, randomWobble, mulberry32, norm, sameLattice, coordinates } from "../src/core/index.ts";

const GOOD = [[1.2, 0.32], [-0.32, 1.2]];
const g = (a: number, b: number) => [a * GOOD[0][0] + b * GOOD[1][0], a * GOOD[0][1] + b * GOOD[1][1]];
const BAD = [g(4, 1), g(3, 1)]; // determinant 1 → same lattice
const H = halfStepOf(GOOD);

function trial(magnitude: number, n = 400, seed = 1) {
  const rng = mulberry32(seed);
  let owner = 0, eaves = 0;
  for (let i = 0; i < n; i++) {
    const bit = (i % 2) as 0 | 1;
    const s = encode2d(BAD, bit, H, magnitude, rng);
    if (decode2d(GOOD, s.ball).bit === bit) owner++;
    if (decode2d(BAD, s.ball).bit === bit) eaves++;
  }
  return { owner: owner / n, eaves: eaves / n };
}

describe("lwe2d", () => {
  test("the public key really is the same lattice", () => assert.ok(sameLattice(GOOD, BAD)));
  test("randomWobble stays within magnitude and is exactly zero at zero", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) assert.ok(norm(randomWobble(0.3, rng)) <= 0.3 + 1e-12);
    assert.deepEqual(randomWobble(0, rng), [0, 0]);
  });
  test("encode: dot is on the lattice; clean = dot (+ halfStep); ball = clean + wobble", () => {
    const rng = mulberry32(2);
    const s0 = encode2d(BAD, 0, H, 0.2, rng);
    const s1 = encode2d(BAD, 1, H, 0.2, rng);
    for (const s of [s0, s1]) assert.ok(coordinates(GOOD, s.dot).every((c) => Math.abs(c - Math.round(c)) < 1e-9));
    assert.deepEqual(s0.clean, s0.dot);
    assert.ok(Math.abs(norm([s1.clean[0] - s1.dot[0], s1.clean[1] - s1.dot[1]]) - norm(H)) < 1e-12);
    assert.ok(Math.abs(s0.ball[0] - s0.clean[0] - s0.wobble[0]) < 1e-12);
  });
  test("zero wobble: BOTH readers get 100% — the wobble is what protects the message", () => {
    const r = trial(0);
    assert.equal(r.owner, 1);
    assert.equal(r.eaves, 1);
  });
  test("moderate wobble: owner 100%, eavesdropper near a coin flip", () => {
    const r = trial(0.25);
    assert.equal(r.owner, 1, `owner ${r.owner}`);
    assert.ok(r.eaves > 0.35 && r.eaves < 0.65, `eaves ${r.eaves}`);
  });
  test("owner is perfect up to the safe wobble, then starts failing", () => {
    const safe = safeWobble(H);
    assert.ok(Math.abs(safe - norm(H) / 2) < 1e-12);
    assert.equal(trial(safe * 0.98).owner, 1);
    assert.ok(trial(safe * 1.6).owner < 0.97);
    assert.ok(trial(safe * 3).owner < 0.8);
  });
  test("decode reports the rounded dot, coordinates and leftover", () => {
    const rng = mulberry32(9);
    const s = encode2d(BAD, 1, H, 0.1, rng);
    const o = decode2d(GOOD, s.ball);
    assert.ok(coordinates(GOOD, o.dot).every((c) => Math.abs(c - Math.round(c)) < 1e-9));
    assert.ok(Math.abs(o.leftover) <= 0.5 && Math.abs(o.leftover) > 0.25);
    assert.equal(o.coords.length, 2);
  });
});
