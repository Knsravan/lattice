import type { Basis, Vec } from "../core/index.ts";
import { combine, nearbyPoints } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette, pulse } from "../ui/dom.ts";
import { chapter1 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing, drawCell } from "./draw2d.ts";
import type { Viewport } from "./draw2d.ts";
import { prog, loop, lerp, label } from "./story-draw.ts";

/**
 * Chapter 1 — build the grid, then ask the question. Steps (see copy.chapter1.steps):
 *  0 arrow A   1 a row of dots   2 arrow B   3 rows stack into a grid   4 "lattice" / "basis"
 *  5 an address: walk 3 × A then 2 × B → (3, 2)   6 backwards: (−1, 2)   7 no half steps
 *  8 drop a ball   9 measure to nearby dots   10 the question (zoom out)
 */
const L = copy.labels;
/** The same two arrows as the "Try it yourself" playground below, so the reader recognises them. */
const BASIS: Basis = [
  [1.5, 0.2],
  [0.45, 1.25],
];
const BALL: Vec = [-1.55, 1.45];
const ROW = 7; // dots per side along A
const ROWS = 5; // rows per side along B
const NEAR = nearbyPoints(BASIS, BALL, 5); // nearest first — core does the measuring
const WALKER = palette.ink;
const S = { ADDRESS: 5, BACKWARDS: 6, HALF: 7, BALL: 8, MEASURE: 9, QUESTION: 10 };

/** One hop of the walker: `amount` steps (1, −1 or ½) along arrow `axis`. */
interface Move { axis: 0 | 1; amount: number }
const hops = (a: number, b: number): Move[] => [
  ...Array.from({ length: Math.abs(a) }, (): Move => ({ axis: 0, amount: Math.sign(a) })),
  ...Array.from({ length: Math.abs(b) }, (): Move => ({ axis: 1, amount: Math.sign(b) })),
];
const WALKS: Record<number, { moves: Move[]; address: [string, string]; lands: boolean }> = {
  [S.ADDRESS]: { moves: hops(3, 2), address: ["3", "2"], lands: true },
  [S.BACKWARDS]: { moves: hops(-1, 2), address: ["−1", "2"], lands: true },
  [S.HALF]: { moves: [{ axis: 0, amount: 0.5 }], address: ["½", "0"], lands: false },
};
const T0 = 1.0; // walks start after the camera has settled
const PER = 0.6; // seconds per hop

