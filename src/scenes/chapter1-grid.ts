import type { Basis, Vec } from "../core/index.ts";
import { combine, nearbyPoints } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette, pulse } from "../ui/dom.ts";
import { chapter1 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing, drawCell } from "./draw2d.ts";
import type { Viewport } from "./draw2d.ts";
import { prog, loop, label } from "./story-draw.ts";

/**
 * Chapter 1 — build the grid, then ask the question. Steps (see copy.chapter1.steps):
 *  0 arrow A   1 a row of dots   2 arrow B   3 rows stack into a grid   4 "lattice" / "basis"
 *  5 a trip: 3 × A + 2 × B   6 drop a ball   7 measure to nearby dots   8 the question (zoom out)
 */
const L = copy.labels;
/** The same two arrows as the "Try it yourself" playground below, so the reader recognises them. */
const BASIS: Basis = [
  [1.5, 0.2],
  [0.45, 1.25],
];
const TRIP = [3, 2];
const BALL: Vec = [-1.55, 1.45];
const ROW = 7; // dots per side along A
const ROWS = 5; // rows per side along B
const NEAR = nearbyPoints(BASIS, BALL, 5); // nearest first — core does the measuring

export function mountChapter1(root: HTMLElement): () => void {
  const story = mountStory(root, { steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

const pt = (i: number, j: number): Vec => combine(BASIS, [i, j]);

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t } = f;
  // the last step zooms out a little: many more dots, same question
  const zoom = step === 8 ? 1 + prog(t, 1.2, 2.2) * 0.9 : 1;
  // the camera glides to follow the trip in step 5, and glides back when the ball drops in step 6
  const tripMid: Vec = [(BASIS[0][0] * TRIP[0] + BASIS[1][0] * TRIP[1]) / 2, (BASIS[0][1] * TRIP[0] + BASIS[1][1] * TRIP[1]) / 2];
  const follow = step === 5 ? prog(t, 0, 0.9) : step === 6 ? 1 - prog(t, 0, 0.9) : 0;
  const vp = camera(w, h, 6.4 * zoom, [tripMid[0] * follow, tripMid[1] * follow]);
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));
  const r = 3.6;

  // ---------- dots ----------
  if (step === 1) {
    // a walker steps along A, leaving a dot at every stop (right first, then left)
    const order: number[] = [0];
    for (let k = 1; k <= ROW; k++) order.push(k);
    for (let k = 1; k <= ROW; k++) order.push(-k);
    const shown = Math.floor(loop(t, order.length * 0.28 + 1.2, order.length * 0.28) / 0.28) + 1;
    const pts = order.slice(0, shown).map((i) => ({ point: pt(i, 0), coeffs: [i, 0] }));
    drawDots(ctx, vp, pts, { color: palette.dotBright, radius: r });
    // ghost copies of A chained along the row
    for (let k = 0; k < Math.min(shown, order.length) - 1; k++) {
      const i = order[k + 1];
      const from = pt(i > 0 ? i - 1 : i + 1, 0);
      drawArrow(ctx, vp, from, pt(i, 0), palette.secret, { alpha: 0.28, width: 1.4 });
    }
  } else if (step === 2) {
    drawDots(ctx, vp, rowPoints(0), { color: palette.dotBright, radius: r });
  } else if (step === 3) {
    // rows slide out along B, one after another, up and down
    drawDots(ctx, vp, rowPoints(0), { color: palette.dotBright, radius: r });
    for (let k = 1; k <= ROWS; k++) {
      for (const j of [k, -k]) {
        const slide = prog(t, 0.3 + (k - 1) * 0.45, 0.7);
        if (slide <= 0) continue;
        const shift: Vec = [BASIS[1][0] * j * slide, BASIS[1][1] * j * slide];
        const pts = rowPoints(0).map((p) => ({ point: [p.point[0] + shift[0], p.point[1] + shift[1]], coeffs: p.coeffs }));
        ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * slide;
        drawDots(ctx, vp, pts, { color: palette.dotBright, radius: r });
        ctx.restore();
      }
    }
  } else if (step >= 4) {
    const pts = visiblePoints(BASIS, vp, 2500);
    // step 4: a ripple runs out from the centre across the new grid
    if (step === 4) {
      const wave = loop(t, 3.2, 99) * 3.2;
      ctx.save();
      for (const p of pts) {
        const d = Math.hypot(p.point[0], p.point[1]);
        const lit = Math.max(0, 1 - Math.abs(d - wave) / 0.8);
        const [x, y] = vp.toScreen(p.point);
        ctx.fillStyle = palette.dotBright;
        ctx.globalAlpha = 0.55 + 0.45 * lit;
        ctx.beginPath(); ctx.arc(x, y, r + lit * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else {
      drawDots(ctx, vp, pts, { color: step >= 6 ? palette.dot : palette.dotBright, radius: step === 8 ? r / Math.sqrt(zoom) : r });
    }
  }

  // ---------- the two arrows ----------
  const aGrow = step === 0 ? prog(t, 0.2, 0.9) : 1;
  const bGrow = step < 2 ? 0 : step === 2 ? prog(t, 0.2, 0.9) : 1;
  const arrowAlpha = step >= 6 ? 0.55 : 1;
  if (step === 4) drawCell(ctx, vp, BASIS, palette.secret, [0, 0], 0.12 * prog(t, 0.2, 0.6));
  if (aGrow > 0) arrowWithLabel(ctx, vp, [BASIS[0][0] * aGrow, BASIS[0][1] * aGrow], L.a, arrowAlpha, step === 0 ? 3 : 2.4);
  if (bGrow > 0) arrowWithLabel(ctx, vp, [BASIS[1][0] * bGrow, BASIS[1][1] * bGrow], L.b, arrowAlpha, step === 2 ? 3 : 2.4);
  if (step === 0) {
    const [ox, oy] = vp.toScreen([0, 0]);
    ctx.fillStyle = palette.dotBright;
    ctx.beginPath(); ctx.arc(ox, oy, r + 1, 0, Math.PI * 2); ctx.fill();
  }

  // step 4: the two new words
  if (step === 4) {
    label(ctx, L.lattice, w * 0.5, h * 0.1, { size: 26 * s, weight: 800, alpha: prog(t, 0.3, 0.6) });
    const mid = vp.toScreen([(BASIS[0][0] + BASIS[1][0]) * 0.5, -0.55]);
    label(ctx, L.basis, mid[0], mid[1], { size: 16 * s, weight: 700, color: palette.secret, alpha: prog(t, 1.0, 0.6) });
  }

  // step 5: the trip to one dot — 3 steps of A, then 2 steps of B
  if (step === 5) {
    const per = 0.55;
    const tt = loop(t, (TRIP[0] + TRIP[1]) * per + 2.2, (TRIP[0] + TRIP[1]) * per + 1);
    let at: Vec = [0, 0];
    let doneA = 0, doneB = 0;
    for (let k = 0; k < TRIP[0] + TRIP[1]; k++) {
      const isA = k < TRIP[0];
      const g = prog(tt, 0.3 + k * per, per * 0.85);
      if (g <= 0) break;
      const d = BASIS[isA ? 0 : 1];
      const to: Vec = [at[0] + d[0] * g, at[1] + d[1] * g];
      drawArrow(ctx, vp, at, to, palette.ball, { width: 3 });
      if (g >= 1) { if (isA) doneA++; else doneB++; }
      at = [at[0] + d[0], at[1] + d[1]];
    }
    const target = pt(TRIP[0], TRIP[1]);
    const arrived = prog(tt, 0.3 + (TRIP[0] + TRIP[1]) * per, 0.3);
    if (arrived > 0) drawRing(ctx, vp, target, palette.ball, { r, alpha: arrived, pulse: pulse(f.clock * 5) });
    const [tx, ty] = vp.toScreen(target);
    label(ctx, L.trip.replace("{a}", String(doneA)).replace("{b}", String(doneB)), Math.min(w - 90 * s, Math.max(90 * s, tx)), Math.max(22 * s, ty - 34 * s), { size: 17 * s, weight: 700, color: palette.ball, alpha: prog(tt, 0.3, 0.3) });
  }

  // steps 6–8: the ball, the measuring lines, the answer
  if (step >= 6) {
    const drop = step === 6 ? prog(t, 0.3, 0.6) : 1;
    if (step >= 7) {
      NEAR.forEach((n, i) => {
        const g = step === 7 ? prog(t, 0.3 + i * 0.35, 0.5) : 1;
        const decided = step === 7 ? prog(t, 0.3 + NEAR.length * 0.35 + 0.4, 0.5) : 1;
        const best = i === 0;
        ctx.save();
        ctx.globalAlpha = best ? 1 : 1 - 0.7 * decided;
        drawDashedLine(ctx, vp, BALL, n.point, g, best && decided > 0.5 ? palette.secret : palette.muted);
        if (!best && g >= 1) drawRing(ctx, vp, n.point, palette.muted, { r, filled: false });
        ctx.restore();
        if (best && decided > 0) drawRing(ctx, vp, n.point, palette.secret, { r, alpha: decided, pulse: pulse(f.clock * 5), label: L.closest });
      });
    }
    drawBall(ctx, vp, BALL, drop);
  }
}

/** A viewport looking at world point `c` (the usual one looks at the origin). */
function camera(w: number, h: number, unitsAcross: number, c: Vec): Viewport {
  const base = makeViewport(w, h, unitsAcross);
  const u = base.unit;
  return {
    w: w + 2 * Math.abs(c[0]) * u, h: h + 2 * Math.abs(c[1]) * u, unit: u, // big enough that visiblePoints covers the view
    toScreen: (p) => [w / 2 + (p[0] - c[0]) * u, h / 2 - (p[1] - c[1]) * u],
    toWorld: (x, y) => [(x - w / 2) / u + c[0], (h / 2 - y) / u + c[1]],
  };
}

function rowPoints(j: number) {
  const out = [];
  for (let i = -ROW; i <= ROW; i++) out.push({ point: pt(i, j), coeffs: [i, j] });
  return out;
}

function arrowWithLabel(ctx: CanvasRenderingContext2D, vp: Viewport, tip: Vec, name: string, alpha: number, width: number) {
  drawArrow(ctx, vp, [0, 0], tip, palette.secret, { alpha, width, label: name });
}
