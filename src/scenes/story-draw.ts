/** Small picture painters for the scroll-story chapters (people, envelope, padlock, key…). Pixels only.
 *  Drawn in the same glass-and-light look as the 3D stage: glass panels, glowing objects, wires that carry light. */
import { palette, reducedMotion, clamp } from "../ui/dom.ts";
import type { Vec } from "../core/index.ts";
import { drawArrow, withAlpha, clockSec, spark } from "./draw2d.ts";

/** A pane of dark glass: a faint gradient body, a bright top edge, a coloured rim. */
function glassPane(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, rim: string, rimAlpha = 1) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(40,48,66,.92)"); g.addColorStop(1, "rgba(14,18,28,.92)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.save(); ctx.globalAlpha *= rimAlpha; ctx.strokeStyle = rim; ctx.shadowColor = rim; ctx.shadowBlur = 8; ctx.stroke(); ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + r, y + .5); ctx.lineTo(x + w - r, y + .5); ctx.stroke();
}
import type { Viewport } from "./draw2d.ts";

type Ctx = CanvasRenderingContext2D;

/**
 * Progress of a timed piece of animation: 0 before `start`, 1 after `start + dur`, eased in between.
 * Under reduced motion it jumps straight to 1 once `start` has passed.
 */
export function prog(t: number, start: number, dur: number): number {
  if (t < start) return 0;
  if (reducedMotion() || dur <= 0) return 1;
  const x = clamp((t - start) / dur, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; // ease in-out
}

/** A looping clock: t wrapped into [0, period). Under reduced motion it holds at `hold` (the "finished" frame). */
export function loop(t: number, period: number, hold = period): number {
  return reducedMotion() ? hold : t % period;
}

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** A point along a polyline at fraction u ∈ [0, 1] (by segment, so each hop takes equal time). */
export function along(path: [number, number][], u: number): [number, number] {
  const segs = path.length - 1;
  const x = clamp(u, 0, 1) * segs;
  const i = Math.min(segs - 1, Math.floor(x));
  const k = x - i;
  // ease each hop so the envelope pauses a moment at every computer
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return [lerp(path[i][0], path[i + 1][0], e), lerp(path[i][1], path[i + 1][1], e)];
}

export function label(ctx: Ctx, text: string, x: number, y: number, opts: { color?: string; size?: number; weight?: number; align?: CanvasTextAlign; alpha?: number } = {}) {
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? palette.ink; ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowBlur = 4;
  ctx.font = `${opts.weight ?? 500} ${opts.size ?? 14}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A person: round head, shoulders, name underneath. */
export function person(ctx: Ctx, x: number, y: number, s: number, name: string, color: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // lit from above, with a soft glow of their colour around them
  const g = ctx.createLinearGradient(x, y - 28 * s, x, y + 14 * s);
  g.addColorStop(0, "#fff"); g.addColorStop(.25, color); g.addColorStop(1, withAlpha(color, .7));
  ctx.fillStyle = g; ctx.shadowColor = color; ctx.shadowBlur = 16 * s;
  ctx.beginPath(); ctx.arc(x, y - 16 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + 12 * s, 19 * s, 15 * s, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
  label(ctx, name, x, y + 26 * s, { color, size: 14 * s, weight: 700, alpha });
}

/** A speech bubble with text, pointing down at (x, y). */
export function bubble(ctx: Ctx, x: number, y: number, s: number, text: string, color: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `600 ${13 * s}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const w = ctx.measureText(text).width + 18 * s, h = 26 * s;
  const bx = x - w / 2, by = y - h - 8 * s;
  ctx.lineWidth = 1.5; glassPane(ctx, bx, by, w, h, 7 * s, color);
  ctx.beginPath(); ctx.moveTo(x - 6 * s, by + h); ctx.lineTo(x, y); ctx.lineTo(x + 6 * s, by + h); ctx.fillStyle = "rgba(14,18,28,.92)"; ctx.fill();
  ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x - 6 * s, by + h); ctx.lineTo(x, y); ctx.lineTo(x + 6 * s, by + h); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x, by + h / 2 + 0.5);
  ctx.restore();
}

