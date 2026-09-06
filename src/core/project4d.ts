import type { Vec } from "./types.ts";

/** The six rotation planes of 4D space. Angles in radians. */
export interface Angles4 {
  xy: number;
  xz: number;
  xw: number;
  yz: number;
  yw: number;
  zw: number;
}

export const ZERO_ANGLES: Angles4 = { xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 };

type M4 = number[][];

const identity4 = (): M4 => [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

function planeRotation(a: number, b: number, theta: number): M4 {
  const m = identity4();
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  m[a][a] = c;
  m[a][b] = -s;
  m[b][a] = s;
  m[b][b] = c;
  return m;
}

function mul4(A: M4, B: M4): M4 {
  const out = identity4();
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j];
      out[i][j] = s;
    }
  return out;
}

/** Full 4D rotation matrix from six plane angles (applied xy, xz, xw, yz, yw, zw in that order). */
export function rotationMatrix4(angles: Angles4): M4 {
  let m = identity4();
  const planes: [number, number, number][] = [
    [0, 1, angles.xy],
    [0, 2, angles.xz],
    [0, 3, angles.xw],
    [1, 2, angles.yz],
    [1, 3, angles.yw],
    [2, 3, angles.zw],
  ];
  for (const [a, b, t] of planes) if (t !== 0) m = mul4(planeRotation(a, b, t), m);
  return m;
}

export function applyMatrix4(m: M4, v: Vec): Vec {
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += m[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

export function rotate4(v: Vec, angles: Angles4): Vec {
  return applyMatrix4(rotationMatrix4(angles), v);
}

/**
 * Perspective projection from 4D to 3D: a "camera" sits at w = distance looking down the w axis.
 * Points with larger w appear bigger/closer; the scale factor is also returned for fading.
 */
export function project4to3(v: Vec, distance = 4): { p: Vec; scale: number } {
  const w = v[3];
  const denom = distance - w;
  const scale = denom <= 1e-6 ? 1e6 : distance / denom;
  return { p: [v[0] * scale, v[1] * scale, v[2] * scale], scale };
}

/** Orthographic projection: just drop w. */
export function project4to3Ortho(v: Vec): Vec {
  return [v[0], v[1], v[2]];
}

/** The 16 vertices and 32 edges of a tesseract (unit hypercube centered at origin). */
export function tesseract(): { vertices: Vec[]; edges: [number, number][] } {
  const vertices: Vec[] = [];
  for (let i = 0; i < 16; i++) vertices.push([i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5, i & 8 ? 0.5 : -0.5]);
  const edges: [number, number][] = [];
  for (let i = 0; i < 16; i++)
    for (let bit = 0; bit < 4; bit++) {
      const j = i ^ (1 << bit);
      if (i < j) edges.push([i, j]);
    }
  return { vertices, edges };
}
