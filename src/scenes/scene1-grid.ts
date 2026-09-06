import { pointsInBox, closestVectorExact, determinant } from "../core/index.ts";
import type { Basis, Vec } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, approach, easeOut, palette } from "../ui/dom.ts";
import { scene1 as copy } from "../ui/copy.ts";

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
    el("button", { type: "button", class: "btn", text: copy.labels.reset, onClick: () => { basis = DEFAULT_BASIS.map((v) => v.slice()); ball = null; } }),
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
  // smoothed highlight for the nearest dot
  let glow = 0;

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
    W = w; H = h;
    unit = Math.min(w, h) / 9;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const degenerate = isDegenerate();
    const showCoords = coordsToggle.checked;

    // fundamental cell
    if (!degenerate) {
      const o = toScreen([0, 0]);
      const a = toScreen(basis[0]);
      const b = toScreen(basis[1]);
      const ab = toScreen([basis[0][0] + basis[1][0], basis[0][1] + basis[1][1]]);
      ctx.beginPath();
      ctx.moveTo(o[0], o[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(ab[0], ab[1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
      ctx.fillStyle = "rgba(61,220,151,0.07)";
      ctx.fill();
      ctx.strokeStyle = "rgba(61,220,151,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // lattice points
    const halfW = w / 2 / unit + 0.5;
    const halfH = h / 2 / unit + 0.5;
    let pts: { point: Vec; coeffs: number[] }[] = [];
    if (!degenerate) pts = pointsInBox(basis, [halfW, halfH], MAX_POINTS);
    const dense = pts.length > 700;
    const r = dense ? 2 : 3.2;
    ctx.fillStyle = palette.dot;
    for (const { point } of pts) {
      const [x, y] = toScreen(point);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (showCoords && !dense) {
      ctx.fillStyle = palette.muted;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      for (const { point, coeffs } of pts) {
        const [x, y] = toScreen(point);
        ctx.fillText(`${coeffs[0]},${coeffs[1]}`, x + 5, y - 5);
      }
    }
    // origin
    {
      const [x, y] = toScreen([0, 0]);
      ctx.fillStyle = palette.dotBright;
      ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // ball + nearest
    const targetGlow = ball ? 1 : 0;
    glow = approach(glow, targetGlow, 6, dt);
    if (ball) {
      const age = time - ball.born;
      const drop = easeOut(age / 0.35); // ball lands
      const reach = easeOut((age - 0.25) / 0.45); // line grows toward the nearest dot
      const [bx, by] = toScreen(ball.pos);
      const [nx, ny] = toScreen(ball.nearest);

      // line
      if (reach > 0) {
        ctx.strokeStyle = palette.ball;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (nx - bx) * reach, by + (ny - by) * reach);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // nearest dot highlight
      if (reach >= 1) {
        const pulse = 0.5 + 0.5 * Math.sin((age - 0.7) * 5);
        ctx.strokeStyle = palette.secret;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(nx, ny, r + 4 + pulse * 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = palette.secret;
        ctx.beginPath(); ctx.arc(nx, ny, r + 1, 0, Math.PI * 2); ctx.fill();
        ctx.font = "12px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(copy.labels.nearest, nx + 12, ny + 22);
      }
      // ball (drops in from above and scales)
      const size = 6 * (0.4 + 0.6 * drop);
      const lift = (1 - drop) * 18;
      ctx.fillStyle = palette.ball;
      ctx.shadowColor = palette.ball;
      ctx.shadowBlur = 12 * drop;
      ctx.beginPath(); ctx.arc(bx, by - lift, size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // basis arrows
    for (const i of [0, 1] as const) {
      const [ox, oy] = toScreen([0, 0]);
      const [tx, ty] = toScreen(basis[i]);
      const color = palette.secret;
      const active = dragging === i || hover === i;
      ctx.strokeStyle = color;
      ctx.lineWidth = active ? 3 : 2.2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      // arrow head
      const ang = Math.atan2(ty - oy, tx - ox);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 12 * Math.cos(ang - 0.4), ty - 12 * Math.sin(ang - 0.4));
      ctx.lineTo(tx - 12 * Math.cos(ang + 0.4), ty - 12 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      // handle
      ctx.beginPath(); ctx.arc(tx, ty, active ? HANDLE_R : HANDLE_R - 3, 0, Math.PI * 2);
      ctx.fillStyle = active ? "rgba(61,220,151,0.28)" : "rgba(61,220,151,0.14)";
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
      // label
      ctx.fillStyle = palette.ink;
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(i === 0 ? copy.labels.basis1 : copy.labels.basis2, tx + 16 * Math.cos(ang) , ty + 16 * Math.sin(ang) + 5);
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
