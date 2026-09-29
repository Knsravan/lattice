import type { Vec } from "../core/index.ts";
import { encode2d, decode2d, halfStepOf, mulberry32 } from "../core/index.ts";
import type { Sent, Read } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette } from "../ui/dom.ts";
import { chapter3 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing } from "./draw2d.ts";
import type { Viewport } from "./draw2d.ts";
import { prog, lerp, chip2, cross } from "./story-draw.ts";
import { GOOD, BAD } from "./scene3-noise.ts";

/**
 * Chapter 3 — add a shake (Learning With Errors). Steps (see copy.chapter3.steps):
 *  0 Alex sends a bit   1 a 0 = ball on a dot   2 a 1 = ball halfway   3 with no shake Eve reads both
 *  4 shake the ball   5 Sam rounds with green arrows: right   6 Eve rounds with red arrows: a guess
 *  7 ten bits: Sam 10/10, Eve 5/10   8 too much shake: Sam gets lost too
 * Every ball, reading and score comes from core (encode2d / decode2d) with fixed seeds, chosen so each
 * step shows its point (seeds found by search; see NOTES).
 */
const L = copy.labels;
const H = halfStepOf(GOOD);
const ZERO = encode2d(GOOD, 0, H, 0, mulberry32(5), 1);
const ONE = encode2d(GOOD, 1, H, 0, mulberry32(7), 1);
const SHAKEN = encode2d(GOOD, 1, H, 0.25, mulberry32(1595), 2); // Sam reads 1; Eve rounds to a different dot and reads 0
const SHAKE = 0.25;
const readBoth = (x: Sent) => ({ sent: x, sam: decode2d(GOOD, x.ball), eve: decode2d(BAD, x.ball) });
const batch = (seed: number, mag: number) => {
  const rng = mulberry32(seed);
  return Array.from({ length: 10 }, (_, i) => readBoth(encode2d(GOOD, (i % 2 === 0 ? 1 : 0) as 0 | 1, H, mag, rng, 2)));
};
const TEN = batch(1735, 0.25);
const TOO_MUCH = batch(934, 0.62);

