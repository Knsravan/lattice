import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  lll, isLLLReduced, babaiNearestPlane, babaiRounding, closestVectorExact, skewBasis, sameLattice,
  volume, mulberry32, norm, sub, combine, identityBasis, pointsInBall,
} from "../src/core/index.ts";
import type { Basis, Vec } from "../src/core/index.ts";

const randomBasis = (n: number, seed: number, range = 10): Basis => {
  const rng = mulberry32(seed);
  for (;;) {
    const b = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rng() * (2 * range + 1)) - range));
    if (volume(b) > 0.5) return b;
  }
};

/** Brute-force CVP by enumerating a big coefficient box (test oracle). */
function bruteCvp(basis: Basis, target: Vec, range = 12): Vec {
  let best: Vec = combine(basis, basis.map(() => 0));
  let bestD = Infinity;
  const c = basis.map(() => 0);
  const centre = babaiNearestPlane(basis, target).coeffs; // search a box around a reasonable guess
  const rec = (d: number) => {
    if (d === basis.length) {
      const p = combine(basis, c);
      const dist = norm(sub(target, p));
      if (dist < bestD) { bestD = dist; best = p; }
      return;
    }
    for (let k = centre[d] - range; k <= centre[d] + range; k++) { c[d] = k; rec(d + 1); }
  };
  rec(0);
  return best;
}

describe("lll", () => {
  test("textbook example reduces to the known short basis", () => {
    // Classic example from many lattice courses.
    const { reduced } = lll([[1, 1, 1], [-1, 0, 2], [3, 5, 6]]);
    assert.ok(isLLLReduced(reduced));
    const lengths = reduced.map(norm).sort((a, b) => a - b);
    assert.ok(lengths[0] <= Math.sqrt(2) + 1e-9, `shortest vector should be length <= sqrt2, got ${lengths[0]}`);
    assert.ok(Math.abs(volume(reduced) - volume([[1, 1, 1], [-1, 0, 2], [3, 5, 6]])) < 1e-9);
  });
  test("reduced basis generates the same lattice, same volume, and is LLL-reduced (many dims)", () => {
    for (let n = 2; n <= 8; n++) {
      for (let seed = 1; seed <= 5; seed++) {
        const b = randomBasis(n, seed * 100 + n);
        const { reduced, trace } = lll(b);
        assert.ok(sameLattice(b, reduced), `same lattice n=${n} seed=${seed}`);
        assert.ok(Math.abs(volume(reduced) - volume(b)) < 1e-6 * Math.max(1, volume(b)));
        assert.ok(isLLLReduced(reduced), `reduced n=${n} seed=${seed}`);
        // every trace snapshot is also the same lattice
        for (const step of trace) assert.ok(sameLattice(b, step.basis));
      }
    }
  });
  test("undoes skewing: reduced vectors are much shorter than the skewed ones", () => {
    const good = identityBasis(4).map((v, i) => v.map((x) => x * (i + 2)));
    const bad = skewBasis(good, mulberry32(3), 60);
    const { reduced } = lll(bad);
    const sum = (b: Basis) => b.reduce((s, v) => s + norm(v), 0);
    assert.ok(sum(reduced) < sum(bad) / 3);
    assert.ok(Math.abs(sum(reduced) - sum(good)) < 1e-9);
  });
  test("already-reduced input produces an empty trace", () => {
    const { trace, reduced } = lll([[1, 0], [0, 1]]);
    assert.equal(trace.length, 0);
    assert.deepEqual(reduced, [[1, 0], [0, 1]]);
  });
  test("trace steps are well-formed", () => {
    const { trace } = lll([[1, 0], [7, 1]]);
    assert.ok(trace.length >= 1);
    for (const s of trace) {
      if (s.type === "reduce") assert.ok(s.q !== 0 && s.j < s.i);
      else assert.ok(s.i >= 0);
    }
  });
  test("empty basis and maxSteps bail-out", () => {
    assert.deepEqual(lll([]).reduced, []);
    const bad = skewBasis(identityBasis(6), mulberry32(9), 200, 50);
    const r = lll(bad, 0.99, 3);
    assert.ok(r.iterations <= 4);
  });
  test("isLLLReduced rejects a skewed basis", () => {
    assert.equal(isLLLReduced([[1, 0], [7, 1]]), false);
  });
});

describe("cvp", () => {
  test("Babai with a reduced basis finds the exact closest point (200 random 2D/3D cases)", () => {
    const rng = mulberry32(42);
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const n = i % 2 === 0 ? 2 : 3;
      const good = lll(randomBasis(n, 1000 + i, 6)).reduced;
      const target = Array.from({ length: n }, () => rng() * 20 - 10);
      const b = babaiNearestPlane(good, target);
      const truth = bruteCvp(good, target, 6);
      const dTruth = norm(sub(target, truth));
      // LLL-reduced Babai is within a small factor; in 2D/3D with delta=.99 it is exact almost always.
      assert.ok(b.distance <= dTruth * 1.5 + 1e-9, `case ${i}: babai ${b.distance} vs truth ${dTruth}`);
      if (Math.abs(b.distance - dTruth) < 1e-9) checked++;
    }
    assert.ok(checked >= 190, `exact in ${checked}/200`);
  });
  test("Babai with a skewed basis is wrong a visible fraction of the time", () => {
    const rng = mulberry32(5);
    const good = [[1, 0], [0, 1]];
    const bad = skewBasis(good, mulberry32(11), 30, 4);
    let wrong = 0;
    for (let i = 0; i < 200; i++) {
      const target = [rng() * 40 - 20, rng() * 40 - 20];
      const exact = bruteCvp(good, target, 3);
      const guess = babaiNearestPlane(bad, target);
      if (norm(sub(guess.point, exact)) > 1e-9) wrong++;
    }
    assert.ok(wrong > 20, `expected many wrong answers with a bad basis, got ${wrong}`);
  });
  test("babaiRounding equals nearest-plane on an orthogonal basis", () => {
    const b = [[2, 0], [0, 3]];
    const t = [3.2, -4.4];
    assert.deepEqual(babaiRounding(b, t).point, babaiNearestPlane(b, t).point);
    assert.deepEqual(babaiRounding(b, t).point, [4, -3]);
  });
  test("closestVectorExact matches brute force on skewed 2D/3D bases and reports original coeffs", () => {
    const rng = mulberry32(77);
    for (let i = 0; i < 60; i++) {
      const n = i % 2 === 0 ? 2 : 3;
      const bad = skewBasis(randomBasis(n, 500 + i, 4), mulberry32(i), 15, 3);
      const target = Array.from({ length: n }, () => rng() * 30 - 15);
      const res = closestVectorExact(bad, target);
      const truth = bruteCvp(lll(bad).reduced, target, 6);
      assert.ok(Math.abs(res.distance - norm(sub(target, truth))) < 1e-7, `case ${i}`);
      assert.deepEqual(combine(bad, res.coeffs), res.point);
    }
  });
  test("closest lattice point to a lattice point is itself", () => {
    const b = [[3, 1], [1, 4]];
    for (const { point, coeffs } of pointsInBall(b, 15)) {
      const r = closestVectorExact(b, point);
      assert.ok(r.distance < 1e-9);
      assert.deepEqual(r.coeffs, coeffs);
    }
  });
});
