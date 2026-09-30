/** Shared 2-D canvas drawing for scenes 1–3 and 5. No math here — only pixels.
 *  Every helper multiplies the current globalAlpha, so a caller can fade a whole layer.
 *
 *  The look matches the 3D stage behind the page (user decision, Sept 30): dots are small glass beads with a highlight,
 *  arrows are beams of light with a spark running along them, the ball is a glowing orb, rings and lines glow softly.
 *  Colours and meanings are unchanged. Under reduced motion the sparks hold still. */
import type { Basis, Vec } from "../core/index.ts";
import { pointsInBox } from "../core/index.ts";
import { palette, reducedMotion } from "../ui/dom.ts";

/** Seconds since the page loaded, for the little sparks of light (frozen under reduced motion). */
export const clockSec = (): number => (reducedMotion() ? 0 : performance.now() / 1000);

/** `color` with alpha `a` (accepts #rrggbb). */
export function withAlpha(color: string, a: number): string {
  if (!color.startsWith("#") || color.length !== 7) return color;
  const n = parseInt(color.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A glass bead, drawn once per colour and size and reused (a grid can have thousands of dots). */
const beads = new Map<string, HTMLCanvasElement>();
function bead(color: string, r: number): HTMLCanvasElement {
  const k = `${color}|${r.toFixed(2)}`;
  let c = beads.get(k);
  if (c) return c;
  const S = 3, R = r * 2.6; // drawn at 3× for sharp screens; room for the halo
  c = document.createElement("canvas"); c.width = c.height = Math.ceil(R * 2 * S);
  const g = c.getContext("2d")!; g.scale(S, S);
  const halo = g.createRadialGradient(R, R, r * .6, R, R, R);
  halo.addColorStop(0, withAlpha(color, .35)); halo.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = halo; g.fillRect(0, 0, R * 2, R * 2);
  const body = g.createRadialGradient(R - r * .35, R - r * .4, r * .1, R, R, r);
  body.addColorStop(0, "rgba(255,255,255,.95)"); body.addColorStop(.35, color); body.addColorStop(1, withAlpha(color, .55));
  g.fillStyle = body; g.beginPath(); g.arc(R, R, r, 0, Math.PI * 2); g.fill();
  beads.set(k, c);
  return c;
}

/** A soft glowing line (a beam of light): halo, then the colour, then a bright core. */
export function beam(ctx: CanvasRenderingContext2D, path: (c: CanvasRenderingContext2D) => void, color: string, width: number) {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha(color, .1); ctx.lineWidth = width * 4.5; ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.strokeStyle = withAlpha(color, .22); ctx.lineWidth = width * 2.2; ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = Math.max(.8, width * .35); ctx.beginPath(); path(ctx); ctx.stroke();
  ctx.restore();
}

/** A spark of light at (x, y). */
export function spark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, r = 6) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(.3, withAlpha(color, .7)); g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

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
  ctx.globalAlpha *= opts.alpha ?? 1;
  const img = bead(opts.color ?? palette.dot, r), R = r * 2.6;
  for (const { point } of pts) {
    const [x, y] = vp.toScreen(point);
    ctx.drawImage(img, x - R, y - R, R * 2, R * 2);
  }
  // origin a touch brighter
  const [ox, oy] = vp.toScreen([0, 0]), o = bead(palette.dotBright, r + 1.2), OR = (r + 1.2) * 2.6;
  ctx.drawImage(o, ox - OR, oy - OR, OR * 2, OR * 2);
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
  const base = ctx.globalAlpha;
  // a pane of tinted glass: brighter toward one corner, with a glowing edge
  const glassFill = ctx.createLinearGradient(o[0], o[1], ab[0], ab[1]);
  glassFill.addColorStop(0, withAlpha(color, Math.min(1, fillAlpha * 2.2))); glassFill.addColorStop(1, withAlpha(color, fillAlpha * .6));
  ctx.globalAlpha = base; ctx.fillStyle = color.startsWith("#") ? glassFill : color; if (!color.startsWith("#")) ctx.globalAlpha = base * fillAlpha; ctx.fill();
  ctx.globalAlpha = base * Math.min(1, fillAlpha * 3.5); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.stroke();
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
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * (opts.alpha ?? 1);
  const width = opts.width ?? (opts.active ? 3 : 2.2), len = Math.hypot(tx - ox, ty - oy);
  // the shaft is a beam of light, stopping short of the tip so the head stays crisp
  const hx = tx - 9 * Math.cos(ang), hy = ty - 9 * Math.sin(ang);
  if (len > 10) beam(ctx, (c) => { c.moveTo(ox, oy); c.lineTo(hx, hy); }, color, width);
  // the head: a glowing arrowhead
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 12 * Math.cos(ang - 0.4), ty - 12 * Math.sin(ang - 0.4));
  ctx.lineTo(tx - 12 * Math.cos(ang + 0.4), ty - 12 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // a spark of light runs from the tail to the tip, over and over
  if (len > 24) { const u = (clockSec() * .55 + (ox * .013 + oy * .007)) % 1; spark(ctx, ox + (hx - ox) * u, oy + (hy - oy) * u, color, 4 + width); }
  if (opts.handle) {
    const R = opts.handleR ?? 13, rr = opts.active ? R : R - 3;
    // a glass knob at the tip, to grab
    const g = ctx.createRadialGradient(tx - rr * .35, ty - rr * .4, 1, tx, ty, rr);
    g.addColorStop(0, "rgba(255,255,255,.35)"); g.addColorStop(.5, withAlpha(color, opts.active ? .3 : .16)); g.addColorStop(1, withAlpha(color, opts.active ? .18 : .08));
    ctx.beginPath(); ctx.arc(tx, ty, rr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.shadowColor = color; ctx.shadowBlur = opts.active ? 12 : 6; ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (opts.label) {
    ctx.fillStyle = palette.ink; ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowBlur = 4;
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
  const y = by - lift;
  ctx.save();
  // a glowing orb: a wide halo, then a glassy body lit from the top-left
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(bx, y, size * .5, bx, y, size * 3.4);
  halo.addColorStop(0, withAlpha(color, .5 * (.4 + .6 * drop))); halo.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(bx, y, size * 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const body = ctx.createRadialGradient(bx - size * .35, y - size * .4, size * .1, bx, y, size);
  body.addColorStop(0, "#fff"); body.addColorStop(.4, color); body.addColorStop(1, withAlpha(color, .75));
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(bx, y, size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawDashedLine(ctx: CanvasRenderingContext2D, vp: Viewport, from: Vec, to: Vec, progress: number, color: string) {
  if (progress <= 0) return;
  const [ax, ay] = vp.toScreen(from);
  const [bx, by] = vp.toScreen(to);
  ctx.save();
  // a dotted line of light, its dots drifting toward the far end
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.setLineDash([1, 6]); ctx.lineDashOffset = -clockSec() * 14;
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * progress, ay + (by - ay) * progress); ctx.stroke();
  ctx.restore();
}

export function drawRing(ctx: CanvasRenderingContext2D, vp: Viewport, at: Vec, color: string, opts: { pulse?: number; label?: string; r?: number; filled?: boolean; alpha?: number; labelBelow?: boolean; labelLeft?: boolean } = {}) {
  const [x, y] = vp.toScreen(at);
  const r = opts.r ?? 3.2;
  ctx.save();
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * (opts.alpha ?? 1);
  const rr = r + 4 + (opts.pulse ?? 0) * 2.5;
  // a ring of light: a soft halo, then a crisp line
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = withAlpha(color, .22); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
  if (opts.filled !== false) { const img = bead(color, r + 1), R = (r + 1) * 2.6; ctx.drawImage(img, x - R, y - R, R * 2, R * 2); }
  if (opts.label) {
    ctx.globalAlpha = base; // labels are always legible, even when the ring itself is hidden
    ctx.fillStyle = color; ctx.font = "12px system-ui, sans-serif"; ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowBlur = 4;
    // keep the label on the canvas: flip sides if it would run off either edge
    const tw = ctx.measureText(opts.label).width;
    let left = opts.labelLeft ?? false;
    if (!left && x + 12 + tw > vp.w - 4) left = true;
    else if (left && x - 12 - tw < 4) left = false;
    ctx.textAlign = left ? "right" : "left";
    ctx.fillText(opts.label, left ? x - 12 : x + 12, opts.labelBelow === false ? y - 12 : y + 22);
  }
  ctx.restore();
}

/** Linear interpolation of two bases (for animating a change of basis). */
export function lerpBasis(a: Basis, b: Basis, t: number): Basis {
  return a.map((row, i) => row.map((x, j) => x + (b[i][j] - x) * t));
}
