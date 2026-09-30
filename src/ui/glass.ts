import { reducedMotion } from "./dom.ts";

/**
 * Liquid glass (user decision, Sept 30, after the StringTune site): the page's controls and cards are panes of glass.
 * The look lives in index.html (.glass surfaces: blur, a bright rim, a sheen); this adds what CSS can't do alone:
 *  - the sheen follows the cursor across every pane (--mx, --my);
 *  - buttons lean toward the cursor (magnetic);
 *  - cards lean a little with the scroll speed and settle when you stop (--glide on <html>);
 *  - in Chromium the control bar bends the page behind it like a lens (an SVG displacement map, built here).
 * Reduced motion keeps the look and drops the movement.
 */
const SHEEN = ".hero-text, .chapter-head, .story-step p, .prose, .stage-wrap, footer, .snd, .dots, .snd-btn";

export function mountGlass(): () => void {
  const root = document.documentElement;

  // the lens: edges bend what's behind inward, the middle stays clear (Chromium only: backdrop-filter: url(#liquid))
  if (/Chrome\//.test(navigator.userAgent)) {
    const n = 128, c = document.createElement("canvas"); c.width = c.height = n;
    const g = c.getContext("2d")!, img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / (n - 1) * 2 - 1, v = y / (n - 1) * 2 - 1, ex = Math.max(0, Math.abs(u) - .55) / .45, ey = Math.max(0, Math.abs(v) - .3) / .7, i = (y * n + x) * 4;
      img.data[i] = 128 - Math.sign(u) * ex * ex * 127; img.data[i + 1] = 128 - Math.sign(v) * ey * ey * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const box = document.createElement("div");
    box.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage href="${c.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
    document.body.append(box.firstElementChild!);
    root.classList.add("lens");
  }

  // the sheen follows the cursor (only panes near it are updated)
  const onMove = (e: PointerEvent) => {
    for (const p of document.querySelectorAll<HTMLElement>(SHEEN)) {
      const r = p.getBoundingClientRect();
      if (e.clientY < r.top - 240 || e.clientY > r.bottom + 240) continue;
      p.style.setProperty("--mx", `${e.clientX - r.left}px`); p.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
  };
  addEventListener("pointermove", onMove, { passive: true });

  // buttons lean toward the cursor
  const lean = (e: PointerEvent) => { const b = (e.target as HTMLElement).closest<HTMLElement>(".snd-btn, .scroll-hint"); if (!b || reducedMotion() || e.pointerType !== "mouse") return;
    const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .28}px)`; };
  const settle = (e: PointerEvent) => { const b = (e.target as HTMLElement).closest<HTMLElement>(".snd-btn, .scroll-hint"); if (b) b.style.transform = ""; };
  document.addEventListener("pointermove", lean, { passive: true });
  document.addEventListener("pointerout", settle, { passive: true });

  // cards lean with the scroll speed
  let lastY = scrollY, glide = 0, raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const v = scrollY - lastY; lastY = scrollY;
    const want = reducedMotion() ? 0 : Math.max(-1.6, Math.min(1.6, v * .04));
    glide += (want - glide) * .12;
    if (Math.abs(glide) < .001 && want === 0) { if (root.style.getPropertyValue("--glide")) root.style.removeProperty("--glide"); return; }
    root.style.setProperty("--glide", `${glide.toFixed(3)}deg`);
  };
  raf = requestAnimationFrame(tick);

  return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", onMove); document.removeEventListener("pointermove", lean); document.removeEventListener("pointerout", settle); };
}
