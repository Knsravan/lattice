import { el } from "./dom.ts";

/**
 * Scroll effects for the page's own elements, and the thin progress line that stands in for the hidden scrollbar.
 *
 * Elements appear as they come into view, each in its own way (the look lives in index.html, [data-reveal]):
 * headings rise word by word, the story pictures and playgrounds zoom up out of a blur, story steps slide in
 * from the side, paragraphs rise one after another. Each appears once and then stays.
 * Under reduced motion the CSS turns every transition into an instant change.
 */
export function mountReveal(root: HTMLElement): () => void {
  const mark = (sel: string, kind: string, stagger = false) =>
    root.querySelectorAll<HTMLElement>(sel).forEach((n, i) => {
      n.dataset.reveal = kind;
      if (stagger) n.style.setProperty("--i", String(i));
    });

  // headings: one span per word, so they can rise in turn
  root.querySelectorAll<HTMLElement>(".hero h1, .chapter-head h2, .scene h2").forEach((h) => {
    const words = (h.textContent ?? "").split(/(\s+)/);
    h.setAttribute("aria-label", h.textContent ?? "");
    h.replaceChildren(...words.map((w, i) => (/^\s+$/.test(w) ? w : el("span", { class: "word", "aria-hidden": "true", style: `--w:${i / 2}` }, w))));
    h.dataset.reveal = "words";
  });
  root.querySelectorAll<HTMLElement>(".hero-text").forEach((c) => { c.dataset.reveal = "rise"; c.style.setProperty("--i", "2"); });
  mark(".chapter-head .kicker, .scene .prose .kicker", "rise");
  mark(".story-figure", "zoom");
  mark(".story-step", "side");
  root.querySelectorAll<HTMLElement>(".scene .prose").forEach((p) =>
    p.querySelectorAll<HTMLElement>(":scope > p").forEach((n, i) => { n.dataset.reveal = "rise"; n.style.setProperty("--i", String(i + 1)); }));
  root.querySelectorAll<HTMLElement>(".stage-wrap").forEach((w) =>
    [...w.children].forEach((n, i) => { (n as HTMLElement).dataset.reveal = i === 0 ? "zoom" : "rise"; (n as HTMLElement).style.setProperty("--i", String(i)); }));
  mark("footer", "rise");

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  root.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
  // backup: on a busy phone the observer can report late, so anything on screen is shown on the next scroll or tick anyway
  const sweep = () => {
    for (const n of root.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)")) {
      const r = n.getBoundingClientRect();
      if (r.top < innerHeight * .95 && r.bottom > 0) { n.classList.add("in"); io.unobserve(n); }
    }
  };
  const tick = setInterval(sweep, 700);
  // whatever is already on screen at load plays in straight away
  requestAnimationFrame(() => document.documentElement.classList.add("reveal-ready"));

  // the progress line
  const bar = el("div", { class: "progress", "aria-hidden": "true" });
  document.body.append(bar);
  let queued = false;
  const paint = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  paint();

  return () => { io.disconnect(); clearInterval(tick); bar.remove(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
}