/** A computer on the network: a small screen on a stand. */
export function node(ctx: Ctx, x: number, y: number, s: number, alpha = 1, color: string = palette.dot) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // a glass screen with a faint glow on it, on a steel stand
  ctx.lineWidth = 2; glassPane(ctx, x - 13 * s, y - 11 * s, 26 * s, 18 * s, 3 * s, color, .9);
  const glow = ctx.createRadialGradient(x, y - 2 * s, 0, x, y - 2 * s, 11 * s); glow.addColorStop(0, withAlpha(palette.dotBright, .28)); glow.addColorStop(1, "rgba(159,176,214,0)");
  ctx.fillStyle = glow; ctx.fillRect(x - 12 * s, y - 10 * s, 24 * s, 16 * s);
  ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x, y + 7 * s); ctx.lineTo(x, y + 12 * s); ctx.moveTo(x - 7 * s, y + 12 * s); ctx.lineTo(x + 7 * s, y + 12 * s); ctx.stroke();
  ctx.restore();
}

/** An envelope (the message). `locked` puts a padlock on it. */
export function envelope(ctx: Ctx, x: number, y: number, s: number, opts: { locked?: boolean; alpha?: number; color?: string } = {}) {
  const a = opts.alpha ?? 1;
  if (a <= 0) return;
  const c = opts.color ?? palette.ball;
  ctx.save();
  ctx.globalAlpha *= a;
  // lit paper, glowing faintly in its colour
  const g = ctx.createLinearGradient(x, y - 10 * s, x, y + 10 * s);
  g.addColorStop(0, "#fff"); g.addColorStop(.3, c); g.addColorStop(1, withAlpha(c, .8));
  ctx.fillStyle = c.startsWith("#") ? g : c; ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 1.5 * s; ctx.shadowColor = c; ctx.shadowBlur = 14 * s;
  ctx.beginPath(); ctx.roundRect(x - 15 * s, y - 10 * s, 30 * s, 20 * s, 3 * s); ctx.fill(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y - 9 * s); ctx.lineTo(x, y + 2 * s); ctx.lineTo(x + 14 * s, y - 9 * s); ctx.stroke();
  ctx.restore();
  if (opts.locked) padlock(ctx, x + 12 * s, y + 8 * s, 0.7 * s, { open: 0, color: palette.ink, alpha: a });
}

/** A padlock. open ∈ [0, 1]: 0 = shackle shut, 1 = shackle lifted. */
export function padlock(ctx: Ctx, x: number, y: number, s: number, opts: { open?: number; color?: string; alpha?: number; broken?: boolean } = {}) {
  const a = opts.alpha ?? 1;
  if (a <= 0) return;
  const c = opts.color ?? palette.secret;
  const lift = (opts.open ?? 0) * 8 * s;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = c; ctx.lineWidth = 3.2 * s; ctx.lineCap = "round"; ctx.shadowColor = c; ctx.shadowBlur = 12 * s;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y - 4 * s - lift);
  ctx.arc(x, y - 11 * s - lift, 7 * s, Math.PI, 0);
  ctx.lineTo(x + 7 * s, y - 4 * s - (opts.open ? lift + 4 * s : lift));
  ctx.stroke();
  const body = ctx.createLinearGradient(x, y - 5 * s, x, y + 12 * s);
  body.addColorStop(0, "#fff"); body.addColorStop(.3, c); body.addColorStop(1, withAlpha(c, .75));
  ctx.fillStyle = c.startsWith("#") ? body : c;
  ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 5 * s, 22 * s, 17 * s, 3 * s); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#0b0d12";
  ctx.beginPath(); ctx.arc(x, y + 2 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
  if (opts.broken) {
    ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 4 * s); ctx.lineTo(x - 1 * s, y + 3 * s); ctx.lineTo(x - 5 * s, y + 7 * s); ctx.lineTo(x + 1 * s, y + 12 * s); ctx.stroke();
  }
  ctx.restore();
}

/** A key. */
export function key(ctx: Ctx, x: number, y: number, s: number, color: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.lineWidth = 3 * s; ctx.lineCap = "round"; ctx.shadowColor = color; ctx.shadowBlur = 12 * s;
  ctx.beginPath(); ctx.arc(x - 9 * s, y, 5.5 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3.5 * s, y); ctx.lineTo(x + 12 * s, y); ctx.moveTo(x + 7 * s, y); ctx.lineTo(x + 7 * s, y + 5 * s); ctx.moveTo(x + 11 * s, y); ctx.lineTo(x + 11 * s, y + 4 * s); ctx.stroke();
  ctx.restore();
}

