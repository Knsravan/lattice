/** Shared 2-D canvas drawing for scenes 1–3. No math here — only pixels. */
import type { Basis, Vec } from "../core/index.ts";
import { pointsInBox } from "../core/index.ts";
import { palette } from "../ui/dom.ts";

export interface Viewport {
  w: number;
  h: number;
  unit: number; // px per world unit
  toScreen(p: Vec): [number, number];
  toWorld(x: number, y: number): Vec;
}

export function makeViewport(w: number, h: number, unitsAcrossMin: number): Viewport {
  const unit = Math.min(w, h) / unitsAcrossMin;
  return {
    w, h, unit,
    toScreen: (p) => [w / 2 + p[0] * unit, h / 2 - p[1] * unit],
    toWorld: (x, y) => [(x - w / 2) / unit, (h / 2 - y) / unit],
  };
}

export interface DotInfo { point: Vec; coeffs: number[] }

/** Lattice points that fit the viewport (with a little margin). */
export function visiblePoints(basis: Basis, vp: Viewport, maxPoints = 3000): DotInfo[] {
  return pointsInBox(basis, [vp.w / 2 / vp.unit + 0.5, vp.h / 2 / vp.unit + 0.5], maxPoints);
}

export function drawDots(ctx: CanvasRenderingContext2D, vp: Viewport, pts: DotInfo[], opts: { color?: string; radius?: number; alpha?: number } = {}) {
  const r = opts.radius ?? (pts.length > 700 ? 2 : 3.2);
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? palette.dot;
  for (const { point } of pts) {
    const [x, y] = vp.toScreen(point);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // origin a touch brighter
  const [ox, oy] = vp.toScreen([0, 0]);
  ctx.fillStyle = palette.dotBright;
  ctx.beginPath(); ctx.arc(ox, oy, r + 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return r;
}

export function drawCoords(ctx: CanvasRenderingContext2D, vp: Viewport, pts: DotInfo[]) {
  if (pts.length > 700) return;
  ctx.save();
  ctx.fillStyle = palette.muted;
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "left";
  for (const { point, coeffs } of pts) {
    const [x, y] = vp.toScreen(point);
    ctx.fillText(`${coeffs[0]},${coeffs[1]}`, x + 5, y - 5);
  }
  ctx.restore();
}

/** The parallelogram spanned by the basis, anchored at `origin` (world units). */
export function drawCell(ctx: CanvasRenderingContext2D, vp: Viewport, basis: Basis, color: string, origin: Vec = [0, 0], fillAlpha = 0.07) {
  const o = vp.toScreen(origin);
  const a = vp.toScreen([origin[0] + basis[0][0], origin[1] + basis[0][1]]);
  const b = vp.toScreen([origin[0] + basis[1][0], origin[1] + basis[1][1]]);
  const ab = vp.toScreen([origin[0] + basis[0][0] + basis[1][0], origin[1] + basis[0][1] + basis[1][1]]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(o[0], o[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(ab[0], ab[1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
  ctx.globalAlpha = fillAlpha; ctx.fillStyle = color; ctx.fill();
  ctx.globalAlpha = Math.min(1, fillAlpha * 3.5); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D, vp: Viewport, from: Vec, to: Vec, color: string,
  opts: { label?: string; active?: boolean; handle?: boolean; handleR?: number; width?: number; alpha?: number } = {},
) {
  const [ox, oy] = vp.toScreen(from);
  const [tx, ty] = vp.toScreen(to);
  const ang = Math.atan2(ty - oy, tx - ox);
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = opts.width ?? (opts.active ? 3 : 2.2);
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 12 * Math.cos(ang - 0.4), ty - 12 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 12 * Math.cos(ang + 0.4), ty - 12 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
  if (opts.handle) {
    const R = opts.handleR ?? 13;
    ctx.beginPath(); ctx.arc(tx, ty, opts.active ? R : R - 3, 0, Math.PI * 2);
    ctx.globalAlpha = (opts.alpha ?? 1) * (opts.active ? 0.28 : 0.14); ctx.fill();
    ctx.globalAlpha = opts.alpha ?? 1; ctx.lineWidth = 1.2; ctx.stroke();
  }
  if (opts.label) {
    ctx.fillStyle = palette.ink;
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, tx + 16 * Math.cos(ang), ty + 16 * Math.sin(ang) + 5);
  }
  ctx.restore();
}

export function drawBall(ctx: CanvasRenderingContext2D, vp: Viewport, pos: Vec, drop: number, color = palette.ball) {
  const [bx, by] = vp.toScreen(pos);
  const size = 6 * (0.4 + 0.6 * drop);
  const lift = (1 - drop) * 18;
  ctx.save();
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12 * drop;
  ctx.beginPath(); ctx.arc(bx, by - lift, size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawDashedLine(ctx: CanvasRenderingContext2D, vp: Viewport, from: Vec, to: Vec, progress: number, color: string) {
  if (progress <= 0) return;
  const [ax, ay] = vp.toScreen(from);
  const [bx, by] = vp.toScreen(to);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * progress, ay + (by - ay) * progress); ctx.stroke();
  ctx.restore();
}

export function drawRing(ctx: CanvasRenderingContext2D, vp: Viewport, at: Vec, color: string, opts: { pulse?: number; label?: string; r?: number; filled?: boolean; alpha?: number; labelBelow?: boolean; labelLeft?: boolean } = {}) {
  const [x, y] = vp.toScreen(at);
  const r = opts.r ?? 3.2;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r + 4 + (opts.pulse ?? 0) * 2.5, 0, Math.PI * 2); ctx.stroke();
  if (opts.filled !== false) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill(); }
  if (opts.label) {
    ctx.globalAlpha = 1; // labels are always legible, even when the ring itself is hidden
    ctx.fillStyle = color; ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = opts.labelLeft ? "right" : "left";
    ctx.fillText(opts.label, opts.labelLeft ? x - 12 : x + 12, opts.labelBelow === false ? y - 12 : y + 22);
  }
  ctx.restore();
}

/** Linear interpolation of two bases (for animating a change of basis). */
export function lerpBasis(a: Basis, b: Basis, t: number): Basis {
  return a.map((row, i) => row.map((x, j) => x + (b[i][j] - x) * t));
}
