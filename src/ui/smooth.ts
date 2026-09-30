import { reducedMotion, clamp } from "./dom.ts";

/**
 * The page's own scroll feel, on computers with a mouse or trackpad.
 *
 * The wheel, the keyboard (arrows, Page Up/Down, Space, Home/End) and in-page links (nav dots, "scroll to start")
 * set a target, and the page glides there with an ease-out instead of jumping. It still scrolls the real window,
 * so sticky pictures, the story steps and the browser's own features (find, back/forward) keep working.
 *
 * Left alone: touch screens (their native flick is already smooth), reduced motion, pinch/ctrl-zoom, anything a
 * scene has already handled (e.g. zooming the 3D view), and the wheel over an element that scrolls by itself.
 */
export function mountSmoothScroll(): () => void {
  const fine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  if (!fine) return () => {};
  const root = document.documentElement;
  root.style.scrollBehavior = "auto"; // we animate; the browser's own smooth scroll would fight us

  let target = scrollY, current = scrollY;
  let raf = 0, last = 0;
  let tween: { from: number; to: number; start: number; dur: number; dest?: HTMLElement } | null = null;
  const max = () => root.scrollHeight - innerHeight;

  const loop = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    if (tween) {
      if (tween.dest) tween.to = clamp(tween.dest.getBoundingClientRect().top + scrollY, 0, max()); // follows the page if it grows meanwhile
      const u = clamp((now - tween.start) / tween.dur, 0, 1);
      current = tween.from + (tween.to - tween.from) * (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
      if (u >= 1) { tween = null; target = current; }
    } else {
      current += (target - current) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - current) < 0.5) current = target;
    }
    scrollTo(0, current);
    if (tween || current !== target) raf = requestAnimationFrame(loop);
    else { raf = 0; last = 0; }
  };
  const run = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const glideBy = (d: number) => {
    if (tween) { target = tween.to; tween = null; }
    if (!raf) current = scrollY;
    target = clamp(target + d, 0, max());
    run();
  };
  const travelTo = (y: number, dest?: HTMLElement) => {
    current = scrollY;
    const to = clamp(y, 0, max()), dist = Math.abs(to - current);
    tween = { from: current, to, start: performance.now(), dur: clamp(500 + dist * 0.12, 600, 1600), dest };
    target = to;
    run();
  };

  // the page moved by other means (scrollbar keys we don't handle, find-in-page, back/forward): follow it
  const onScroll = () => { if (!raf) { target = current = scrollY; } };

  const scrollsItself = (node: EventTarget | null, dy: number): boolean => {
    for (let n = node as HTMLElement | null; n && n !== document.body && n !== root; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) {
        if ((dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) || (dy < 0 && n.scrollTop > 0)) return true;
      }
    }
    return false;
  };
  const onWheel = (e: WheelEvent) => {
    if (reducedMotion() || e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (scrollsItself(e.target, e.deltaY)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
    glideBy(e.deltaY * unit);
  };

  const typing = (n: Element | null) =>
    !!n && (n.matches("input, textarea, select, [contenteditable], [contenteditable] *") || (n as HTMLElement).isContentEditable);
  const onKey = (e: KeyboardEvent) => {
    if (reducedMotion() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(document.activeElement)) return;
    const page = innerHeight * 0.85;
    const onButton = document.activeElement?.matches("button, [role=button], summary");
    let d = 0;
    switch (e.key) {
      case "ArrowDown": d = 90; break;
      case "ArrowUp": d = -90; break;
      case "PageDown": d = page; break;
      case "PageUp": d = -page; break;
      case " ": if (onButton) return; d = e.shiftKey ? -page : page; break;
      case "Home": e.preventDefault(); travelTo(0); return;
      case "End": e.preventDefault(); travelTo(max()); return;
      default: return;
    }
    e.preventDefault();
    glideBy(d);
  };

  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || reducedMotion()) return;
    const id = decodeURIComponent(a.hash.slice(1));
    const dest = id ? document.getElementById(id) : null;
    if (!dest) return;
    e.preventDefault();
    history.pushState(null, "", a.hash);
    travelTo(dest.getBoundingClientRect().top + scrollY, dest);
  };

  addEventListener("wheel", onWheel, { passive: false });
  addEventListener("keydown", onKey);
  addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("click", onClick);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("wheel", onWheel);
    removeEventListener("keydown", onKey);
    removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick);
    root.style.scrollBehavior = "";
  };
}
