/** Tiny DOM helpers so scenes stay readable without a framework. */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") node.addEventListener(k.replace(/^on/, "").toLowerCase(), v as EventListener);
    else if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (typeof v === "boolean") { if (v) node.setAttribute(k, ""); }
    else node.setAttribute(k, String(v));
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const n = root.querySelector<T>(sel);
  if (!n) throw new Error(`missing element ${sel}`);
  return n;
};

/** Smoothly move a number toward a target. Returns the new value. */
export const approach = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Ease-out cubic for one-shot animations. t in [0,1]. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** Set canvas backing size to CSS size × devicePixelRatio. Returns CSS size. */
export function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  return { w, h, dpr };
}

/** Runs `frame(dt)` while the element is on screen; pauses when scrolled away. */
export function runWhileVisible(target: Element, frame: (dt: number) => void): () => void {
  let raf = 0;
  let last = 0;
  let visible = false;
  const loop = (t: number) => {
    if (!visible) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    frame(dt);
    raf = requestAnimationFrame(loop);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !visible) {
        visible = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      } else if (!e.isIntersecting && visible) {
        visible = false;
        cancelAnimationFrame(raf);
      }
    }
  }, { threshold: 0.05 });
  io.observe(target);
  return () => { visible = false; cancelAnimationFrame(raf); io.disconnect(); };
}

/** The three colours used in every scene. Keep in sync with public/index.html. */
export const palette = {
  dot: "#5b6b8c",
  dotBright: "#9fb0d6",
  ball: "#ffb454", // the ball / the ciphertext
  secret: "#3ddc97", // the secret / good basis
  attacker: "#ff5c7a", // the attacker / bad basis
  ink: "#e8ecf1",
  muted: "#8a94a6",
  bg: "#0b0d12",
};
