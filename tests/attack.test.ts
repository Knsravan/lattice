import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  plantedInstance, embeddingBasis, runAttack, showcaseBases, ATTACK_PARAMS, lll, isLLLReduced,
  sameLattice, coordinates, mulberry32, norm,
} from "../src/core/index.ts";

const successRate = (dim: number, trials: number): number => {
  let ok = 0;
  for (let t = 0; t < trials; t++) if (runAttack(plantedInstance(dim, mulberry32(dim * 1000 + t))).recovered) ok++;
  return ok / trials;
};

describe("attack", () => {
  test("planted instance: the planted point is in the lattice and the wobble is small", () => {
    for (const dim of [2, 5, 12]) {
      const inst = plantedInstance(dim, mulberry32(dim));
      assert.equal(inst.basis.length, dim);
      for (const x of coordinates(inst.basis, inst.point)) assert.ok(Math.abs(x - Math.round(x)) < 1e-9);
      for (const e of inst.error) assert.ok(Math.abs(e) <= ATTACK_PARAMS.wobble);
      inst.target.forEach((t, i) => assert.equal(t, inst.point[i] + inst.error[i]));
    }
  });
  test("embedding contains the planted short vector (error, 1)", () => {
    const inst = plantedInstance(6, mulberry32(4));
    const E = embeddingBasis(inst.basis, inst.target);
    assert.equal(E.length, 7);
    const c = coordinates(E, [...inst.error, 1]);
    for (const x of c) assert.ok(Math.abs(x - Math.round(x)) < 1e-9);
  });
  test("low dimension: the attack recovers the secret", () => {
    assert.ok(successRate(8, 20) >= 0.8, "n=8");
  });
  test("high dimension: LLL finishes but the attack fails", () => {
    const rate = successRate(40, 20);
    assert.ok(rate <= 0.2, `n=40 success ${rate}`);
    const inst = plantedInstance(40, mulberry32(1));
    const r = lll(inst.basis, 0.99, 1_000_000, { trace: false });
    assert.ok(r.finished && isLLLReduced(r.reduced, 0.99, 1e-6));
  });
  test("secondary metric: LLL's shortest vector vs the planted one", () => {
    const easy = runAttack(plantedInstance(8, mulberry32(3)));
    assert.equal(easy.gaveUp, false);
    assert.ok(easy.shortestFound <= easy.planted + 1e-9);
    let sum = 0;
    for (let t = 0; t < 10; t++) { const r = runAttack(plantedInstance(40, mulberry32(t))); sum += r.shortestFound / r.planted; }
    assert.ok(sum / 10 > 1.02, `mean ratio at n=40 ${sum / 10}`);
  });
  test("time budget: gives up when told to stop", () => {
    const r = runAttack(plantedInstance(30, mulberry32(2)), () => true);
    assert.equal(r.gaveUp, true);
    assert.equal(r.recovered, false);
    assert.ok(Number.isNaN(r.shortestFound));
  });
  test("showcase bases: bad and good build the same lattice; LLL turns bad into short", () => {
    for (const dim of [2, 3, 4] as const) {
      const { good, bad } = showcaseBases(dim);
      assert.ok(sameLattice(good, bad), `dim ${dim}`);
      const sum = (b: number[][]) => b.reduce((s, v) => s + norm(v), 0);
      assert.ok(sum(bad) > 1.5 * sum(good));
      const { reduced, trace } = lll(bad);
      assert.ok(trace.length >= 2);
      assert.ok(sum(reduced) < sum(good) + 1e-6, `dim ${dim} reduced ${sum(reduced)}`);
    }
  });
  test("lll reports unfinished runs", () => {
    const inst = plantedInstance(20, mulberry32(8));
    assert.equal(lll(inst.basis, 0.99, 2, { trace: false }).finished, false);
  });
});
