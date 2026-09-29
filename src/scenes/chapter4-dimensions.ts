import type { Basis, Vec } from "../core/index.ts";
import { showcaseBases, lll, mulberry32 } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette } from "../ui/dom.ts";
import { sfx } from "../ui/sound.ts";
import { chapter4 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, lerpBasis } from "./draw2d.ts";
import { prog, lerp, label, person, bubble, chip, chip2, cross, padlock } from "./story-draw.ts";
import { createAttackChart } from "./scene4-chart.ts";
import { startSweep } from "./scene4-sweep.ts";

/**
 * Chapter 4 — why bigger grids win. Steps (see copy.chapter4.steps):
 *  0 Eve's weapon, LLL   1 its moves, animated from the real trace   2 flat grid: Eve wins
 *  3 hundreds of directions   4 the chart fills in (real attacks, in a worker)   5 where Eve wins / loses
 *  6 real padlocks are far off the chart   7 quantum computers: pattern vs. no pattern
 */
const L = copy.labels;
const { good: GOOD, bad: BAD } = showcaseBases(2);
const TRACE = lll(BAD).trace; // Eve's moves, from core
const FRAMES: Basis[] = [BAD, ...TRACE.map((s) => s.basis)];
const MOVE_S = 1.2;
const DIMS = Array.from({ length: 20 }, (_, i) => 2 + 2 * i);
const TRIALS = 10;
const QUANTUM = "#b48cff";
// scattered points for "a grid in hundreds of directions, squashed flat" (fixed seed, just a picture)
let lastShown = 0;
const SCATTER: Vec[] = (() => { const r = mulberry32(44); return Array.from({ length: 90 }, () => [r() * 2 - 1, r() * 2 - 1] as Vec); })();

export function mountChapter4(root: HTMLElement): () => void {
  const chart = createAttackChart(null);
  chart.reset(DIMS, TRIALS);
  let started = false;
  let cancel: (() => void) | null = null;
  const story = mountStory(root, {
    id: "c4", steps: copy.steps, ariaLabel: L.aria,
    draw: (f) => {
      // the chart's attacks start the first time the reader reaches the chart
      if (f.step >= 4 && !started) {
        started = true;
        cancel = startSweep({ dims: DIMS, trials: TRIALS, seed: 3, budgetMs: 2000 }, (m) => chart.add(m.result), () => { cancel = null; }, () => {});
      }
      draw(f, chart);
    },
  });
  return () => { cancel?.(); story.dispose(); };
}

