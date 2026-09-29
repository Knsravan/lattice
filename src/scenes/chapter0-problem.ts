import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette } from "../ui/dom.ts";
import { chapter0 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots } from "./draw2d.ts";
import { prog, loop, along, lerp, label, person, bubble, node, envelope, padlock, key, browserBar, chip, wire } from "./story-draw.ts";

/**
 * Chapter 0 — the problem, no maths. Steps (see copy.chapter0.steps):
 *  0 Alex & Sam   1 hops through computers   2 Eve copies   3 lock it   4 but the key?
 *  5 Sam's padlock + key (the key stays home)   6 the open padlock travels; Eve's copy is harmless
 *  7 Alex clicks it shut   8 the locked box travels; Eve can't open hers; Sam opens it
 *  9 the browser padlock   10 today's puzzle (multiply vs. go back)   11 quantum computer   12 dots
 * The padlock steps (5–8) each play once and stop on their end picture, which is where the next one starts.
 */
const L = copy.labels;
const ALEX = palette.dotBright, SAM = palette.secret, EVE = palette.attacker, MSG = palette.ball;
const DOTS_BASIS = [[1, 0], [0.35, 0.95]];
const S = { PAD_KEY: 5, PAD_SEND: 6, PAD_LOCK: 7, PAD_TRAVEL: 8, BROWSER: 9, PUZZLE: 10, QUANTUM: 11, DOTS: 12 };

