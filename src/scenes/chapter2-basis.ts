import type { Vec } from "../core/index.ts";
import { babaiNearestPlane, closestVectorExact, coordinates, combine } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette, pulse } from "../ui/dom.ts";
import { chapter2 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing, drawCell, lerpBasis } from "./draw2d.ts";
import { prog, person, drawWalker, chip2 } from "./story-draw.ts";
import { GOOD, BAD } from "./scene2-basis.ts";

/**
 * Chapter 2 — same grid, two ways to walk. Steps (see copy.chapter2.steps):
 *  0 green arrows   1 red arrows   2 swap them: the dots don't move   3 short green walk to a dot
 *  4 long red walk to the same dot   5 the finder with green arrows: right   6 with red arrows: wrong   7 Sam private, Eve public
 * Uses the same two pairs as the "Try it yourself" playground below.
 */
const L = copy.labels;
const TARGET: Vec = combine(GOOD, [1, 1]);
const RED_STEPS = coordinates(BAD, TARGET).map((x) => Math.round(x) + 0); // [−1, 2]
/** A ball where rounding with the red arrows lands on the wrong dot (found with core; see NOTES). */
const BALL: Vec = [0.4, 0.5];
const GREEN_GUESS = babaiNearestPlane(GOOD, BALL).point;
const RED_GUESS = babaiNearestPlane(BAD, BALL).point;
const TRUTH = closestVectorExact(GOOD, BALL).point;

const walkPath = (basis: number[][], steps: number[]): Vec[] => {
  const path: Vec[] = [[0, 0]];
  steps.forEach((n, axis) => {
    for (let k = 0; k < Math.abs(n); k++) {
      const last = path[path.length - 1];
      const d = basis[axis].map((x) => x * Math.sign(n));
      path.push([last[0] + d[0], last[1] + d[1]]);
    }
  });
  return path;
};
const GREEN_PATH = walkPath(GOOD, [1, 1]);
const RED_PATH = walkPath(BAD, RED_STEPS);