export function mountChapter1(root: HTMLElement): () => void {
  const story = mountStory(root, { id: "c1", steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

const pt = (i: number, j: number): Vec => combine(BASIS, [i, j]);
const endOf = (moves: Move[]): Vec =>
  moves.reduce<Vec>((p, m) => [p[0] + BASIS[m.axis][0] * m.amount, p[1] + BASIS[m.axis][1] * m.amount], [0, 0]);

/** How much of the grid fits across the picture in each step (the long (3, 2) walk needs a wider view). */
const span = (step: number) => (step === S.ADDRESS ? 8.6 : step === S.BACKWARDS ? 7.4 : 6.4);

/** Where the camera looks during each step (it glides from the previous step's target). */
function target(step: number): Vec {
  const walk = WALKS[step];
  if (!walk) return [0, 0];
  const e = endOf(walk.moves);
  return [e[0] / 2, e[1] / 2];
}

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t, cue } = f;
  // the last step zooms out a little: many more dots, same question
  const zoom = step === S.QUESTION ? 1 + prog(t, 1.2, 2.2) * 0.9 : 1;
  const from = target(step - 1), to = target(step), glide = prog(t, 0, 0.9);
  const vp = camera(w, h, lerp(span(step - 1), span(step), glide) * zoom, [lerp(from[0], to[0], glide), lerp(from[1], to[1], glide)]);
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));
  const r = 3.6;

  // ---------- dots ----------
  if (step === 1) {
    // a walker steps along A, leaving a dot at every stop (right first, then left)
    const order: number[] = [0];
    for (let k = 1; k <= ROW; k++) order.push(k);
    for (let k = 1; k <= ROW; k++) order.push(-k);
    const period = order.length * 0.28 + 1.2;
    const shown = Math.floor(loop(t, period, order.length * 0.28) / 0.28) + 1;
    if (loop(t, period, 0) < order.length * 0.28) cue(0, "tick", 0.28);
    const pts = order.slice(0, shown).map((i) => ({ point: pt(i, 0), coeffs: [i, 0] }));
    drawDots(ctx, vp, pts, { color: palette.dotBright, radius: r });
    for (let k = 0; k < Math.min(shown, order.length) - 1; k++) {
      const i = order[k + 1];
      drawArrow(ctx, vp, pt(i > 0 ? i - 1 : i + 1, 0), pt(i, 0), palette.secret, { alpha: 0.28, width: 1.4 });
    }
  } else if (step === 2) {
    drawDots(ctx, vp, rowPoints(0), { color: palette.dotBright, radius: r });
  } else if (step === 3) {
    // rows slide out along B, one after another, up and down
    drawDots(ctx, vp, rowPoints(0), { color: palette.dotBright, radius: r });
    for (let k = 1; k <= ROWS; k++) {
      cue(0.3 + (k - 1) * 0.45, "whoosh");
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
    if (step === 4) {
      // a ripple runs out from the centre across the new grid
      cue(0.1, "shimmer");
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
      drawDots(ctx, vp, pts, { color: step >= S.BALL ? palette.dot : palette.dotBright, radius: step === S.QUESTION ? r / Math.sqrt(zoom) : r });
    }
  }

  // ---------- the two arrows ----------
  const aGrow = step === 0 ? prog(t, 0.2, 0.9) : 1;
  const bGrow = step < 2 ? 0 : step === 2 ? prog(t, 0.2, 0.9) : 1;
  if (step === 0) cue(0.2, "pop");
  if (step === 2) cue(0.2, "pop");
  const arrowAlpha = step >= S.BALL ? 0.55 : 1;
  if (step === 4) drawCell(ctx, vp, BASIS, palette.secret, [0, 0], 0.12 * prog(t, 0.2, 0.6));
  if (aGrow > 0) drawArrow(ctx, vp, [0, 0], [BASIS[0][0] * aGrow, BASIS[0][1] * aGrow], palette.secret, { alpha: arrowAlpha, width: step === 0 ? 3 : 2.4, label: L.a });
  if (bGrow > 0) drawArrow(ctx, vp, [0, 0], [BASIS[1][0] * bGrow, BASIS[1][1] * bGrow], palette.secret, { alpha: arrowAlpha, width: step === 2 ? 3 : 2.4, label: L.b });
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

  // ---------- steps 5–7: addresses, walked one hop at a time ----------
  if (step >= S.ADDRESS && step <= S.BALL) {
    const leaving = step === S.BALL ? 1 - prog(t, 0, 0.5) : 1;
    // the start flag at the centre dot
    const [ox, oy] = vp.toScreen([0, 0]);
    const flag = step === S.ADDRESS ? prog(t, 0.3, 0.4) : 1;
    if (step === S.ADDRESS) cue(0.3, "pop");
    drawRing(ctx, vp, [0, 0], WALKER, { r, alpha: flag * leaving, filled: false });
    label(ctx, L.start, ox, oy + 22 * s, { size: 13 * s, weight: 700, color: WALKER, alpha: flag * leaving });

    // earlier walks stay on screen, faded, so the reader keeps the previous answer in view
    for (const k of [S.ADDRESS, S.BACKWARDS, S.HALF]) {
      if (k >= step || step === S.BALL) continue;
      drawWalk(f, vp, s, WALKS[k], 99, 0.28 * leaving, false);
    }
    if (step <= S.HALF) drawWalk(f, vp, s, WALKS[step], t, 1, true);
    else drawWalk(f, vp, s, WALKS[S.HALF], 99, 0.28 * leaving, false);
  }

  // ---------- steps 8–10: the ball, the measuring lines, the answer ----------
  if (step >= S.BALL) {
    const drop = step === S.BALL ? prog(t, 0.6, 0.6) : 1;
    if (step === S.BALL) cue(0.6, "pop");
    if (step >= S.MEASURE) {
      NEAR.forEach((n, i) => {
        const g = step === S.MEASURE ? prog(t, 0.3 + i * 0.35, 0.5) : 1;
        const decided = step === S.MEASURE ? prog(t, 0.3 + NEAR.length * 0.35 + 0.4, 0.5) : 1;
        if (step === S.MEASURE) cue(0.3 + i * 0.35, "tick");
        const best = i === 0;
        ctx.save();
        ctx.globalAlpha = best ? 1 : 1 - 0.7 * decided;
        drawDashedLine(ctx, vp, BALL, n.point, g, best && decided > 0.5 ? palette.secret : palette.muted);
        if (!best && g >= 1) drawRing(ctx, vp, n.point, palette.muted, { r, filled: false });
        ctx.restore();
        if (best && decided > 0) drawRing(ctx, vp, n.point, palette.secret, { r, alpha: decided, pulse: pulse(f.clock * 5), label: L.closest });
      });
      if (step === S.MEASURE) cue(0.3 + NEAR.length * 0.35 + 0.4, "ding");
    }
    drawBall(ctx, vp, BALL, drop);
  }
}

