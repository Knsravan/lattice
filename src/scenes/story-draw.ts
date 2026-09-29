/** Small picture painters for the scroll-story chapters (people, envelope, padlock, key…). Pixels only. */
import { palette, reducedMotion, clamp } from "../ui/dom.ts";

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
  ctx.fillStyle = opts.color ?? palette.ink;
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
  ctx.fillStyle = color;
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
  ctx.fillStyle = "#161a24"; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, 7 * s); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6 * s, by + h); ctx.lineTo(x, y); ctx.lineTo(x + 6 * s, by + h); ctx.fillStyle = "#161a24"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6 * s, by + h); ctx.lineTo(x, y); ctx.lineTo(x + 6 * s, by + h); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x, by + h / 2 + 0.5);
  ctx.restore();
}

/** A computer on the network: a small screen on a stand. */
export function node(ctx: Ctx, x: number, y: number, s: number, alpha = 1, color: string = palette.dot) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.fillStyle = "#141824"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - 13 * s, y - 11 * s, 26 * s, 18 * s, 3 * s); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + 7 * s); ctx.lineTo(x, y + 12 * s); ctx.moveTo(x - 7 * s, y + 12 * s); ctx.lineTo(x + 7 * s, y + 12 * s); ctx.stroke();
  ctx.restore();
}

/** An envelope (the message). `locked` puts a padlock on it. */
export function envelope(ctx: Ctx, x: number, y: number, s: number, opts: { locked?: boolean; alpha?: number; color?: string } = {}) {
  const a = opts.alpha ?? 1;
  if (a <= 0) return;
  const c = opts.color ?? palette.ball;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = c; ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 1.5 * s;
  ctx.beginPath(); ctx.roundRect(x - 15 * s, y - 10 * s, 30 * s, 20 * s, 3 * s); ctx.fill();
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
  ctx.strokeStyle = c; ctx.lineWidth = 3.2 * s; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y - 4 * s - lift);
  ctx.arc(x, y - 11 * s - lift, 7 * s, Math.PI, 0);
  ctx.lineTo(x + 7 * s, y - 4 * s - (opts.open ? lift + 4 * s : lift));
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 5 * s, 22 * s, 17 * s, 3 * s); ctx.fill();
  ctx.fillStyle = "#0b0d12";
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
  ctx.strokeStyle = color; ctx.lineWidth = 3 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(x - 9 * s, y, 5.5 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3.5 * s, y); ctx.lineTo(x + 12 * s, y); ctx.moveTo(x + 7 * s, y); ctx.lineTo(x + 7 * s, y + 5 * s); ctx.moveTo(x + 11 * s, y); ctx.lineTo(x + 11 * s, y + 4 * s); ctx.stroke();
  ctx.restore();
}

/** A browser address bar with the padlock, like the one the reader has open right now. */
export function browserBar(ctx: Ctx, x: number, y: number, w: number, s: number, url: string, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = "#161a24"; ctx.strokeStyle = palette.dot; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 17 * s, w, 34 * s, 17 * s); ctx.fill(); ctx.stroke();
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

/** A dashed wire between two points. */
export function wire(ctx: Ctx, a: [number, number], b: [number, number], alpha = 1, color: string = palette.dot) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  ctx.restore();
}