export function mountChapter2(root: HTMLElement): () => void {
  const story = mountStory(root, { id: "c2", steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t, cue, pan } = f;
  const vp = makeViewport(w, h, 7.0);
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));
  const r = 3.6;
  const X = (p: Vec) => vp.toScreen(p)[0];

  // ---------- dots (flash when the arrows swap, to show they don't move) ----------
  const flash = step === 2 ? Math.max(0, Math.sin(Math.min(1, t / 2.4) * Math.PI * 3)) * (1 - prog(t, 2.2, 0.5)) : 0;
  drawDots(ctx, vp, visiblePoints(GOOD, vp), { color: step >= 5 ? palette.dot : palette.dotBright, radius: r + flash * 1.6 });

  // ---------- the two pairs of arrows ----------
  const greenGrow = step === 0 ? prog(t, 0.2, 0.9) : 1;
  const redGrow = step === 0 ? 0 : step === 1 ? prog(t, 0.2, 1.1) : 1;
  if (step === 0) cue(0.2, "grow", { dur: 0.9, pan: [0, 0.25] });
  if (step === 1) cue(0.2, "grow", { dur: 1.1, pan: [0, 0.6], pitch: 0.75 });
  // how strongly each pair is drawn in each step (the one the text talks about is bright)
  const greenA = [1, 0.5, 1, 1, 0.3, 1, 0.35, 1][step] ?? 1;
  const redA = [0, 1, 1, 0.3, 1, 0.3, 1, 1][step] ?? 1;

  // step 2: the grid's cell morphs from the green pair to the red pair and back — same dots underneath
  if (step === 2) {
    const k = 0.5 - 0.5 * Math.cos(Math.min(1, t / 2.4) * Math.PI * 2);
    drawCell(ctx, vp, lerpBasis(GOOD, BAD, k), k < 0.5 ? palette.secret : palette.attacker, [0, 0], 0.12);
    cue(0.1, "slide", { dur: 1.1, pan: [0, 0.5] });
    cue(1.3, "slide", { dur: 1.1, pan: [0.5, 0] });
    cue(2.5, "shimmer", { gain: 0.7 });
    chip2(ctx, L.same, w * 0.5, 28 * s, s, palette.ink, prog(t, 2.4, 0.4));
  }
  const pair = (b: number[][], color: string, grow: number, alpha: number, names: [string, string]) => {
    if (grow <= 0 || alpha <= 0) return;
    b.forEach((v, i) => drawArrow(ctx, vp, [0, 0], [v[0] * grow, v[1] * grow], color, { width: 2.6, alpha, label: grow > 0.9 && alpha > 0.6 ? names[i] : undefined }));
  };
  pair(GOOD, palette.secret, greenGrow, greenA, ["", ""]);
  pair(BAD, palette.attacker, redGrow, redA, ["", ""]);
  if (step <= 1) {
    const g = vp.toScreen(GOOD[1]), rr = vp.toScreen(BAD[0]);
    chip2(ctx, L.green, g[0] - 10 * s, g[1] - 22 * s, s, palette.secret, step === 0 ? prog(t, 0.9, 0.4) : 0.7, "right");
    if (step === 1) chip2(ctx, L.red, rr[0], rr[1] - 22 * s, s, palette.attacker, prog(t, 1.2, 0.4), "right");
  }

  // ---------- steps 3–4: two walks to the same dot ----------
  if (step === 3 || step === 4) {
    const [tx, ty] = vp.toScreen(TARGET);
    const green = step === 3;
    if (!green) drawWalker(ctx, vp, GREEN_PATH, 99, 0, 0.6, palette.secret, { alpha: 0.35, showWalker: false });
    const path = green ? GREEN_PATH : RED_PATH, per = green ? 0.6 : 0.9;
    drawWalker(ctx, vp, path, t, 0.8, per, green ? palette.secret : palette.attacker, {
      onHop: (k, from) => cue(0.8 + k * per, "hop", { pan: pan(X(from)), pitch: green ? 1.1 + k * 0.08 : 0.8 + k * 0.05 }),
    });
    const arrive = 0.8 + (path.length - 1) * per;
    cue(arrive, "ding", { pan: pan(tx), gain: green ? 1 : 0.7 });
    drawRing(ctx, vp, TARGET, palette.ball, { r, alpha: prog(t, 0.2, 0.4), pulse: pulse(f.clock * 5) });
    chip2(ctx, green ? L.short : L.long, tx, ty - 30 * s, s, green ? palette.secret : palette.attacker, prog(t, arrive, 0.4));
  }

  // ---------- steps 5–7: the ball and the finder ----------
  if (step >= 5) {
    const drop = step === 5 ? prog(t, 0.3, 0.5) : 1;
    if (step === 5) cue(0.3, "pop", { pan: pan(X(BALL)) });
    // green finder
    const g = step === 5 ? prog(t, 1.0, 0.8) : 1;
    if (step === 5) { cue(1.0, "slide", { dur: 0.8, pan: [pan(X(BALL)), pan(X(GREEN_GUESS))] }); cue(1.85, "ding", { pan: pan(X(GREEN_GUESS)) }); }
    ctx.save(); ctx.globalAlpha = step === 6 ? 0.35 : 1;
    drawDashedLine(ctx, vp, BALL, GREEN_GUESS, g, palette.secret);
    if (g >= 1) drawRing(ctx, vp, GREEN_GUESS, palette.secret, { r, pulse: step === 5 ? pulse(f.clock * 5) : 0 });
    ctx.restore();
    if (step === 5 && g >= 1) { const [x, y] = vp.toScreen(GREEN_GUESS); chip2(ctx, L.right, x + 14 * s, y + 26 * s, s, palette.secret, prog(t, 1.85, 0.3), "left"); }
    // red finder: wrong dot, far away; then the real one
    if (step >= 6) {
      const k = step === 6 ? prog(t, 0.6, 1.0) : 1;
      if (step === 6) { cue(0.6, "slide", { dur: 1.0, pan: [pan(X(BALL)), pan(X(RED_GUESS))] }); cue(1.65, "nope", { pan: pan(X(RED_GUESS)) }); cue(2.3, "blip", { pan: pan(X(TRUTH)) }); }
      drawDashedLine(ctx, vp, BALL, RED_GUESS, k, palette.attacker);
      if (k >= 1) {
        drawRing(ctx, vp, RED_GUESS, palette.attacker, { r, filled: false });
        const [x, y] = vp.toScreen(RED_GUESS);
        chip2(ctx, L.wrong, x, y + 28 * s, s, palette.attacker, step === 6 ? prog(t, 1.65, 0.3) : 1);
      }
      const real = step === 6 ? prog(t, 2.3, 0.4) : 1;
      if (real > 0) {
        drawRing(ctx, vp, TRUTH, palette.secret, { r, alpha: real, pulse: pulse(f.clock * 5) });
        const [x, y] = vp.toScreen(TRUTH);
        if (step === 6) chip2(ctx, L.real, x + 14 * s, y - 24 * s, s, palette.secret, real, "left");
      }
    }
    drawBall(ctx, vp, BALL, drop);
  }

  // ---------- step 7: who holds which pair ----------
  if (step === 7) {
    const a = prog(t, 0.3, 0.5), b = prog(t, 0.9, 0.5);
    cue(0.3, "pop", { pan: -0.6 }); cue(0.9, "pop", { pan: 0.6, pitch: 0.8 }); cue(1.6, "click", { pan: -0.6, gain: 0.7 });
    const y = h - 70 * s;
    person(ctx, w * 0.2, y, s, L.sam, palette.secret, a);
    chip2(ctx, `${L.green} · ${L.private}`, w * 0.2, y + 50 * s, s * 0.9, palette.secret, a);
    person(ctx, w * 0.8, y, s, L.eve, palette.attacker, b);
    chip2(ctx, `${L.red} · ${L.public}`, w * 0.8, y + 50 * s, s * 0.9, palette.attacker, b);
  }
}