export function mountChapter3(root: HTMLElement): () => void {
  const story = mountStory(root, { id: "c3", steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t, cue, pan } = f;
  const vp = makeViewport(w, h, 6.0);
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));
  const r = 3.6;
  const X = (p: Vec) => vp.toScreen(p)[0];

  drawDots(ctx, vp, visiblePoints(GOOD, vp), { color: step >= 7 ? palette.dot : palette.dotBright, radius: r });
  // Sam's green arrows and the public red arrows, always in view (faint)
  drawArrow(ctx, vp, [0, 0], BAD[0], palette.attacker, { alpha: 0.28, width: 1.5 });
  drawArrow(ctx, vp, [0, 0], BAD[1], palette.attacker, { alpha: 0.28, width: 1.5 });
  drawArrow(ctx, vp, [0, 0], GOOD[0], palette.secret, { alpha: 0.8, width: 2 });
  drawArrow(ctx, vp, [0, 0], GOOD[1], palette.secret, { alpha: 0.8, width: 2 });

  if (step === 0) {
    // "0 or 1?" — the two possible messages
    chip2(ctx, `${L.zero}  or  ${L.one}`, w * 0.5, h * 0.14, s * 1.2, palette.ball, prog(t, 0.3, 0.5));
    cue(0.3, "blip");
  }

  // steps 1–3: an unshaken 0 and 1
  if (step >= 1 && step <= 3) {
    const zeroIn = step === 1 ? prog(t, 0.3, 0.5) : 1;
    if (step === 1) cue(0.3, "pop", { pan: pan(X(ZERO.ball)) });
    drawBall(ctx, vp, ZERO.ball, zeroIn);
    bitTag(ctx, vp, ZERO.ball, "0", zeroIn);
    if (step >= 2) {
      // the 1 slides from its dot to exactly halfway
      const slide = step === 2 ? prog(t, 0.6, 0.8) : 1;
      if (step === 2) { cue(0.3, "pop", { pan: pan(X(ONE.dot)), pitch: 1.1 }); cue(0.6, "slide", { dur: 0.8, pan: pan(X(ONE.ball)) }); }
      const at: Vec = [lerp(ONE.dot[0], ONE.clean[0], slide), lerp(ONE.dot[1], ONE.clean[1], slide)];
      drawDashedLine(ctx, vp, ONE.dot, at, 1, palette.ball);
      drawBall(ctx, vp, at, step === 2 ? prog(t, 0.3, 0.3) : 1);
      bitTag(ctx, vp, at, "1", 1);
      if (step === 2 && slide >= 1) { const [x, y] = vp.toScreen(ONE.clean); chip2(ctx, L.halfway, x, y + 26 * s, s, palette.ball, prog(t, 1.4, 0.3)); }
    }
    if (step === 3) {
      // Eve reads both, easily
      [ZERO, ONE].forEach((x, i) => {
        const read = decode2d(BAD, x.ball);
        const [bx, by] = vp.toScreen(x.ball);
        const a = prog(t, 0.5 + i * 0.7, 0.4);
        cue(0.5 + i * 0.7, "snap", { pan: pan(bx) });
        chip2(ctx, L.eveReads.replace("{b}", String(read.bit)), bx, by - 28 * s, s, palette.attacker, a);
      });
    }
  }

  // steps 4–6: the shaken 1
  if (step >= 4 && step <= 6) {
    const [cx, cy] = vp.toScreen(SHAKEN.clean);
    // the shake: the ball jiggles around its spot and settles a little off it
    const jig = step === 4 ? prog(t, 0.4, 1.2) : 1;
    if (step === 4) cue(0.4, "shake", { dur: 1.1, pan: pan(cx) });
    const wob = (1 - jig) * 0.18;
    const at: Vec = [
      lerp(SHAKEN.clean[0], SHAKEN.ball[0], jig) + Math.sin(t * 38) * wob,
      lerp(SHAKEN.clean[1], SHAKEN.ball[1], jig) + Math.cos(t * 31) * wob,
    ];
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = palette.ball; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, SHAKE * vp.unit, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (step === 4) chip2(ctx, L.shake, cx, cy + SHAKE * vp.unit + 20 * s, s, palette.ball, prog(t, 1.4, 0.4));
    if (step >= 5) reading(f, vp, s, readBoth(SHAKEN), step === 5 ? t : 99, "sam", step === 5);
    if (step === 6) reading(f, vp, s, readBoth(SHAKEN), t, "eve", true);
    drawBall(ctx, vp, at, 1);
    bitTag(ctx, vp, at, "1", 1);
  }

  // steps 7–8: ten bits, and a score for each reader
  if (step === 7 || step === 8) {
    const set = step === 7 ? TEN : TOO_MUCH;
    const mag = step === 7 ? 0.25 : 0.62;
    let sam = 0, eve = 0, n = 0;
    set.forEach((x, i) => {
      const at = 0.4 + i * 0.35;
      const a = prog(t, at, 0.25);
      if (a <= 0) return;
      n++;
      const samOk = x.sam.bit === x.sent.bit, eveOk = x.eve.bit === x.sent.bit;
      if (samOk) sam++;
      if (eveOk) eve++;
      const [bx, by] = vp.toScreen(x.sent.ball);
      cue(at, "pop", { pan: pan(bx), gain: 0.6, pitch: 0.9 + (i % 5) * 0.05 });
      if (samOk) cue(at + 0.12, "coin", { pan: -0.5, gain: 0.6 });
      if (step === 8) {
        const [cx, cy] = vp.toScreen(x.sent.clean);
        ctx.save(); ctx.globalAlpha = 0.25 * a; ctx.strokeStyle = palette.ball; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, mag * vp.unit, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      drawBall(ctx, vp, x.sent.ball, a);
      bitTag(ctx, vp, x.sent.ball, String(x.sent.bit), a);
      // a small mark under each ball: did Sam get it? (green ring = right, red ✗ = wrong)
      if (!samOk) cross(ctx, bx + 11, by + 11, 4, palette.secret, a);
    });
    const board = (who: string, got: number, color: string, y: number) =>
      chip2(ctx, `${who}: ${L.score.replace("{r}", String(got)).replace("{n}", String(n))}`, 14, y, s * 1.1, color, n ? 1 : 0, "left");
    board(L.sam, sam, palette.secret, 24 * s);
    board(L.eve, eve, palette.attacker, 56 * s);
    if (step === 8) chip2(ctx, L.tooMuch, w * 0.5, h - 22 * s, s * 1.1, palette.ball, prog(t, 0.2, 0.4)); // (top-right is where the sound switches sit on phones)
    if (step === 8) cue(4.2, "nope", { gain: 0.8 });
    else cue(4.2, "ding");
  }
}

/** One reader rounding the ball with their own arrows: a line to the dot they land on, and their answer. */
function reading(f: StoryFrame, vp: Viewport, s: number, x: { sent: Sent; sam: Read; eve: Read }, tt: number, who: "sam" | "eve", live: boolean) {
  const { ctx, cue, pan } = f;
  const read = who === "sam" ? x.sam : x.eve;
  const color = who === "sam" ? palette.secret : palette.attacker;
  const ok = read.bit === x.sent.bit;
  const g = prog(tt, 0.4, 0.9);
  const [dx, dy] = vp.toScreen(read.dot);
  if (live) {
    cue(0.4, "slide", { dur: 0.9, pan: [pan(vp.toScreen(x.sent.ball)[0]), pan(dx)] });
    cue(1.4, ok ? "ding" : "nope", { pan: pan(dx) });
  }
  drawDashedLine(ctx, vp, x.sent.ball, read.dot, g, color);
  if (g >= 1) drawRing(ctx, vp, read.dot, color, { r: 3.6, filled: false });
  const a = prog(tt, 1.4, 0.3);
  const text = (who === "sam" ? L.samReads : L.eveGuess).replace("{b}", String(read.bit)) + (ok ? " ✓" : " ✗");
  chip2(ctx, text, dx, dy + (who === "sam" ? 30 : -30) * s, s, color, a);
}

/** The bit (0 or 1) written on a ball. */
function bitTag(ctx: CanvasRenderingContext2D, vp: Viewport, p: Vec, bit: string, a: number) {
  if (a < 0.9) return;
  const [x, y] = vp.toScreen(p);
  ctx.save();
  ctx.fillStyle = "#0b0d12"; ctx.font = "700 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(bit, x, y + 0.5);
  ctx.restore();
}
