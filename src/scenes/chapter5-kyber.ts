import { KYBER_PRESETS, kyberKeygen, kyberEncaps, kyberDecaps, kyberDecryptBits, mulberry32, center, toHex } from "../core/index.ts";
import type { StoryFrame } from "../ui/story.ts";
import { mountStory } from "../ui/story.ts";
import { palette } from "../ui/dom.ts";
import { chapter5 as copy } from "../ui/copy.ts";
import { prog, lerp, label, person, bubble, browserBar, chip2, cross } from "./story-draw.ts";

/**
 * Chapter 5 — the real thing (toy ML-KEM, n = 8, q = 97). Steps (see copy.chapter5.steps):
 *  0 ML-KEM, in your browser   1 the 97-hour clock   2 Sam's secret   3 jumble + shake → Sam's padlock
 *  4 Alex's key → pushed to 49 → sent   5 Eve sees a mess   6 on the clock the numbers split into 0s and 1s
 *  7 the same key on both sides
 * Every number on screen comes from core (kyberKeygen / kyberEncaps / kyberDecaps) with fixed seeds.
 */
const L = copy.labels;
const P = KYBER_PRESETS.scene;
const KEYS = kyberKeygen(P, mulberry32(3));
const ENC = kyberEncaps(KEYS.pk, mulberry32(4));
const DEC = kyberDecaps(KEYS.sk, KEYS.pk, ENC.ciphertext);
const RAW = kyberDecryptBits(KEYS.sk, ENC.ciphertext).raw;
const S_VALUES = KEYS.sk.s.flat().map((x) => center(x, P.q));
const A_VALUES = KEYS.pk.A.flat(2);
const E_VALUES = KEYS.e.flat().map((x) => center(x, P.q));
const T_VALUES = KEYS.pk.t.flat();
const PUSHED = ENC.m.map((b) => (b ? Math.round(P.q / 2) : 0));
const U_VALUES = ENC.ciphertext.u.flat();
const V_VALUES = ENC.ciphertext.v;

export function mountChapter5(root: HTMLElement): () => void {
  const story = mountStory(root, { id: "c5", steps: copy.steps, ariaLabel: L.aria, draw });
  return () => story.dispose();
}