/**
 * The walker hops along its moves, leaving a trail; a counter ticks up; on arrival the dot lights up with its
 * address (or, for a half step, a red ✗: no dot there). `tt` = time into the walk (99 = finished).
 */
function drawWalk(f: StoryFrame, vp: Viewport, s: number, walk: { moves: Move[]; address: [string, string]; lands: boolean }, tt: number, alpha: number, live: boolean) {
  const { ctx, w, cue } = f;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  let at: Vec = [0, 0];
  const count = [0, 0];
  let walker: Vec = [0, 0];
  let lift = 0;
  walk.moves.forEach((m, k) => {
    const start = T0 + k * PER;
    if (live) cue(start, "hop");
    const g = prog(tt, start, PER * 0.8);
    if (g <= 0) return;
    const d: Vec = [BASIS[m.axis][0] * m.amount, BASIS[m.axis][1] * m.amount];
    const to: Vec = [at[0] + d[0] * g, at[1] + d[1] * g];
    drawArrow(ctx, vp, at, to, WALKER, { width: 2.6, alpha: 0.85 });
    walker = to;
    lift = Math.sin(Math.PI * g) * 10;
    if (g >= 1) count[m.axis] += m.amount;
    at = [at[0] + d[0], at[1] + d[1]];
  });
  const arriveAt = T0 + walk.moves.length * PER;
  const arrived = prog(tt, arriveAt, 0.3);
  if (live) cue(arriveAt, walk.lands ? "ding" : "nope");

  // the walker itself
  if (live && tt > T0 - 0.2) {
    const [x, y] = vp.toScreen(walker);
    ctx.fillStyle = WALKER; ctx.strokeStyle = "#0b0d12"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - lift, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // arrival: the address, or "no dot here"
  const end = endOf(walk.moves);
  const [ex, ey] = vp.toScreen(end);
  if (arrived > 0) {
    if (walk.lands) {
      drawRing(ctx, vp, end, palette.ball, { r: 3.6, alpha: arrived, pulse: live ? pulse(f.clock * 5) : 0 });
      label(ctx, L.address.replace("{a}", walk.address[0]).replace("{b}", walk.address[1]), ex, ey - 26 * s, { size: 20 * s, weight: 800, color: palette.ball, alpha: arrived });
    } else {
      ctx.save();
      ctx.globalAlpha *= arrived;
      ctx.strokeStyle = palette.attacker; ctx.lineWidth = 3.5; ctx.lineCap = "round";
      const k = 8;
      ctx.beginPath(); ctx.moveTo(ex - k, ey - k); ctx.lineTo(ex + k, ey + k); ctx.moveTo(ex + k, ey - k); ctx.lineTo(ex - k, ey + k); ctx.stroke();
      ctx.restore();
      label(ctx, L.half, ex, ey + 48 * s, { size: 15 * s, weight: 700, color: palette.attacker, alpha: arrived });
    }
  }

  // the step counter, top-left of the picture
  if (live) {
    const fmt = (n: number) => (n === 0.5 ? "½" : n < 0 ? `−${Math.abs(n)}` : String(n));
    const text = L.counter.replace("{a}", fmt(count[0])).replace("{b}", fmt(count[1]));
    ctx.save();
    ctx.globalAlpha *= prog(tt, 0.4, 0.4);
    ctx.fillStyle = "rgba(11,13,18,.8)";
    ctx.beginPath(); ctx.roundRect(14, 14, Math.min(w - 28, 230 * s), 34 * s, 8); ctx.fill();
    ctx.restore();
    label(ctx, text, 26, 14 + 17 * s, { size: 15 * s, weight: 700, align: "left", color: WALKER, alpha: prog(tt, 0.4, 0.4) });
  }
  ctx.restore();
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
