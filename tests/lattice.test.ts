import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  gramSchmidt, latticePoint, volume, sameLattice, pointsInBall, pointsInBox, skewBasis,
  identityBasis, orthogonalityDefect, mulberry32, dot, determinant, inverse, coordinates, norm, combine,
} from "../src/core/index.ts";

describe("vec", () => {
  test("determinant and inverse agree", () => {
    const m = [[2, 1], [1, 3]];
    assert.equal(determinant(m), 5);
    const inv = inverse(m);
    // m * inv = I
    const prod = m.map((row) => inv[0].map((_, j) => row.reduce((s, x, k) => s + x * inv[k][j], 0)));
    assert.ok(Math.abs(prod[0][0] - 1) < 1e-12 && Math.abs(prod[0][1]) < 1e-12);
    assert.ok(Math.abs(prod[1][1] - 1) < 1e-12 && Math.abs(prod[1][0]) < 1e-12);
  });
  test("inverse throws on singular", () => {
    assert.throws(() => inverse([[1, 2], [2, 4]]));
    assert.equal(determinant([[1, 2], [2, 4]]), 0);
  });
  test("coordinates recover integer coefficients", () => {
    const b = [[3, 1, 0], [1, 4, 1], [0, 2, 5]];
    const p = combine(b, [2, -3, 5]);
    const c = coordinates(b, p);
    assert.deepEqual(c.map(Math.round), [2, -3, 5]);
    assert.ok(c.every((x) => Math.abs(x - Math.round(x)) < 1e-9));
  });
});

describe("gramSchmidt", () => {
  test("b* vectors are pairwise orthogonal and mu is below diagonal", () => {
    const rng = mulberry32(7);
    const b = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Math.floor(rng() * 20 - 10)));
    const { bstar, mu, B } = gramSchmidt(b);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < i; j++) assert.ok(Math.abs(dot(bstar[i], bstar[j])) < 1e-8);
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(B[i] - dot(bstar[i], bstar[i])) < 1e-9);
      for (let j = i; j < 4; j++) assert.equal(mu[i][j], 0);
    }
  });
  test("orthogonal input is unchanged", () => {
    const { bstar } = gramSchmidt([[2, 0], [0, 3]]);
    assert.deepEqual(bstar, [[2, 0], [0, 3]]);
  });
});

describe("lattice", () => {
  test("latticePoint is the integer combination", () => {
    assert.deepEqual(latticePoint([[1, 2], [3, 4]], [2, -1]), [-1, 0]);
  });
  test("volume is invariant under skewing", () => {
    const good = [[3, 0, 0], [0, 2, 0], [0, 0, 5]];
    const bad = skewBasis(good, mulberry32(1), 12);
    assert.ok(Math.abs(volume(good) - 30) < 1e-9);
    assert.ok(Math.abs(volume(bad) - 30) < 1e-6);
    assert.ok(sameLattice(good, bad));
    assert.ok(norm(bad[0]) + norm(bad[1]) + norm(bad[2]) > norm(good[0]) + norm(good[1]) + norm(good[2]));
  });
  test("sameLattice rejects a different lattice and a singular one", () => {
    assert.equal(sameLattice([[1, 0], [0, 1]], [[2, 0], [0, 1]]), false);
    assert.equal(sameLattice([[1, 2], [2, 4]], [[1, 0], [0, 1]]), false);
    assert.equal(sameLattice([[1, 0]], [[1, 0], [0, 1]]), false);
  });
  test("pointsInBall of Z^2 radius 1 has 5 points", () => {
    const pts = pointsInBall(identityBasis(2), 1);
    assert.equal(pts.length, 5);
    assert.ok(pts.some((p) => p.coeffs[0] === 0 && p.coeffs[1] === 0));
  });
  test("pointsInBall respects the cap", () => {
    assert.equal(pointsInBall(identityBasis(2), 10, 7).length, 7);
  });
  test("pointsInBox returns only points inside the box", () => {
    const pts = pointsInBox([[1, 1], [0, 1]], [2, 2]);
    assert.ok(pts.length > 0);
    for (const { point } of pts) assert.ok(Math.abs(point[0]) <= 2 && Math.abs(point[1]) <= 2);
    assert.equal(pts.length, 25); // Z^2 in a 5x5 box
  });
  test("orthogonalityDefect is 1 for orthogonal, smaller for skewed", () => {
    const good = [[1, 0], [0, 1]];
    const bad = [[1, 0], [5, 1]];
    assert.ok(Math.abs(orthogonalityDefect(good) - 1) < 1e-12);
    assert.ok(orthogonalityDefect(bad) < 0.5);
    assert.equal(orthogonalityDefect([[0, 0], [0, 0]]), 0);
  });
  test("skewBasis on 1-D is a no-op", () => {
    assert.deepEqual(skewBasis([[3]], mulberry32(1)), [[3]]);
  });
});
