import { el, fitCanvas, runWhileVisible } from "./dom.ts";

/**
 * Scroll-story ("scrollytelling") layout.
 *
 * The picture stays pinned while short text steps scroll past. The step that crosses the middle of the
 * screen becomes the active one, and its animation starts from t = 0 (and replays if you scroll back).
 * Each chapter's draw(frame) decides what the picture looks like for (step, t) — steps are cumulative,
 * so the end of step k looks like the start of step k + 1 and nothing jumps.
 */
export interface StoryFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Active step (0-based). */
  step: number;
  /** Seconds since the active step became active. */
  t: number;
  /** Seconds since the chapter first came on screen (for idle motion like a gentle bob). */
  clock: number;
  dt: number;
}

export interface StoryOptions {
  steps: string[];
  ariaLabel: string;
  draw: (f: StoryFrame) => void;
}

export function mountStory(root: HTMLElement, opts: StoryOptions): { setStep(i: number): void; dispose(): void } {
  const canvas = el("canvas", { class: "story-canvas", role: "img", "aria-label": opts.ariaLabel });
  const figure = el("div", { class: "story-figure" }, canvas);
  const stepEls = opts.steps.map((text, i) =>
    el("div", { class: "story-step" + (i === 0 ? " active" : ""), "data-step": String(i) }, el("p", { text })),
  );
  const story = el("div", { class: "story" }, figure, el("div", { class: "story-steps" }, ...stepEls));
  root.append(story);
  const ctx = canvas.getContext("2d")!;

  let step = 0;
  let t = 0;
  let clock = 0;
  const setStep = (i: number) => {
    if (i === step) return;
    step = i;
    t = 0;
    stepEls.forEach((s, k) => s.classList.toggle("active", k === i));
  };

  // The active step is the one crossing a thin trigger band. On wide screens that band is the middle of the
  // viewport; on phones the pinned picture covers the top half, so the band sits lower, where the text is.
  const narrow = typeof matchMedia === "function" ? matchMedia("(max-width: 820px)") : null;
  let io: IntersectionObserver;
  const observe = () => {
    io?.disconnect();
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: narrow?.matches ? "-72% 0px -26% 0px" : "-48% 0px -48% 0px" },
    );
    stepEls.forEach((s) => io.observe(s));
  };
  observe();
  narrow?.addEventListener("change", observe);

  const stop = runWhileVisible(story, (dt) => {
    t += dt;
    clock += dt;
    const { w, h, dpr } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    opts.draw({ ctx, w, h, step, t, clock, dt });
  });

  return { setStep, dispose: () => { stop(); io.disconnect(); narrow?.removeEventListener("change", observe); story.remove(); } };
}
