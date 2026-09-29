import { closestVectorExact, determinant } from "../core/index.ts";
import type { Basis, Vec } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, easeOut, palette } from "../ui/dom.ts";
import { scene1 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawCoords, drawCell, drawArrow, drawBall, drawDashedLine, drawRing, lerpBasis } from "./draw2d.ts";

const DEFAULT_BASIS: Basis = [
  [1.5, 0.2],
  [0.45, 1.25],
];
const HANDLE_R = 13; // px
const MAX_POINTS = 3000;

interface Ball {
  pos: Vec; // world units
  born: number; // seconds since scene start
  nearest: Vec;
  coeffs: number[];
}

export function mountScene1(root: HTMLElement): () => void {
  // ---------- DOM ----------
  const canvas = el("canvas", { class: "scene-canvas", "aria-label": "Interactive 2-D lattice" });
  const readout = el("div", { class: "readout", text: copy.hint });
  const coordsToggle = el("input", { type: "checkbox", id: "s1-coords" });
  const controls = el(
    "div",
    { class: "controls" },
    el("label", { for: "s1-coords" }, coordsToggle, " " + copy.labels.coords),
    el("button", { type: "button", class: "btn", text: copy.labels.reset, onClick: () => { reset = { from: basis.map((v) => v.slice()), t: 0 }; } }),
  );
  const stage = el("div", { class: "stage" }, canvas, readout);
  root.append(stage, controls);
  const ctx = canvas.getContext("2d")!;

  // ---------- state ----------
  let basis: Basis = DEFAULT_BASIS.map((v) => v.slice());
  let ball: Ball | null = null;
  let time = 0;
  let dragging: 0 | 1 | null = null;
  let pointerDown: { x: number; y: number; moved: boolean } | null = null;
  let hover: 0 | 1 | null = null;
  let unit = 60; // px per world unit, recomputed on resize
  let W = 0, H = 0;
  let reset: { from: Basis; t: number } | null = null;

  // ---------- coordinate helpers ----------
  const toScreen = (p: Vec): [number, number] => [W / 2 + p[0] * unit, H / 2 - p[1] * unit];
  const toWorld = (x: number, y: number): Vec => [(x - W / 2) / unit, (H / 2 - y) / unit];
  const isDegenerate = () => Math.abs(determinant(basis)) < 0.12;

  const canvasPos = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const hitHandle = (x: number, y: number): 0 | 1 | null => {
    for (const i of [1, 0] as const) {
      const [hx, hy] = toScreen(basis[i]);
      if (Math.hypot(hx - x, hy - y) <= HANDLE_R + 4) return i;
    }
    return null;
  };

  // ---------- interaction ----------
  canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = canvasPos(e);
    const h = hitHandle(x, y);
    pointerDown = { x, y, moved: false };
    if (h !== null) {
      dragging = h;
      canvas.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = canvasPos(e);
    if (dragging !== null) {
      reset = null; // grabbing an arrow cancels a reset in progress
      const p = toWorld(x, y);
      // keep arrows within a sane range so the grid never explodes
      const len = Math.hypot(p[0], p[1]);
      const maxLen = Math.min(W, H) / unit / 2.2;
      const minLen = 0.35;
      const k = len > maxLen ? maxLen / len : len < minLen ? minLen / Math.max(len, 1e-6) : 1;
      basis[dragging] = [p[0] * k, p[1] * k];
      if (ball) ball = throwBall(ball.pos, ball.born); // re-solve with the new grid
      if (pointerDown && Math.hypot(x - pointerDown.x, y - pointerDown.y) > 4) pointerDown.moved = true;
      canvas.style.cursor = "grabbing";
      return;
    }
    hover = hitHandle(x, y);
    canvas.style.cursor = hover !== null ? "grab" : "crosshair";
    if (pointerDown && Math.hypot(x - pointerDown.x, y - pointerDown.y) > 4) pointerDown.moved = true;
  });
  const endPointer = (e: PointerEvent) => {
    const [x, y] = canvasPos(e);
    if (dragging === null && pointerDown && !pointerDown.moved && !isDegenerate()) {
      ball = throwBall(toWorld(x, y), time);
    }
    dragging = null;
    pointerDown = null;
    canvas.style.cursor = hitHandle(x, y) !== null ? "grab" : "crosshair";
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", () => { dragging = null; pointerDown = null; });

  function throwBall(pos: Vec, born: number): Ball {
    const r = closestVectorExact(basis, pos);
    return { pos, born, nearest: r.point, coeffs: r.coeffs };
  }

  // ---------- drawing ----------
  function draw(dt: number) {
    time += dt;
    const { w, h, dpr } = fitCanvas(canvas);
    const vp = makeViewport(w, h, 9);
    W = w; H = h; unit = vp.unit;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // "Reset arrows" glides back instead of snapping; the ball is re-solved as the grid moves
    if (reset) {
      reset.t = Math.min(1, reset.t + dt / 0.5);
      basis = lerpBasis(reset.from, DEFAULT_BASIS, easeOut(reset.t));
      if (ball) ball = throwBall(ball.pos, ball.born);
      if (reset.t >= 1) reset = null;
    }

    const degenerate = isDegenerate();
    if (!degenerate) drawCell(ctx, vp, basis, palette.secret);
    const pts = degenerate ? [] : visiblePoints(basis, vp, MAX_POINTS);
    const r = drawDots(ctx, vp, pts);
    if (coordsToggle.checked) drawCoords(ctx, vp, pts);

    // ball + nearest
    if (ball) {
      const age = time - ball.born;
      const reach = easeOut((age - 0.25) / 0.45); // line grows toward the nearest dot
      drawDashedLine(ctx, vp, ball.pos, ball.nearest, reach, palette.ball);
      if (reach >= 1) drawRing(ctx, vp, ball.nearest, palette.secret, { r, pulse: 0.5 + 0.5 * Math.sin((age - 0.7) * 5), label: copy.labels.nearest });
      drawBall(ctx, vp, ball.pos, easeOut(age / 0.35));
    }

    // basis arrows
    for (const i of [0, 1] as const) {
      drawArrow(ctx, vp, [0, 0], basis[i], palette.secret, {
        handle: true, handleR: HANDLE_R, active: dragging === i || hover === i,
        label: i === 0 ? copy.labels.basis1 : copy.labels.basis2,
      });
    }

    // readout
    if (degenerate) readout.textContent = copy.labels.degenerate;
    else if (ball) {
      const [c1, c2] = ball.coeffs;
      const term = (c: number, name: string) => `${c < 0 ? "−" : ""}${Math.abs(c)}·${name}`;
      const dist = Math.hypot(ball.pos[0] - ball.nearest[0], ball.pos[1] - ball.nearest[1]);
      readout.textContent = `Nearest dot = ${term(c1, "b₁")} ${c2 < 0 ? "−" : "+"} ${Math.abs(c2)}·b₂   ·   distance ${dist.toFixed(2)}`;
    } else readout.textContent = copy.hint;
    readout.classList.toggle("warn", degenerate);
  }

  const stop = runWhileVisible(stage, draw);
  return () => { stop(); root.innerHTML = ""; };
}
