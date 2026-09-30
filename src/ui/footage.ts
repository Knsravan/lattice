import { el, clamp } from "./dom.ts";
import { currentTheme } from "./theme.ts";

/**
 * Real footage behind the page (user decision, Sept 30): one real video per chapter, scrubbed by the scroll.
 * Scroll down and the clip plays forward; scroll up and it plays backward. Near each chapter's start the clip
 * cross-fades into the next one. Day clips in the light theme, night clips in the dark theme.
 *
 * Clips come from `npm run footage` (Pexels, prepared with ffmpeg so any frame can be shown at once) and are listed
 * in public/footage/manifest.json. With no clips there, the promise rejects and main.ts keeps the 3D town instead.
 * Only the clips around the visible chapter are loaded. Decorative only (aria-hidden, muted, no controls).
 */
interface Clip { file: string; poster?: string }
const SLOT_OF_ANCHOR = ["title", "problem", "grid", "routes", "shake", "dimensions", "clock", "title"]; // title, chapters 0–5, footer

export async function mountFootage(anchors: HTMLElement[]): Promise<() => void> {
  const base = new URL("footage/", document.baseURI);
  const res = await fetch(new URL("manifest.json", base));
  if (!res.ok) throw new Error("no footage");
  const manifest = (await res.json()) as Record<string, Clip>;
  const has = (slot: string) => !!(manifest[`${slot}-day`] || manifest[`${slot}-night`]);
  if (!SLOT_OF_ANCHOR.every(has)) throw new Error("footage incomplete"); // a half-filled background looks worse than the town

  const clipFor = (slot: string): Clip => manifest[`${slot}-${currentTheme() === "dark" ? "night" : "day"}`] ?? manifest[`${slot}-day`] ?? manifest[`${slot}-night`];
  const slots = [...new Set(SLOT_OF_ANCHOR)];
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const box = el("div", { class: "footage", "aria-hidden": "true" });
  const videos = new Map<string, HTMLVideoElement>();
  for (const slot of slots) {
    const v = el("video", { muted: true, playsinline: true, preload: "none", disablepictureinpicture: true });
    v.muted = true; // (the attribute alone isn't enough in some browsers)
    const c = clipFor(slot);
    if (c.poster) v.poster = new URL(c.poster, base).href;
    box.append(v); videos.set(slot, v);
  }
  document.body.prepend(box);

  /** Load (or re-load in the other theme) the clips we are about to need. */
  const want = (slot: string) => {
    const v = videos.get(slot)!, c = clipFor(slot), src = new URL(c.file, base).href;
    if (saveData) { if (c.poster) v.poster = new URL(c.poster, base).href; return; } // on a data-saving connection: stills only
    if (v.dataset.src !== src) { const t = v.currentTime; v.dataset.src = src; v.src = src; v.preload = "auto"; v.load(); if (t) v.currentTime = t; if (c.poster) v.poster = new URL(c.poster, base).href; }
  };
  const onTheme = () => { for (const [slot, v] of videos) if (v.dataset.src) want(slot); };
  addEventListener("themechange", onTheme);

  let tops: number[] = [];
  const measure = () => { tops = anchors.map((a) => a.getBoundingClientRect().top + scrollY); };
  const ro = new ResizeObserver(measure); ro.observe(document.body); measure();

  let raf = 0, frames = 0;
  const smooth = (x: number) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (++frames % 30 === 0) measure(); // the page keeps growing as scenes and pictures load
    const mid = scrollY + innerHeight * .5;
    let k = 0; for (let i = 0; i < tops.length; i++) if (mid >= tops[i]) k = i;
    const next = Math.min(k + 1, tops.length - 1);
    const blend = next === k ? 0 : smooth((mid - (tops[next] - innerHeight * .6)) / (innerHeight * .9));
    // how far through its section each visible clip is: that is the moment of the clip to show
    // (the title starts at the clip's first frame when the page is at the top)
    const progress = (i: number) => {
      const from = i === 0 ? tops[0] + innerHeight * .5 : tops[i];
      return i + 1 < tops.length ? clamp((mid - from) / Math.max(1, tops[i + 1] - from), 0, 1) : clamp((mid - from) / innerHeight, 0, 1);
    };
    const shown = new Map<string, { o: number; p: number }>();
    const put = (i: number, o: number) => { const s = SLOT_OF_ANCHOR[i], prev = shown.get(s); if (!prev || prev.o < o) shown.set(s, { o, p: progress(i) }); };
    put(k, 1 - blend); if (next !== k) put(next, blend);
    // keep the neighbours ready so a cross-fade never waits for a download
    for (const i of [k - 1, k, k + 1, k + 2]) if (i >= 0 && i < SLOT_OF_ANCHOR.length) want(SLOT_OF_ANCHOR[i]);
    for (const [slot, v] of videos) {
      const s = shown.get(slot);
      v.style.opacity = s ? String(s.o) : "0";
      if (!s || s.o < .01 || !v.duration || v.readyState < 1 || v.seeking) continue;
      const t = s.p * Math.max(0, v.duration - .05);
      if (Math.abs(v.currentTime - t) > 1 / 30) v.currentTime = t;
    }
  };
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => box.classList.add("on"));

  return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("themechange", onTheme); box.remove(); };
}