/** A browser address bar with the padlock, like the one the reader has open right now. */
export function browserBar(ctx: Ctx, x: number, y: number, w: number, s: number, url: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = 1.2; glassPane(ctx, x - w / 2, y - 17 * s, w, 34 * s, 17 * s, palette.dot);
  ctx.restore();
  padlock(ctx, x - w / 2 + 24 * s, y + 1 * s, 0.62 * s, { color: palette.secret, alpha });
  label(ctx, url, x - w / 2 + 42 * s, y, { size: 14 * s, align: "left", color: palette.ink, alpha });
}

/** A quantum computer chip: a glowing square with pins. */
export function chip(ctx: Ctx, x: number, y: number, s: number, glow: number, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = "#b48cff"; ctx.shadowBlur = 24 * glow;
  ctx.fillStyle = "#2a2142"; ctx.strokeStyle = "#b48cff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - 22 * s, y - 22 * s, 44 * s, 44 * s, 6 * s); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(x + i * 11 * s, y - 22 * s); ctx.lineTo(x + i * 11 * s, y - 30 * s);
    ctx.moveTo(x + i * 11 * s, y + 22 * s); ctx.lineTo(x + i * 11 * s, y + 30 * s);
    ctx.moveTo(x - 22 * s, y + i * 11 * s); ctx.lineTo(x - 30 * s, y + i * 11 * s);
    ctx.moveTo(x + 22 * s, y + i * 11 * s); ctx.lineTo(x + 30 * s, y + i * 11 * s);
  }
  ctx.stroke();
  ctx.fillStyle = "#b48cff";
  ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A wire between two points: a thin fibre with light flowing along it from a to b. */
export function wire(ctx: Ctx, a: [number, number], b: [number, number], alpha = 1, color: string = palette.dot) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.strokeStyle = withAlpha(color, .45); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.strokeStyle = palette.dotBright; ctx.lineWidth = 1.6; ctx.shadowColor = palette.dotBright; ctx.shadowBlur = 6;
  ctx.setLineDash([2, 10]); ctx.lineDashOffset = -clockSec() * 22;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.restore();
}

/**
 * A walker hopping along a path of lattice points (one hop per `per` seconds, starting at `t0`), leaving arrows.
 * Returns how many hops are complete and where the walker is. `onHop(k, from)` fires as each hop starts.
 */
export function drawWalker(
  ctx: Ctx, vp: Viewport, path: Vec[], tt: number, t0: number, per: number, color: string,
  opts: { alpha?: number; showWalker?: boolean; onHop?: (k: number, from: Vec) => void } = {},
): { done: number; at: Vec } {
  const a = opts.alpha ?? 1;
  let at: Vec = path[0];
  let done = 0;
  let lift = 0;
  ctx.save();
  ctx.globalAlpha *= a;
  for (let k = 0; k < path.length - 1; k++) {
    opts.onHop?.(k, path[k]);
    const g = prog(tt, t0 + k * per, per * 0.8);
    if (g <= 0) break;
    const from = path[k], to = path[k + 1];
    const cur: Vec = [lerp(from[0], to[0], g), lerp(from[1], to[1], g)];
    drawArrow(ctx, vp, from, cur, color, { width: 2.6, alpha: 0.9 });
    at = cur;
    lift = Math.sin(Math.PI * g) * 10;
    if (g >= 1) done++;
  }
  if (opts.showWalker !== false && tt > t0 - 0.3) {
    const [x, y] = vp.toScreen(at);
    spark(ctx, x, y - lift, palette.ink, 16); // the walker: a small orb of white light
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y - lift, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return { done, at };
}

/** A red ✗ at a screen point. */
export function cross(ctx: Ctx, x: number, y: number, size: number, color: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
  ctx.restore();
}

/** A rounded label chip (text on a dark pill) — readable over dots. */
export function chip2(ctx: Ctx, text: string, x: number, y: number, s: number, color: string, alpha = 1, align: CanvasTextAlign = "center") {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `700 ${13 * s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const tw = ctx.measureText(text).width, pw = tw + 16 * s, ph = 24 * s;
  const x0 = align === "left" ? x : align === "right" ? x - pw : x - pw / 2;
  ctx.lineWidth = 1.2; glassPane(ctx, x0, y - ph / 2, pw, ph, ph / 2, color);
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x0 + pw / 2, y + 0.5);
  ctx.restore();
}