function draw(f: StoryFrame) {
  const { ctx, w, h, step, t, cue } = f;
  const s = Math.max(0.7, Math.min(1.3, Math.min(w, h) / 420));
  const cell = Math.min(40 * s, (w - 40) / 8.5);
  const gridX = (w - cell * 8) / 2;

  /** A titled block of numbers, 8 per row, revealed one by one from `start`. Returns the y below it. */
  const block = (title: string, values: (number | string)[], y: number, color: string, start: number, per: number, alpha = 1, size = 1) => {
    if (alpha <= 0) return y + (Math.ceil(values.length / 8) * cell * 0.72 + 30 * s) * size;
    chip2(ctx, title, gridX, y, s * 0.9, color, alpha * prog(t, start - 0.2, 0.3), "left");
    const rowH = cell * 0.72 * size;
    values.forEach((v, i) => {
      const a = alpha * prog(t, start + i * per, 0.2);
      if (a <= 0) return;
      const x = gridX + (i % 8) * cell + cell / 2, yy = y + 24 * s + Math.floor(i / 8) * rowH + rowH / 2;
      label(ctx, String(v).replace("-", "−"), x, yy, { size: 15 * s * size, weight: 700, color, alpha: a });
    });
    return y + 24 * s + Math.ceil(values.length / 8) * rowH + 18 * s;
  };
  const tickRun = (start: number, n: number, per: number, x = 0) => { for (let i = 0; i < n; i += 2) cue(start + i * per, "tick", { gain: 0.35, pitch: 1 + (i % 8) * 0.04, pan: x }); };

  // ---------- step 0: ML-KEM in your browser ----------
  if (step === 0) {
    browserBar(ctx, w / 2, h * 0.3, Math.min(w * 0.8, 380 * s), s, L.url, prog(t, 0.2, 0.5));
    label(ctx, L.title, w / 2, h * 0.5, { size: 44 * s, weight: 800, color: palette.secret, alpha: prog(t, 0.8, 0.5) });
    cue(0.2, "pop"); cue(0.8, "shimmer");
  }

  // ---------- step 1: the 97-hour clock ----------
  if (step === 1) {
    const cx = w / 2, cy = h * 0.52, R = Math.min(w, h) * 0.32;
    clockFace(ctx, cx, cy, R, s, prog(t, 0, 0.5));
    // the hand walks 88 → 96, wraps to 0, and on to 8
    const hours = Math.floor(lerp(0, 17, prog(t, 0.6, 3.4)));
    const hour = (88 + hours) % P.q;
    for (let k = 0; k < 17; k++) cue(0.6 + (k * 3.4) / 17, "tick", { gain: 0.5, pitch: k === 9 ? 1.5 : 1 });
    cue(0.6 + (9 * 3.4) / 17, "blip");
    const ang = (hour / P.q) * Math.PI * 2 - Math.PI / 2;
    ctx.save(); ctx.strokeStyle = palette.ball; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.globalAlpha = prog(t, 0.4, 0.3);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * R * 0.85, cy + Math.sin(ang) * R * 0.85); ctx.stroke(); ctx.restore();
    label(ctx, String(hour), cx, cy + R * 0.35, { size: 30 * s, weight: 800, color: palette.ball, alpha: prog(t, 0.4, 0.3) });
    chip2(ctx, L.wrap, cx, cy - R - 34 * s, s, palette.ball, hours >= 9 ? 1 : 0);
    label(ctx, L.hours, cx, h - 24 * s, { size: 14 * s, color: palette.muted });
  }

  // ---------- steps 2–3: Sam's keys ----------
  if (step === 2 || step === 3) {
    person(ctx, w - 34 * s, h - 46 * s, 0.8 * s, L.sam, palette.secret, 1); // bottom-right: top-right holds the sound switches on phones
    let y = 20 * s;
    y = block(L.secret, S_VALUES, y, palette.secret, step === 2 ? 0.4 : -9, 0.07);
    if (step === 2) tickRun(0.4, S_VALUES.length, 0.07, 0.3);
    if (step === 3) {
      y = block(L.jumble, A_VALUES, y, palette.muted, 0.3, 0.03, 1, 0.8);
      y = block(L.shake, E_VALUES, y, palette.ball, 1.5, 0.05, 1, 0.8);
      block(L.padlock, T_VALUES, y, palette.attacker, 2.6, 0.06);
      tickRun(0.3, A_VALUES.length, 0.03, -0.2); cue(1.5, "shake", { dur: 0.7 }); cue(2.6, "click", { gain: 0.8 });
    }
  }

  // ---------- steps 4–5: Alex locks a key; Eve sees only numbers ----------
  if (step === 4 || step === 5) {
    const eveStep = step === 5;
    person(ctx, w - 34 * s, h - 46 * s, 0.8 * s, L.alex, palette.dotBright, 1);
    let y = 20 * s;
    y = block(L.alexKey, ENC.m, y, palette.ink, eveStep ? -9 : 0.3, 0.08);
    // the 1s are pushed halfway round the clock: 1 → 49
    const push = eveStep ? 1 : prog(t, 1.4, 0.6);
    const pushed = PUSHED.map((v, i) => (ENC.m[i] ? (push < 1 ? Math.round(lerp(1, v, push)) : v) : 0));
    y = block(L.pushed, pushed, y, palette.ball, eveStep ? -9 : 1.2, 0.02);
    if (!eveStep) { cue(0.3, "blip"); cue(1.4, "grow", { dur: 0.6 }); cue(2.3, "shake", { dur: 0.5 }); cue(2.9, "whoosh", { dur: 1.0, pan: [-0.6, 0.6] }); }
    y = block(L.sent, [...U_VALUES, ...V_VALUES], y, palette.ball, eveStep ? -9 : 2.3, 0.03, 1, 0.85);
    if (eveStep) {
      // Eve stares at the numbers: a mess without Sam's secret
      const ex = w * 0.5, ey = Math.min(h - 70 * s, y + 70 * s);
      person(ctx, ex, ey, 0.9 * s, L.eveName, palette.attacker, prog(t, 0.3, 0.4));
      bubble(ctx, ex, ey - 40 * s, s, "?", palette.attacker, prog(t, 0.8, 0.4));
      chip2(ctx, L.mess, ex, ey + 46 * s, s, palette.attacker, prog(t, 1.2, 0.4));
      cue(0.3, "pop", { pitch: 0.8 }); cue(0.9, "nope");
    }
  }

  // ---------- step 6: on the clock the numbers split into 0s and 1s ----------
  if (step === 6) {
    const cx = w / 2, cy = h * 0.44, R = Math.min(w, h) * 0.3;
    clockFace(ctx, cx, cy, R, s, 1, true);
    const k = prog(t, 0.6, 1.8);
    cue(0.6, "slide", { dur: 1.8 });
    V_VALUES.forEach((v, i) => {
      let d = (((RAW[i] - v) % P.q) + P.q) % P.q; // the short way round
      if (d > P.q / 2) d -= P.q;
      const x = v + d * k, ang = (x / P.q) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = k >= 1 ? (DEC.m[i] ? palette.ball : palette.secret) : palette.dotBright;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 6, 0, Math.PI * 2); ctx.fill();
    });
    const bitsY = cy + R + 50 * s;
    chip2(ctx, L.read, gridX, bitsY - 20 * s, s * 0.9, palette.secret, prog(t, 2.5, 0.3), "left");
    DEC.m.forEach((b, i) => {
      const a = prog(t, 2.6 + i * 0.1, 0.2);
      label(ctx, String(b), gridX + i * cell + cell / 2, bitsY + 12 * s, { size: 18 * s, weight: 800, color: b ? palette.ball : palette.secret, alpha: a });
      cue(2.6 + i * 0.1, "coin", { gain: 0.45, pitch: b ? 1.2 : 1 });
    });
    cue(3.6, "ding");
  }

  // ---------- step 7: the same key on both sides ----------
  if (step === 7) {
    const key = toHex(DEC.sharedSecret).slice(0, 8) + "…";
    const same = toHex(DEC.sharedSecret) === toHex(ENC.sharedSecret);
    const y = h * 0.34;
    person(ctx, w * 0.22, y, s, L.alex, palette.dotBright, prog(t, 0.2, 0.4));
    person(ctx, w * 0.78, y, s, L.sam, palette.secret, prog(t, 0.2, 0.4));
    chip2(ctx, toHex(ENC.sharedSecret).slice(0, 8) + "…", w * 0.22, y + 56 * s, s, palette.secret, prog(t, 0.6, 0.4));
    chip2(ctx, key, w * 0.78, y + 56 * s, s, palette.secret, prog(t, 0.9, 0.4));
    if (same) chip2(ctx, L.same, w * 0.5, y + 100 * s, s * 1.2, palette.secret, prog(t, 1.4, 0.4));
    const ey = h * 0.78;
    person(ctx, w * 0.5, ey, 0.9 * s, L.eveName, palette.attacker, prog(t, 1.8, 0.4));
    cross(ctx, w * 0.5 + 30 * s, ey - 20 * s, 9, palette.attacker, prog(t, 2.2, 0.3));
    cue(0.6, "coin", { pan: -0.5 }); cue(0.9, "coin", { pan: 0.5, pitch: 1.2 }); cue(1.4, "ding"); cue(2.2, "nope", { gain: 0.6 });
  }
}