export function mountChapter0(root: HTMLElement): () => void {
  const story = mountStory(root, { id: "c0", steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

type P = [number, number];

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t, cue } = f;
  const s = Math.max(0.72, Math.min(1.6, Math.min(w / 430, h / 400)));
  const alexP: P = [w * 0.12, h * 0.42];
  const samP: P = [w * 0.86, h * 0.42];
  const nodes: P[] = [[w * 0.28, h * 0.34], [w * 0.42, h * 0.48], [w * 0.58, h * 0.34], [w * 0.72, h * 0.48]];
  const eveNode = nodes[2];
  const eveP: P = [w * 0.58, h * 0.8];
  const path: P[] = [[alexP[0] + 26 * s, alexP[1]], ...nodes, [samP[0] - 26 * s, samP[1]]];
  const eveAt = 3 / 5; // fraction of the path (Alex → Sam) where things pass Eve's computer

  // after the browser step the story leaves Alex, Sam and Eve for the puzzle
  const cast = step <= S.BROWSER ? 1 : step === S.PUZZLE ? 1 - prog(t, 0, 0.6) : 0;
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

  if (step === 0) {
    bubble(ctx, alexP[0] + 8 * s, alexP[1] - 34 * s, s, L.message, MSG, prog(t, 0.9, 0.5));
    cue(0.05, "pop"); cue(0.35, "pop"); cue(0.9, "blip");
  }
  if (step === 1) cue(0.1, "pop");
  if (step === 2) cue(0.15, "pop");

  // steps 1–3: the message hops across; from step 2 Eve takes a copy; from step 3 it is locked
  if (step >= 1 && step <= 3) {
    const period = 4.4, travel = 3.2;
    const tt = loop(t, period);
    const u = Math.min(1, tt / travel);
    const [ex, ey] = along(path, u);
    const locked = step === 3;
    cue(0, "whoosh", period);
    if (locked) cue(0.02, "click");
    envelope(ctx, ex, ey - 22 * s, s, { locked });
    if (step === 1 || u < 0.08) bubble(ctx, ex, ey - 36 * s, s, locked ? L.scrambled : L.message, locked ? palette.muted : MSG, step === 1 ? 1 : 1 - u / 0.08);
    if (u >= 1) bubble(ctx, samP[0], samP[1] - 34 * s, s, L.message, MSG, prog(tt, travel, 0.3));
    if (step >= 2) {
      // Eve's copy drops down her wire the moment the message passes her computer
      cue(eveAt * travel, "snap", period);
      const drop = prog(tt, eveAt * travel, 0.6);
      const kept = t > eveAt * travel + 0.6 || drop >= 1;
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
    cue(0, "whoosh", period);
    cue(eveAt * travel, "snap", period);
    cue(0.5, "blip");
    key(ctx, kx, ky - 22 * s, 1.1 * s, SAM);
    envelope(ctx, eveP[0] + 34 * s, eveP[1] - 6 * s, s, { locked: true });
    const drop = prog(tt, eveAt * travel, 0.6);
    if (drop > 0) key(ctx, lerp(eveNode[0], eveP[0] - 30 * s, drop), lerp(eveNode[1], eveP[1] - 4 * s, drop), 1.1 * s, EVE);
    label(ctx, L.how, w * 0.5, h * 0.14, { size: 48 * s, weight: 800, color: palette.ball, alpha: prog(t, 0.4, 0.6) });
  }

  // steps 5–9: the padlock, one clear move per step
  if (step >= S.PAD_KEY && step <= S.BROWSER) drawPadlockStory(f, s, { alexP, samP, eveP, eveNode, path, eveAt, cast });

  // steps 10–11: today's puzzle, and the quantum computer
  if (step === S.PUZZLE || step === S.QUANTUM) {
    const puzzle = step === S.PUZZLE;
    const cx = w * 0.5;
    const fwdY = h * 0.3, backY = puzzle ? h * 0.58 : h * 0.3;
    const a = puzzle ? prog(t, 0.3, 0.6) : 1 - prog(t, 0, 0.5);
    // forward: 37 × 53 → 1,961 in a blink
    label(ctx, L.multiply, cx - 120 * s, fwdY, { size: 24 * s, weight: 700, alpha: a });
    arrowLine(ctx, cx - 60 * s, fwdY, cx + 60 * s, fwdY, puzzle ? prog(t, 0.9, 0.35) : 1, SAM, a);
    label(ctx, L.product, cx + 120 * s, fwdY, { size: 24 * s, weight: 700, alpha: a * (puzzle ? prog(t, 1.2, 0.2) : 1) });
    label(ctx, L.easy, cx, fwdY + 30 * s, { size: 14 * s, color: SAM, alpha: a * (puzzle ? prog(t, 1.3, 0.3) : 1) });
    // backward: 1,961 → ? × ? by guessing
    const b = puzzle ? prog(t, 1.4, 0.6) : 1;
    label(ctx, L.product, cx - 120 * s, backY, { size: 24 * s, weight: 700, alpha: b });
    if (puzzle) {
      cue(1.2, "ding");
      const tries = L.tries;
      const tt = loop(t - 1.9, tries.length * 0.45 + 1.4, tries.length * 0.45);
      const i = Math.max(0, Math.min(tries.length - 1, Math.floor(Math.max(0, tt) / 0.45)));
      if (t > 1.9 && tt < tries.length * 0.45) cue(1.9, "tick", 0.45);
      arrowLine(ctx, cx - 60 * s, backY, cx + 60 * s, backY, Math.min(1, Math.max(0, tt) / (tries.length * 0.45)), palette.muted, b);
      if (t > 1.9) label(ctx, tries[i], cx + 120 * s, backY, { size: 22 * s, weight: 700, color: i === tries.length - 1 ? palette.ink : palette.muted });
      label(ctx, L.hard, cx, backY + 30 * s, { size: 14 * s, color: palette.muted, alpha: b });
    } else {
      // the quantum computer goes backwards fast, and the padlock pops
      cue(0.9, "zap"); cue(1.8, "crack");
      [2.3, 2.65, 3.0].forEach((at) => cue(at, "unlock"));
      const zap = prog(t, 0.9, 0.35);
      const chipP: P = [w * 0.8, h * 0.78];
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

  // step 12: dots — the new puzzle
  if (step === S.DOTS) {
    cue(0.3, "shimmer");
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

/**
 * Steps 5–9. Everything that exists at the end of a step is drawn in every later step, so nothing jumps:
 *  5 padlock + key appear at Sam ("stays with Sam")
 *  6 the OPEN padlock travels to Alex; Eve copies it ("can only lock ✓")
 *  7 Alex's message goes in, the padlock clicks shut
 *  8 the locked box travels to Sam; Eve's copy stays shut ("no key!"); Sam's key opens it
 *  9 (browser step) hold the finished picture
 */
function drawPadlockStory(
  f: StoryFrame, s: number,
  g: { alexP: P; samP: P; eveP: P; eveNode: P; path: P[]; eveAt: number; cast: number },
) {
  const { ctx, w, h, step, t, cue } = f;
  const { alexP, samP, eveP, eveNode, path, eveAt, cast } = g;
  const back = path.slice().reverse(); // Sam → Alex
  const samLockP: P = [samP[0] - 44 * s, samP[1] - 46 * s];
  const alexLockP: P = [alexP[0] + 44 * s, alexP[1] - 46 * s];
  const keyHome: P = [samP[0], samP[1] + 54 * s];
  const eveLockP: P = [eveP[0] - 40 * s, eveP[1] - 4 * s];
  const eveBoxP: P = [eveP[0] + 36 * s, eveP[1] - 4 * s];
  const samBoxP: P = [samP[0] - 44 * s, samP[1] - 46 * s];

  // how far each part of the story has got, given the current step
  const at = (k: number, start: number, dur: number) => (step > k ? 1 : step === k ? prog(t, start, dur) : 0);
  const appear = at(S.PAD_KEY, 0.2, 0.5);
  const keyIn = at(S.PAD_KEY, 0.7, 0.5);
  const tagIn = at(S.PAD_KEY, 1.2, 0.5);
  const send = at(S.PAD_SEND, 0.3, 2.6);
  const eveGetsLock = at(S.PAD_SEND, 0.3 + 2.6 * (1 - eveAt), 0.6);
  const harmless = at(S.PAD_SEND, 2.4, 0.5);
  const boxIn = at(S.PAD_LOCK, 0.2, 0.5);
  const onBox = at(S.PAD_LOCK, 0.7, 0.6);
  const shut = at(S.PAD_LOCK, 1.4, 0.25);
  const travel = at(S.PAD_TRAVEL, 0.3, 2.8);
  const eveGetsBox = at(S.PAD_TRAVEL, 0.3 + 2.8 * eveAt, 0.6);
  const noKey = at(S.PAD_TRAVEL, 2.3, 0.4);
  const keyGo = at(S.PAD_TRAVEL, 3.3, 0.6);
  const opened = at(S.PAD_TRAVEL, 4.0, 0.5);
  const read = at(S.PAD_TRAVEL, 4.4, 0.4);

  if (step === S.PAD_KEY) { cue(0.2, "pop"); cue(0.7, "blip"); }
  if (step === S.PAD_SEND) { cue(0.3, "whoosh"); cue(0.3 + 2.6 * (1 - eveAt), "snap"); cue(2.4, "ding"); }
  if (step === S.PAD_LOCK) { cue(0.2, "pop"); cue(1.5, "click"); }
  if (step === S.PAD_TRAVEL) { cue(0.3, "whoosh"); cue(0.3 + 2.8 * eveAt, "snap"); cue(2.3, "nope"); cue(4.0, "unlock"); cue(4.4, "ding"); }
  if (step === S.BROWSER) cue(0.1, "ding");

  // Sam's key: appears at home, and only ever moves as far as Sam's own box
  if (keyIn > 0) {
    const kx = lerp(keyHome[0], samBoxP[0] + 30 * s, keyGo * (1 - opened));
    const ky = lerp(keyHome[1], samBoxP[1] + 12 * s, keyGo * (1 - opened));
    key(ctx, kx, ky, 1.2 * s, SAM, keyIn * cast);
    label(ctx, L.stays, keyHome[0], keyHome[1] + 22 * s, { size: 12 * s, color: SAM, alpha: tagIn * cast * (1 - keyGo * (1 - opened)) });
  }

  // the padlock: at Sam (open) → travels to Alex (open) → onto Alex's box → shut
  if (appear > 0 && boxIn < 1 && send < 1) {
    // from where it rests beside Sam, through the same computers (Eve's is 2 hops in), to beside Alex
    const [px, py] = send > 0 ? along([samLockP, ...back.slice(1, -1), alexLockP], send) : samLockP;
    padlock(ctx, px, py, 1.2 * s, { open: 1, color: SAM, alpha: appear * cast });
  } else if (send >= 1 && travel <= 0) {
    // at Alex; during step 7 it slides onto the message box and clicks shut
    const bx = alexLockP[0], by = alexLockP[1] + 34 * s;
    if (boxIn > 0) envelope(ctx, bx, by, 1.2 * s, { alpha: boxIn });
    const lx = lerp(alexLockP[0], bx + 16 * s, onBox), ly = lerp(alexLockP[1], by + 10 * s, onBox);
    padlock(ctx, lx, ly, lerp(1.2, 0.95, onBox) * s, { open: 1 - shut, color: SAM });
    if (step === S.PAD_LOCK) label(ctx, L.click, bx, by - 34 * s, { size: 18 * s, weight: 800, color: palette.ball, alpha: prog(t, 1.5, 0.2) * (1 - prog(t, 2.6, 0.5)) });
  }

  // the locked box travels to Sam, then opens
  if (travel > 0) {
    const [mx, my] = travel < 1 ? along([[alexLockP[0], alexLockP[1] + 34 * s], ...path.slice(1, -1), [samBoxP[0], samBoxP[1]]], travel) : samBoxP;
    envelope(ctx, mx, my, 1.2 * s, { alpha: cast });
    padlock(ctx, mx + 16 * s, my + 10 * s - opened * 12 * s, 0.95 * s, { open: opened, color: SAM, alpha: cast * (1 - read) });
    if (read > 0) bubble(ctx, samP[0], samP[1] - 34 * s, s, L.message, SAM, read * cast);
  }

  // Eve: a copy of the open padlock (harmless), then a copy of the locked box (stays shut)
  if (eveGetsLock > 0) {
    const ex = lerp(eveNode[0], eveLockP[0], eveGetsLock), ey = lerp(eveNode[1], eveLockP[1], eveGetsLock);
    padlock(ctx, ex, ey, 0.9 * s, { open: 1, color: SAM, alpha: 0.9 * cast });
    label(ctx, L.onlyLocks, eveLockP[0] - 6 * s, eveLockP[1] - 30 * s, { size: 12 * s, color: SAM, alpha: harmless * cast * (1 - noKey) });
  }
  if (eveGetsBox > 0) {
    const ex = lerp(eveNode[0], eveBoxP[0], eveGetsBox), ey = lerp(eveNode[1], eveBoxP[1], eveGetsBox);
    envelope(ctx, ex, ey, s, { alpha: cast });
    padlock(ctx, ex + 14 * s, ey + 10 * s, 0.85 * s, { open: 0, color: SAM, alpha: cast });
    if (noKey > 0) bubble(ctx, eveP[0], eveP[1] - 40 * s, s, L.noKey, EVE, noKey * cast);
  }

  if (step === S.BROWSER) browserBar(ctx, w * 0.5, h * 0.12, Math.min(w * 0.7, 360 * s), s, L.url, prog(t, 0.1, 0.6));
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