function draw(f: StoryFrame, chart: ReturnType<typeof createAttackChart>) {
  const { ctx, w, h, step, t, cue, pan } = f;
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));

  // ---------- steps 0–2: Eve tidies the crooked arrows ----------
  if (step <= 2 || (step === 3 && t < 0.6)) {
    const fade = step === 3 ? 1 - prog(t, 0, 0.5) : 1;
    ctx.save(); ctx.globalAlpha = fade;
    const vp = makeViewport(w, h, 9.5);
    drawDots(ctx, vp, visiblePoints(GOOD, vp), { color: palette.dotBright, radius: 3.4 });
    let basis = BAD, i = 0, k = 0;
    if (step === 1) {
      i = Math.min(FRAMES.length - 2, Math.floor(Math.max(0, t - 0.6) / MOVE_S));
      k = prog(t, 0.6 + i * MOVE_S, MOVE_S * 0.6);
      basis = lerpBasis(FRAMES[i], FRAMES[i + 1], k);
      TRACE.forEach((m, j) => cue(0.6 + j * MOVE_S, m.type === "swap" ? "swap" : "slide", { dur: MOVE_S * 0.6, pan: 0.2, pitch: 1 + j * 0.05 }));
    } else if (step >= 2) basis = FRAMES[FRAMES.length - 1];
    const tidy = step >= 2 ? prog(step === 2 ? t : 9, 0.2, 0.8) : step === 1 ? (i + k) / (FRAMES.length - 1) : 0;
    const color = tidy > 0.5 ? palette.secret : palette.attacker;
    basis.forEach((v) => drawArrow(ctx, vp, [0, 0], v, color, { width: 2.8 }));
    if (step === 1) {
      const m = TRACE[i];
      chip2(ctx, `${L.move.replace("{n}", String(i + 1))}: ${m.type === "swap" ? L.swap : L.shorten}`, w * 0.5, 28 * s, s * 1.1, palette.ink, prog(t, 0.6 + i * MOVE_S, 0.2));
    }
    // Eve and her weapon
    const eveP: [number, number] = [w * 0.82, h - 60 * s];
    person(ctx, eveP[0], eveP[1], s, L.eve, palette.attacker, step === 0 ? prog(t, 0.2, 0.5) : 1);
    chip2(ctx, L.lll, eveP[0], eveP[1] - 52 * s, s, palette.attacker, step === 0 ? prog(t, 0.7, 0.4) : 1);
    if (step === 0) { cue(0.2, "pop", { pan: pan(eveP[0]), pitch: 0.8 }); cue(0.7, "blip", { pan: pan(eveP[0]) }); }
    if (step === 2) {
      chip2(ctx, L.done, w * 0.5, 28 * s, s * 1.1, palette.secret, prog(t, 0.9, 0.4));
      padlock(ctx, w * 0.18, h - 70 * s, 1.6 * s, { open: prog(t, 1.5, 0.5), color: palette.attacker, alpha: prog(t, 1.1, 0.4) });
      bubble(ctx, eveP[0], eveP[1] - 72 * s, s, L.message, palette.attacker, prog(t, 2.0, 0.4));
      cue(0.9, "ding", { gain: 0.6 }); cue(1.5, "unlock", { pan: pan(w * 0.18) });
    }
    ctx.restore();
  }

  // ---------- step 3: hundreds of directions ----------
  if (step === 3) {
    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.4;
    const n = Math.floor(lerp(2, 500, prog(t, 0.6, 2.4)));
    const drawn = Math.min(160, n);
    ctx.save();
    for (let i = 0; i < drawn; i++) {
      const ang = i * 2.39996; // golden angle: evenly spread
      const len = R * (0.45 + 0.55 * ((i * 0.618) % 1));
      ctx.globalAlpha = Math.max(0.12, 1 - i / drawn) * prog(t, 0.6, 0.4);
      ctx.strokeStyle = i < 2 ? palette.secret : palette.dotBright; ctx.lineWidth = i < 2 ? 2.5 : 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * len, cy - Math.sin(ang) * len); ctx.stroke();
    }
    ctx.restore();
    if (n < 500) cue(0.6, "tick", { period: 0.12, gain: 0.5, pitch: 1 + n / 600 });
    cue(3.0, "shimmer");
    chip2(ctx, `${n} ${L.directions}`, cx, 30 * s, s * 1.2, palette.ink, prog(t, 0.6, 0.3));
  }

  // ---------- steps 4–6: the chart ----------
  if (step >= 4 && step <= 7) {
    const a = step === 4 ? prog(t, 0, 0.5) : step === 7 ? 1 - prog(t, 0, 0.5) : 1;
    const box = { x: 12, y: h * 0.16, w: w - 24, h: Math.min(h * 0.62, 360 * s) };
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(box.x, box.y);
    ctx.fillStyle = "rgba(11,13,18,.55)"; ctx.beginPath(); ctx.roundRect(-4, -8, box.w + 8, box.h + 12, 10); ctx.fill();
    chart.paint(ctx, box.w, box.h, f.dt);
    ctx.restore();
    // bars appearing: a soft tick per column as it is revealed, rising in pitch as the dimension climbs
    const shown = chart.revealedCount();
    if (shown > lastShown && step >= 4 && step <= 6) sfx("tick", { gain: 0.45, pitch: 0.8 + shown * 0.03, pan: pan(box.x + 38 + ((DIMS[shown - 1] - 1) / 42) * (box.w - 52)) });
    lastShown = shown;
    // chart geometry (matches scene4-chart: left 38, right 14, x(d) over 1…43)
    const xOf = (d: number) => box.x + 38 + ((d - 1) / 42) * (box.w - 52);
    if (step === 5) {
      const y = box.y + box.h + 22 * s;
      bracket(ctx, xOf(2), xOf(12), y, palette.attacker, prog(t, 0.3, 0.5));
      chip2(ctx, L.wins, (xOf(2) + xOf(12)) / 2, y + 22 * s, s, palette.attacker, prog(t, 0.5, 0.4));
      bracket(ctx, xOf(30), xOf(40), y, palette.secret, prog(t, 1.2, 0.5));
      chip2(ctx, L.safe, (xOf(30) + xOf(40)) / 2, y + 22 * s, s, palette.secret, prog(t, 1.4, 0.4));
      cue(0.4, "nope", { pan: pan(xOf(7)), gain: 0.7 }); cue(1.3, "ding", { pan: pan(xOf(35)) });
    }
    if (step === 6) {
      const y = box.y + box.h + 34 * s;
      chip2(ctx, L.real, w - 16, y, s * 1.1, palette.secret, prog(t, 0.3, 0.4), "right");
      const nudge = (Math.sin(f.clock * 4) + 1) * 3;
      label(ctx, "→", w - 14 + nudge, y + 30 * s, { size: 26 * s, weight: 800, color: palette.secret, align: "right", alpha: prog(t, 0.6, 0.4) });
      cue(0.3, "whoosh", { dur: 0.8, pan: [0, 0.9] });
    }
  }

  // ---------- step 7: quantum computers ----------
  if (step === 7) {
    const chipP: [number, number] = [w * 0.16, h * 0.5];
    chip(ctx, chipP[0], chipP[1], s, 0.6 + 0.4 * Math.sin(f.clock * 4), prog(t, 0.3, 0.4));
    label(ctx, L.quantum, chipP[0], chipP[1] + 46 * s, { size: 12 * s, color: QUANTUM, alpha: prog(t, 0.4, 0.4) });
    cue(0.3, "pop", { pan: pan(chipP[0]), pitch: 0.7 });
    // top: today's number puzzle hides a repeating pattern — the quantum computer locks on and the padlock breaks
    const top = h * 0.26, x0 = w * 0.34, x1 = w - 20;
    const found = prog(t, 1.2, 0.8);
    ctx.save();
    ctx.globalAlpha = prog(t, 0.5, 0.4);
    ctx.strokeStyle = found > 0 ? QUANTUM : palette.dotBright; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 3) { const y = top + Math.sin((x - x0) / 22) * 18 * s; if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.restore();
    beam(ctx, chipP, [x0, top], prog(t, 1.0, 0.4), QUANTUM);
    padlock(ctx, x1 - 18, top - 40 * s, 1.3 * s, { open: prog(t, 2.0, 0.4), broken: t > 2.1, color: palette.attacker, alpha: prog(t, 0.5, 0.4) });
    cue(1.0, "zap", { pan: [pan(chipP[0]), pan(x0)] }); cue(2.0, "crack", { pan: pan(x1) });
    // bottom: a grid in hundreds of directions, squashed flat — no pattern; the beam finds nothing to grab
    const bot = h * 0.7, bw = x1 - x0, bh = h * 0.22;
    ctx.save();
    ctx.globalAlpha = prog(t, 2.6, 0.5);
    ctx.fillStyle = palette.dotBright;
    for (const p of SCATTER) { ctx.beginPath(); ctx.arc(x0 + (p[0] + 1) / 2 * bw, bot + p[1] * bh / 2, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    const b2 = prog(t, 3.2, 0.5);
    beam(ctx, chipP, [x0 + bw * 0.5, bot], b2 * (1 - prog(t, 4.0, 0.5)), QUANTUM);
    cue(3.2, "zap", { pan: [pan(chipP[0]), pan(x0 + bw / 2)], gain: 0.6 }); cue(3.9, "nope", { pan: pan(x0 + bw / 2) });
    cross(ctx, x0 + bw * 0.5, bot, 12, palette.attacker, prog(t, 3.9, 0.3));
    chip2(ctx, L.pattern, x0 + bw * 0.5, bot + bh / 2 + 22 * s, s, palette.secret, prog(t, 4.1, 0.4));
  }
}

function bracket(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, a: number) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y - 6); ctx.lineTo(x0, y); ctx.lineTo(lerp(x0, x1, a), y); if (a >= 1) ctx.lineTo(x1, y - 6); ctx.stroke();
  ctx.restore();
}

function beam(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], k: number, color: string) {
  if (k <= 0) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.setLineDash([2, 5]);
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(from[0] + 30, from[1]); ctx.lineTo(lerp(from[0] + 30, to[0], k), lerp(from[1], to[1], k)); ctx.stroke();
  ctx.restore();
}
