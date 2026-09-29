import { el, fitCanvas, runWhileVisible } from "./dom.ts";
import { sfx, voiceStep, voiceStop, registerVoiceText } from "./sound.ts";
import type { Sfx } from "./sound.ts";

/**
 * Scroll-story ("scrollytelling") layout.
 *
 * The picture stays pinned while short text steps scroll past. The step that crosses the trigger band
 * becomes the active one, and its animation starts from t = 0 (and replays if you scroll back).
 * Each chapter's draw(frame) decides what the picture looks like for (step, t) — steps are cumulative,
 * so the end of step k looks like the start of step k + 1 and nothing jumps.
 *
 * Sound: draw() calls frame.cue(at, "pop") at the moment something happens; the effect plays once when
 * the step's clock passes `at` (or every `period` seconds for a looping animation). When a step becomes
 * active, its narration clip `<id>-s<step>` plays (if the visitor turned Voice on).
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
  /** Play sound `name` when the step clock passes `at` seconds (again every `period` seconds, if given). */
  cue(at: number, name: Sfx, period?: number): void;
}

export interface StoryOptions {
  /** Short id, used to name the narration clips: "c0" → c0-s0.mp3, c0-s1.mp3, … */
  id: string;
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
  const key = (i: number) => `${opts.id}-s${i}`;
  opts.steps.forEach((text, i) => registerVoiceText(key(i), text));

  let step = 0;
  let t = 0;
  let prevT = -1; // the step clock at the previous frame (cues fire in (prevT, t])
  let clock = 0;
  let spoken = -1; // the step whose narration has started (reset when the chapter leaves the screen)
  const setStep = (i: number) => {
    if (i !== step) {
      step = i;
      t = 0;
      prevT = -1;
      stepEls.forEach((s, k) => s.classList.toggle("active", k === i));
    }
    if (spoken !== i) { spoken = i; voiceStep(key(i)); }
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

  // stop the narration when the whole chapter leaves the screen
  const away = new IntersectionObserver((entries) => {
    for (const e of entries) if (!e.isIntersecting) { voiceStop(key(step)); spoken = -1; }
  });
  away.observe(story);

  const stop = runWhileVisible(story, (dt) => {
    t += dt;
    clock += dt;
    const from = prevT;
    const cue = (at: number, name: Sfx, period?: number) => {
      if (period && period > 0) {
        if (t < at) return;
        const k = Math.floor((t - at) / period);
        if (at + k * period > from) sfx(name);
      } else if (at > from && at <= t) sfx(name);
    };
    const { w, h, dpr } = fitCanvas(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    opts.draw({ ctx, w, h, step, t, clock, dt, cue });
    prevT = t;
  });

  return {
    setStep,
    dispose: () => { stop(); io.disconnect(); away.disconnect(); narrow?.removeEventListener("change", observe); story.remove(); },
  };
}
