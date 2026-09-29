import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette } from "../ui/dom.ts";
import { chapter0 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots } from "./draw2d.ts";
import { prog, loop, along, lerp, label, person, bubble, node, envelope, padlock, key, browserBar, chip, wire } from "./story-draw.ts";

/**
 * Chapter 0 — the problem, no maths. Steps (see copy.chapter0.steps):
 *  0 Alex & Sam   1 hops through computers   2 Eve copies   3 lock it   4 but the key?
 *  5 the padlock dance   6 the browser padlock   7 today's puzzle (multiply vs. go back)
 *  8 quantum computer   9 dots: a new puzzle
 */
const L = copy.labels;
const ALEX = palette.dotBright, SAM = palette.secret, EVE = palette.attacker, MSG = palette.ball;
const DOTS_BASIS = [[1, 0], [0.35, 0.95]];

export function mountChapter0(root: HTMLElement): () => void {
  const story = mountStory(root, { steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t } = f;
  const s = Math.max(0.72, Math.min(1.6, Math.min(w / 430, h / 400)));
  const alexP: [number, number] = [w * 0.12, h * 0.42];
  const samP: [number, number] = [w * 0.86, h * 0.42];
  const nodes: [number, number][] = [[w * 0.28, h * 0.34], [w * 0.42, h * 0.48], [w * 0.58, h * 0.34], [w * 0.72, h * 0.48]];
  const eveNode = nodes[2];
  const eveP: [number, number] = [w * 0.58, h * 0.8];
  const path: [number, number][] = [[alexP[0] + 26 * s, alexP[1]], ...nodes, [samP[0] - 26 * s, samP[1]]];
  const back = path.slice().reverse();
  const eveAt = 3 / 5; // fraction of the path where the message passes Eve's computer

  // after step 6 the story leaves Alex, Sam and Eve for the puzzle; they fade into the background
  const cast = step <= 6 ? 1 : step === 7 ? 1 - prog(t, 0, 0.6) : 0;
  const netAlpha = (step >= 1 ? (step === 1 ? prog(t, 0, 0.6) : 1) : 0) * cast;
  const eveAlpha = (step >= 2 ? (step === 2 ? prog(t, 0.1, 0.6) : 1) : 0) * cast;

  // --- the network ---
  if (netAlpha > 0) {
    for (let i = 0; i < path.length - 1; i++) wire(ctx, path[i], path[i + 1], netAlpha * 0.8);
    nodes.forEach((n, i) => node(ctx, n[0], n[1], s, netAlpha, i === 2 && step >= 2 ? EVE : palette.dot));
  }
  if (eveAlpha > 0) wire(ctx, [eveNode[0], eveNode[1] + 14 * s], [eveP[0], eveP[1] - 34 * s], eveAlpha, EVE);

  // --- the cast ---
  const intro = step === 0 ? prog(t, 0, 0.7) : 1;
  person(ctx, alexP[0], alexP[1], s, L.alex, ALEX, intro * cast);
  person(ctx, samP[0], samP[1], s, L.sam, SAM, (step === 0 ? prog(t, 0.3, 0.7) : 1) * cast);
  person(ctx, eveP[0], eveP[1], s, L.eve, EVE, eveAlpha);

  if (step === 0) bubble(ctx, alexP[0] + 8 * s, alexP[1] - 34 * s, s, L.message, MSG, prog(t, 0.9, 0.5));

  // steps 1–3: the message hops across; from step 2 Eve takes a copy; from step 3 it is locked
  if (step >= 1 && step <= 3) {
    const period = 4.4, travel = 3.2;
    const tt = loop(t, period);
    const u = Math.min(1, tt / travel);
    const [ex, ey] = along(path, u);
    const locked = step === 3;
    envelope(ctx, ex, ey - 22 * s, s, { locked });
    if (step === 1 || u < 0.08) bubble(ctx, ex, ey - 36 * s, s, locked ? L.scrambled : L.message, locked ? palette.muted : MSG, step === 1 ? 1 : 1 - u / 0.08);
    if (u >= 1) bubble(ctx, samP[0], samP[1] - 34 * s, s, L.message, MSG, prog(tt, travel, 0.3));
    if (step >= 2) {
      // Eve's copy drops down her wire the moment the message passes her computer
      const drop = prog(tt, eveAt * travel, 0.6);
      const kept = t > eveAt * travel + 0.6 || drop >= 1; // after the first pass she keeps it
      if (drop > 0 && drop < 1) envelope(ctx, lerp(eveNode[0], eveP[0], drop), lerp(eveNode[1], eveP[1] - 48 * s, drop), s, { locked, color: MSG, alpha: 0.85 });
      if (kept) {
        envelope(ctx, eveP[0] + 34 * s, eveP[1] - 6 * s, s, { locked });
        bubble(ctx, eveP[0], eveP[1] - 38 * s, s, locked ? L.scrambled : L.message, locked ? palette.muted : EVE, 1);
      }
    }
  }

  // step 4: sending the key doesn't work — Eve copies the key too
  if (step === 4) {
    const period = 4.4, travel = 3.2;
    const tt = loop(t, period);
    const u = Math.min(1, tt / travel);
    const [kx, ky] = along(path, u);
    key(ctx, kx, ky - 22 * s, 1.1 * s, SAM);
    envelope(ctx, eveP[0] + 34 * s, eveP[1] - 6 * s, s, { locked: true });
    const drop = prog(tt, eveAt * travel, 0.6);
    if (drop > 0) key(ctx, lerp(eveNode[0], eveP[0] - 30 * s, drop), lerp(eveNode[1], eveP[1] - 4 * s, drop), 1.1 * s, EVE);
    label(ctx, L.how, w * 0.5, h * 0.14, { size: 48 * s, weight: 800, color: palette.ball, alpha: prog(t, 0.4, 0.6) });
  }

  // steps 5–6: the padlock dance
  if (step === 5 || step === 6) {
    const period = 9.5;
    const tt = step === 6 ? 8.5 : loop(t, period, 8.5);
    // Sam's key never leaves Sam
    key(ctx, samP[0], samP[1] + 52 * s, 1.1 * s, SAM, cast);
    // a) an open padlock travels from Sam to Alex (Eve can copy it: harmless)
    const go = prog(tt, 0.2, 2.2);
    if (tt < 2.6) {
      const [px, py] = along(back, go);
      padlock(ctx, px, py - 20 * s, s, { open: 1, color: SAM });
    }
    const eveLockDrop = prog(tt, 0.2 + 2.2 * (1 - eveAt), 0.6);
    if (eveLockDrop > 0) padlock(ctx, lerp(eveNode[0], eveP[0] - 34 * s, eveLockDrop), lerp(eveNode[1], eveP[1] - 4 * s, eveLockDrop), 0.9 * s, { open: 1, color: SAM, alpha: 0.9 * cast });
    // b) Alex snaps it shut on the message
    if (tt >= 2.6 && tt < 3.5) {
      const shut = prog(tt, 2.8, 0.5);
      envelope(ctx, path[0][0], path[0][1] - 20 * s, s);
      padlock(ctx, path[0][0] + 14 * s, path[0][1] - 10 * s, 0.85 * s, { open: 1 - shut, color: SAM });
    }
    // c) the locked message travels to Sam; Eve's copy stays locked
    const trip = prog(tt, 3.5, 3.0);
    if (tt >= 3.5 && tt < 6.7) {
      const [mx, my] = along(path, trip);
      envelope(ctx, mx, my - 20 * s, s);
      padlock(ctx, mx + 14 * s, my - 10 * s, 0.85 * s, { open: 0, color: SAM });
    }
    const eveMsgDrop = prog(tt, 3.5 + 3.0 * eveAt, 0.6);
    if (eveMsgDrop > 0) {
      const ex = lerp(eveNode[0], eveP[0] + 34 * s, eveMsgDrop), ey = lerp(eveNode[1], eveP[1] - 6 * s, eveMsgDrop);
      envelope(ctx, ex, ey, s, { alpha: cast });
      padlock(ctx, ex + 14 * s, ey + 10 * s, 0.85 * s, { open: 0, color: SAM, alpha: cast });
      if (eveMsgDrop >= 1) bubble(ctx, eveP[0], eveP[1] - 40 * s, s, L.noKey, EVE, cast);
    }
    // d) Sam's key opens it
    if (tt >= 6.7) {
      const open = prog(tt, 6.9, 0.6);
      envelope(ctx, path[path.length - 1][0], path[path.length - 1][1] - 20 * s, s, { alpha: cast });
      padlock(ctx, path[path.length - 1][0] + 14 * s, path[path.length - 1][1] - 10 * s - open * 10 * s, 0.85 * s, { open, color: SAM, alpha: cast * (1 - prog(tt, 7.6, 0.4)) });
      bubble(ctx, samP[0], samP[1] - 34 * s, s, L.message, SAM, prog(tt, 7.5, 0.4) * cast);
    }
    if (step === 6) browserBar(ctx, w * 0.5, h * 0.12, Math.min(w * 0.7, 360 * s), s, L.url, prog(t, 0.1, 0.6));
  }

  // steps 7–8: today's puzzle, and the quantum computer
  if (step === 7 || step === 8) {
    const cx = w * 0.5;
    const fwdY = h * 0.3, backY = step === 7 ? h * 0.58 : h * 0.3;
    const a = step === 7 ? prog(t, 0.3, 0.6) : 1 - prog(t, 0, 0.5);
    // forward: 37 × 53 → 1,961 in a blink
    label(ctx, L.multiply, cx - 120 * s, fwdY, { size: 24 * s, weight: 700, alpha: a });
    arrowLine(ctx, cx - 60 * s, fwdY, cx + 60 * s, fwdY, step === 7 ? prog(t, 0.9, 0.35) : 1, SAM, a);
    label(ctx, L.product, cx + 120 * s, fwdY, { size: 24 * s, weight: 700, alpha: a * (step === 7 ? prog(t, 1.2, 0.2) : 1) });
    label(ctx, L.easy, cx, fwdY + 30 * s, { size: 14 * s, color: SAM, alpha: a * (step === 7 ? prog(t, 1.3, 0.3) : 1) });
    // backward: 1,961 → ? × ? by guessing
    const b = step === 7 ? prog(t, 1.4, 0.6) : 1;
    label(ctx, L.product, cx - 120 * s, backY, { size: 24 * s, weight: 700, alpha: b });
    if (step === 7) {
      const tries = L.tries;
      const tt = loop(t - 1.9, tries.length * 0.45 + 1.4, tries.length * 0.45);
      const i = Math.max(0, Math.min(tries.length - 1, Math.floor(Math.max(0, tt) / 0.45)));
      arrowLine(ctx, cx - 60 * s, backY, cx + 60 * s, backY, Math.min(1, Math.max(0, tt) / (tries.length * 0.45)), palette.muted, b);
      if (t > 1.9) label(ctx, tries[i], cx + 120 * s, backY, { size: 22 * s, weight: 700, color: i === tries.length - 1 ? palette.ink : palette.muted });
      label(ctx, L.hard, cx, backY + 30 * s, { size: 14 * s, color: palette.muted, alpha: b });
    } else {
      // the quantum computer goes backwards fast, and the padlock pops
      const zap = prog(t, 0.9, 0.35);
      const chipP: [number, number] = [w * 0.8, h * 0.78];
      chip(ctx, chipP[0], chipP[1], s, 0.5 + 0.5 * Math.sin(f.clock * 4) * (1 - zap) + zap, prog(t, 0, 0.5));
      label(ctx, L.quantum, chipP[0], chipP[1] + 44 * s, { size: 13 * s, color: "#b48cff", alpha: prog(t, 0.2, 0.5) });
      arrowLine(ctx, cx - 60 * s, backY, cx + 60 * s, backY, zap, "#b48cff", 1);
      label(ctx, L.tries[L.tries.length - 1], cx + 120 * s, backY, { size: 22 * s, weight: 700, color: "#b48cff", alpha: prog(t, 1.2, 0.3) });
      label(ctx, L.fast, cx, backY + 30 * s, { size: 14 * s, color: "#b48cff", alpha: prog(t, 1.3, 0.3) });
      const pop = prog(t, 1.7, 0.6);
      padlock(ctx, cx, h * 0.52, 2.2 * s, { open: pop, color: EVE, broken: pop > 0.3, alpha: prog(t, 1.4, 0.3) });
      // Eve's saved copies open one after another
      for (let k = 0; k < 3; k++) {
        const o = prog(t, 2.3 + k * 0.35, 0.4);
        const ex = w * 0.12 + k * 34 * s, ey = h * 0.84;
        envelope(ctx, ex, ey, s);
        padlock(ctx, ex + 14 * s, ey + 10 * s - o * 8 * s, 0.85 * s, { open: o, color: SAM, alpha: 1 - prog(t, 2.6 + k * 0.35, 0.4) });
      }
      person(ctx, w * 0.12 + 34 * s, h * 0.84 - 58 * s, 0.8 * s, L.eve, EVE, prog(t, 2.0, 0.4));
      bubble(ctx, w * 0.12 + 34 * s, h * 0.84 - 88 * s, s, L.message, EVE, prog(t, 3.4, 0.4));
    }
  }

  // step 9: dots — the new puzzle
  if (step === 9) {
    const vp = makeViewport(w, h, 8);
    const grow = prog(t, 0.2, 1.4);
    ctx.save();
    ctx.globalAlpha = grow;
    drawDots(ctx, vp, visiblePoints(DOTS_BASIS, vp), { color: palette.dotBright, radius: 3.4 });
    ctx.restore();
    const la = prog(t, 1.2, 0.6);
    if (la > 0) {
      ctx.save(); ctx.globalAlpha = la; ctx.fillStyle = "#11141c";
      ctx.beginPath(); ctx.roundRect(w * 0.5 - 110 * s, h * 0.5 - 26 * s, 220 * s, 52 * s, 12 * s); ctx.fill();
      ctx.restore();
    }
    label(ctx, L.dots, w * 0.5, h * 0.5, { size: 30 * s, weight: 800, color: palette.ink, alpha: la });
  }
}

function arrowLine(ctx: CanvasRenderingContext2D, x0: number, y: number, x1: number, _y1: number, k: number, color: string, alpha: number) {
  if (k <= 0 || alpha <= 0) return;
  const x = x0 + (x1 - x0) * k;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x - 9, y - 6); ctx.lineTo(x - 9, y + 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
