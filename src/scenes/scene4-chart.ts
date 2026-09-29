import type { AttackResult } from "../core/index.ts";
import { fitCanvas, approach, palette } from "../ui/dom.ts";
import { scene4 as copy } from "../ui/copy.ts";

/** Scene 4's side chart: attack success per dimension (bars) and LLL's shortest ÷ planted (line). */

interface Column {
  ok: number;
  gaveUp: number;
  n: number;
  ratioSum: number;
  ratioN: number;
  shown: number; // animated bar height 0..1
}

const RATIO_MAX = 1.3;

export function createAttackChart(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  let dims: number[] = [];
  let trials = 1;
  let cols = new Map<number, Column>();
  let revealed = 0; // columns are revealed one by one, even if the worker is faster
  let clock = 0;

  const complete = (d: number) => { const c = cols.get(d)!; return c.n >= trials; };

  function reset(newDims: number[], newTrials: number) {
    dims = newDims;
    trials = newTrials;
    cols = new Map(dims.map((d) => [d, { ok: 0, gaveUp: 0, n: 0, ratioSum: 0, ratioN: 0, shown: 0 }]));
    revealed = 0;
  }

  function add(r: AttackResult) {
    const c = cols.get(r.dim);
    if (!c) return;
    c.n++;
    if (r.gaveUp) c.gaveUp++;
    else {
      if (r.recovered) c.ok++;
      c.ratioSum += r.shortestFound / r.planted;
      c.ratioN++;
    }
  }

  function draw(dt: number) {
    clock += dt;
    if (revealed < dims.length && complete(dims[revealed]) && clock > 0.09) { revealed++; clock = 0; }
    const { w, h, dpr } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const L = 38, R = 14, T = 26, B = 24;
    const plotW = w - L - R;
    const gap = 10;
    const barH = (h - T - B - gap) * 0.62;
    const lineTop = T + barH + gap + 12;
    const lineH = h - B - lineTop;
    const maxDim = 40;
    const x = (d: number) => L + ((d - 1) / (maxDim - 1 + 3)) * plotW;
    const colW = Math.max(3, (plotW / (maxDim + 3)) * 1.5);

    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    // titles
    ctx.fillStyle = palette.ink; ctx.textAlign = "left";
    ctx.fillText(copy.chart.title, L, 15);
    // y grid for bars
    ctx.fillStyle = palette.muted; ctx.textAlign = "right";
    ctx.strokeStyle = "rgba(138,148,166,.18)"; ctx.lineWidth = 1;
    for (const [v, label] of [[0, "0%"], [0.5, "50%"], [1, "100%"]] as const) {
      const y = T + barH - v * barH;
      ctx.fillText(label, L - 6, y + 4);
      ctx.beginPath(); ctx.moveTo(L, y + 0.5); ctx.lineTo(w - R, y + 0.5); ctx.stroke();
    }
    // bars
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      const c = cols.get(d)!;
      const done = i < revealed;
      const target = done && c.n > 0 ? c.ok / c.n : 0;
      c.shown = approach(c.shown, target, 10, dt);
      const cx = x(d);
      if (!done) {
        ctx.fillStyle = "rgba(138,148,166,.12)";
        ctx.fillRect(cx - colW / 2, T + barH - 3, colW, 3);
        continue;
      }
      if (c.gaveUp === c.n) {
        ctx.fillStyle = palette.muted; ctx.textAlign = "center";
        ctx.fillText("×", cx, T + barH - 4);
        continue;
      }
      ctx.fillStyle = palette.attacker;
      const bh = Math.max(2, c.shown * barH);
      ctx.fillRect(cx - colW / 2, T + barH - bh, colW, bh);
    }
    // ratio line (secondary)
    ctx.fillStyle = palette.muted; ctx.textAlign = "left";
    ctx.fillText(copy.chart.ratio, L, lineTop - 4);
    const yr = (r: number) => lineTop + lineH - ((Math.min(r, RATIO_MAX) - 0.8) / (RATIO_MAX - 0.8)) * lineH;
    ctx.save();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(61,220,151,.5)";
    ctx.beginPath(); ctx.moveTo(L, yr(1)); ctx.lineTo(w - R, yr(1)); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = palette.secret; ctx.textAlign = "right";
    ctx.fillText(copy.chart.found, w - R, yr(1) + 14);
    ctx.strokeStyle = palette.ball; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    for (let i = 0; i < revealed; i++) {
      const c = cols.get(dims[i])!;
      if (!c.ratioN) continue;
      const px = x(dims[i]), py = yr(c.ratioSum / c.ratioN);
      if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
    }
    ctx.stroke();
    // x axis
    ctx.fillStyle = palette.muted; ctx.textAlign = "center";
    for (const d of [2, 10, 20, 30, 40]) ctx.fillText(d + copy.chart.dimension, x(d), h - 8);
    ctx.textAlign = "right";
    ctx.fillStyle = palette.secret;
    ctx.fillText(copy.chart.kyber, w - R, T + 14);
    if ([...cols.values()].some((c) => c.gaveUp > 0)) {
      ctx.fillStyle = palette.muted;
      ctx.fillText("× " + copy.chart.gaveUp, w - R, T + 30);
    }
  }

  return { reset, add, draw, finished: () => revealed === dims.length && dims.length > 0 };
}