/** The 97-hour clock: a ring with a tick per hour, 0 at the top; `zones` shades "reads 0" (top) and "reads 1" (bottom). */
function clockFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, s: number, a: number, zones = false) {
  const q = P.q;
  const ang = (x: number) => (x / q) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.globalAlpha = a;
  if (zones) {
    const zone = (from: number, to: number, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.globalAlpha = 0.22 * a; ctx.beginPath(); ctx.arc(cx, cy, R, ang(from), ang(to)); ctx.stroke(); };
    zone(-q / 4, q / 4, palette.secret);
    zone(q / 4, (3 * q) / 4, palette.ball);
    ctx.globalAlpha = a;
  }
  ctx.strokeStyle = palette.dot; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < q; i++) {
    const big = i % 12 === 0 || i === 48;
    const a1 = ang(i);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * (R - (big ? 10 : 5)), cy + Math.sin(a1) * (R - (big ? 10 : 5)));
    ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
    ctx.stroke();
  }
  ctx.restore();
  for (const n of [0, 24, 48, 72]) {
    const a1 = ang(n);
    label(ctx, String(n), cx + Math.cos(a1) * (R + 18 * s), cy + Math.sin(a1) * (R + 18 * s), { size: 13 * s, color: palette.muted, alpha: a });
  }
  if (zones) {
    label(ctx, L.zero, cx, cy - R * 0.55, { size: 22 * s, weight: 800, color: palette.secret, alpha: a });
    label(ctx, L.one, cx, cy + R * 0.55, { size: 22 * s, weight: 800, color: palette.ball, alpha: a });
  }
}
