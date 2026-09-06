import { babaiNearestPlane, closestVectorExact, mulberry32, norm, sub } from "../core/index.ts";
import type { Basis, Vec } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, approach, easeOut, palette } from "../ui/dom.ts";
import { scene2 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawCell, drawArrow, drawBall, drawDashedLine, drawRing, lerpBasis } from "./draw2d.ts";

/** The good basis is orthogonal (rotated ~15°) so Babai is exact with it. */
const GOOD: Basis = [
  [1.2, 0.32],
  [-0.32, 1.2],
];
/** bad = [2·g1 + g2, 3·g1 + 2·g2] — determinant 1, so it generates the SAME lattice. */
const BAD: Basis = [
  [2 * GOOD[0][0] + GOOD[1][0], 2 * GOOD[0][1] + GOOD[1][1]],
  [3 * GOOD[0][0] + 2 * GOOD[1][0], 3 * GOOD[0][1] + 2 * GOOD[1][1]],
];

interface Throw {
  pos: Vec;
  born: number;
  guess: Vec; // what Babai finds with the current basis
  truth: Vec; // the real nearest dot
  wrong: boolean;
}

export function mountScene2(root: HTMLElement): () => void {
  // ---------- DOM ----------
  const canvas = el("canvas", { class: "scene-canvas", "aria-label": "The same lattice with a good and a bad basis" });
  const readout = el("div", { class: "readout", text: copy.hint });
  const goodBtn = el("button", { type: "button", class: "seg active", text: copy.labels.good, onClick: () => setMode("good") });
  const badBtn = el("button", { type: "button", class: "seg", text: copy.labels.bad, onClick: () => setMode("bad") });
  const tally = el("div", { class: "tally" });
  const controls = el(
    "div",
    { class: "controls" },
    el("div", { class: "segmented", role: "group", "aria-label": "Basis" }, goodBtn, badBtn),
    el("button", { type: "button", class: "btn", text: copy.labels.throwMany, onClick: () => throwMany(20) }),
    el("button", { type: "button", class: "btn", text: copy.labels.clear, onClick: () => { throws = []; stats = { good: [0, 0], bad: [0, 0] }; } }),
    tally,
  );
  const stage = el("div", { class: "stage" }, canvas, readout);
  root.append(stage, controls);
  const ctx = canvas.getContext("2d")!;

  // ---------- state ----------
  type Mode = "good" | "bad";
  let mode: Mode = "good";
  let blend = 0; // 0 = good basis drawn, 1 = bad basis drawn (animated)
  let flash = 0; // dots flash briefly on toggle to show they don't move
  let throws: Throw[] = [];
  let stats: Record<Mode, [number, number]> = { good: [0, 0], bad: [0, 0] }; // [wrong, total]
  let time = 0;
  let queue: { pos: Vec; at: number }[] = [];
  const rng = mulberry32(7);

  function setMode(m: Mode) {
    if (m === mode) return;
    mode = m;
    flash = 1;
    goodBtn.classList.toggle("active", m === "good");
    badBtn.classList.toggle("active", m === "bad");
    // re-judge existing throws with the new basis, and keep the tally per basis
    throws = throws.map((t) => judge(t.pos, t.born));
  }
  const currentBasis = (): Basis => (mode === "good" ? GOOD : BAD);
  const currentColor = () => (mode === "good" ? palette.secret : palette.attacker);

  function judge(pos: Vec, born: number): Throw {
    const guess = babaiNearestPlane(currentBasis(), pos).point;
    const truth = closestVectorExact(GOOD, pos).point;
    return { pos, born, guess, truth, wrong: norm(sub(guess, truth)) > 1e-6 };
  }
  function doThrow(pos: Vec) {
    const t = judge(pos, time);
    throws.push(t);
    if (throws.length > 24) throws.shift();
    stats[mode][1]++;
    if (t.wrong) stats[mode][0]++;
  }
  function throwMany(n: number) {
    const vp = makeViewport(canvas.clientWidth, canvas.clientHeight, 10);
    const hw = vp.w / 2 / vp.unit - 0.6, hh = vp.h / 2 / vp.unit - 0.9;
    for (let i = 0; i < n; i++) queue.push({ pos: [(rng() * 2 - 1) * hw, (rng() * 2 - 1) * hh], at: time + i * 0.12 });
  }

  // ---------- interaction ----------
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const r = canvas.getBoundingClientRect();
    const vp = makeViewport(r.width, r.height, 10);
    doThrow(vp.toWorld(e.clientX - r.left, e.clientY - r.top));
  });
  canvas.style.cursor = "crosshair";

  // ---------- drawing ----------
  function draw(dt: number) {
    time += dt;
    const { w, h, dpr } = fitCanvas(canvas);
    const vp = makeViewport(w, h, 10);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // release queued throws
    while (queue.length && queue[0].at <= time) doThrow(queue.shift()!.pos);

    blend = approach(blend, mode === "bad" ? 1 : 0, 7, dt);
    flash = approach(flash, 0, 3, dt);
    const shown = lerpBasis(GOOD, BAD, easeOut(blend));
    const color = mode === "bad" ? palette.attacker : palette.secret;

    // dots never move: draw them once from GOOD, flash brighter after a toggle
    const pts = visiblePoints(GOOD, vp);
    const r = drawDots(ctx, vp, pts, { color: flash > 0.02 ? palette.dotBright : palette.dot });

    // the cell of the shown basis
    drawCell(ctx, vp, shown, color, [0, 0], 0.08);

    // throws
    for (const t of throws) {
      const age = time - t.born;
      const drop = easeOut(age / 0.35);
      const reach = easeOut((age - 0.2) / 0.4);
      const guessColor = t.wrong ? palette.attacker : palette.secret;
      drawDashedLine(ctx, vp, t.pos, t.guess, reach, guessColor);
      if (reach >= 1) {
        drawRing(ctx, vp, t.guess, guessColor, { r, pulse: t.wrong ? 0 : 0.5 + 0.5 * Math.sin(age * 5) });
        if (t.wrong) {
          // show where it should have gone
          drawDashedLine(ctx, vp, t.pos, t.truth, easeOut((age - 0.6) / 0.4), palette.secret);
          drawRing(ctx, vp, t.truth, palette.secret, { r, filled: false, alpha: 0.9 });
        }
      }
      drawBall(ctx, vp, t.pos, drop);
    }
    // labels only for the newest throw, so the canvas doesn't fill with text
    const last = throws[throws.length - 1];
    if (last && time - last.born > 0.6) {
      drawRing(ctx, vp, last.guess, last.wrong ? palette.attacker : palette.secret, { r, label: last.wrong ? copy.labels.wrongDot : copy.labels.rightDot, alpha: 0 });
      if (last.wrong) drawRing(ctx, vp, last.truth, palette.secret, { r, label: copy.labels.realDot, alpha: 0, labelBelow: false, labelLeft: true });
    }

    // arrows of the shown basis
    drawArrow(ctx, vp, [0, 0], shown[0], color, { label: "b₁", handle: true, handleR: 9 });
    drawArrow(ctx, vp, [0, 0], shown[1], color, { label: "b₂", handle: true, handleR: 9 });

    // readout + tally
    const s = stats[mode];
    if (last && time - last.born > 0.6) {
      const dg = norm(sub(last.pos, last.guess)).toFixed(2);
      const dtruth = norm(sub(last.pos, last.truth)).toFixed(2);
      readout.textContent = last.wrong
        ? copy.readout.wrong.replace("{guess}", dg).replace("{truth}", dtruth)
        : copy.readout.right.replace("{dist}", dg);
      readout.classList.toggle("warn", last.wrong);
    } else {
      readout.textContent = copy.hint;
      readout.classList.remove("warn");
    }
    tally.innerHTML = "";
    tally.append(
      el("span", { class: "pill good", text: `${copy.labels.tallyGood}: ${stats.good[0]} / ${stats.good[1]} ${copy.labels.wrong}` }),
      el("span", { class: "pill bad", text: `${copy.labels.tallyBad}: ${stats.bad[0]} / ${stats.bad[1]} ${copy.labels.wrong}` }),
    );
    void s;
  }

  const stop = runWhileVisible(stage, draw);
  return () => { stop(); root.innerHTML = ""; };
}
