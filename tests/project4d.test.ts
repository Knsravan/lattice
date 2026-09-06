import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rotationMatrix4, rotate4, applyMatrix4, project4to3, project4to3Ortho, tesseract, ZERO_ANGLES, norm } from "../src/core/index.ts";

describe("project4d", () => {
  test("zero angles give the identity", () => {
    const v = [1, 2, 3, 4];
    assert.deepEqual(rotate4(v, ZERO_ANGLES), v);
  });
  test("rotations preserve length", () => {
    const v = [1, -2, 0.5, 3];
    const r = rotate4(v, { xy: 0.3, xz: 1.1, xw: -0.7, yz: 2.0, yw: 0.4, zw: -1.3 });
    assert.ok(Math.abs(norm(r) - norm(v)) < 1e-9);
  });
  test("xy rotation by 90° maps x to y", () => {
    const r = rotate4([1, 0, 0, 0], { ...ZERO_ANGLES, xy: Math.PI / 2 });
    assert.ok(Math.abs(r[0]) < 1e-12 && Math.abs(r[1] - 1) < 1e-12);
  });
  test("zw rotation leaves x and y alone", () => {
    const r = rotate4([1, 2, 3, 4], { ...ZERO_ANGLES, zw: 0.9 });
    assert.equal(r[0], 1);
    assert.equal(r[1], 2);
  });
  test("matrix is orthogonal (M Mᵀ = I)", () => {
    const M = rotationMatrix4({ xy: 0.2, xz: 0.4, xw: 0.6, yz: 0.8, yw: 1.0, zw: 1.2 });
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += M[i][k] * M[j][k];
        assert.ok(Math.abs(s - (i === j ? 1 : 0)) < 1e-9);
      }
    assert.deepEqual(applyMatrix4(rotationMatrix4(ZERO_ANGLES), [5, 6, 7, 8]), [5, 6, 7, 8]);
  });
  test("perspective: points with larger w look bigger; w=0 is unscaled", () => {
    const near = project4to3([1, 1, 1, 1], 4);
    const far = project4to3([1, 1, 1, -1], 4);
    const mid = project4to3([1, 1, 1, 0], 4);
    assert.ok(near.scale > mid.scale && mid.scale > far.scale);
    assert.deepEqual(mid.p, [1, 1, 1]);
    assert.ok(project4to3([0, 0, 0, 4], 4).scale > 1e5); // at the camera
    assert.deepEqual(project4to3Ortho([1, 2, 3, 4]), [1, 2, 3]);
  });
  test("tesseract has 16 vertices and 32 edges of length 1", () => {
    const { vertices, edges } = tesseract();
    assert.equal(vertices.length, 16);
    assert.equal(edges.length, 32);
    for (const [a, b] of edges) {
      const d = norm(vertices[a].map((x, i) => x - vertices[b][i]));
      assert.ok(Math.abs(d - 1) < 1e-12);
    }
  });
});
