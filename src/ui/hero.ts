import type { Basis } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, palette } from "./dom.ts";
import { visiblePoints, drawDots, drawArrow } from "../scenes/draw2d.ts";
import type { Viewport } from "../scenes/draw2d.ts";

/**
 * Decorative background for the title: a lattice that slowly shears.
 * One arrow stays put, the other swings side to side, and the whole grid follows —
 * a quiet preview of Scene 1. Purely visual (aria-hidden); pauses when scrolled away.
 */
export function mountHero(hero: HTMLElement): () => void {
  const canvas = el("canvas", { class: "hero-bg", "aria-hidden": "true" });
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d")!;
  let t = 0;

  const stop = runWhileVisible(hero, (dt) => {
    t += dt * 0.22;
    canvas.style.height = `${hero.offsetHeight}px`;
    const { w, h, dpr } = fitCanvas(canvas);
    // the grid's origin sits to the right of the title on wide screens, low and centred on phones
    const unit = Math.min(w, h) / (w < 820 ? 14 : 11);
    const ox = w < 820 ? w * 0.5 : w * 0.72, oy = w < 820 ? h * 0.62 : h * 0.5;
    const vp: Viewport = {
      w: 2 * Math.max(ox, w - ox), h: 2 * Math.max(oy, h - oy), unit,
      toScreen: (p) => [ox + p[0] * unit, oy - p[1] * unit],
      toWorld: (x, y) => [(x - ox) / unit, (oy - y) / unit],
    };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const basis: Basis = [
      [1, 0],
      [0.9 * Math.sin(t), 1],
    ];
    drawDots(ctx, vp, visiblePoints(basis, vp, 1500), { alpha: 0.55 });
    drawArrow(ctx, vp, [0, 0], basis[0], palette.secret, { alpha: 0.4, width: 1.6 });
    drawArrow(ctx, vp, [0, 0], basis[1], palette.secret, { alpha: 0.4, width: 1.6 });
  });
  return () => { stop(); canvas.remove(); };
}
