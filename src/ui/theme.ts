import { el } from "./dom.ts";

/**
 * Light and dark theme. Light = a bright studio behind the page, dark = a dark one.
 * Follows the visitor's system setting until they press the switch; their choice is remembered on this device.
 * The page's colours come from CSS tokens keyed on <html data-theme>; the 3D stage listens for "themechange".
 */
export type Theme = "light" | "dark";
const KEY = "lattice.theme";
const system = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
const stored = (): Theme | null => { try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; } };

let chosen: Theme | null = null; // the visitor's pick this visit (also kept when storage is blocked)
export const currentTheme = (): Theme => chosen ?? stored() ?? (system?.matches === false ? "light" : "dark");

function apply() {
  const t = currentTheme();
  document.documentElement.dataset.theme = t;
  // "only light" stops phone browsers' own forced dark mode from darkening the light theme
  document.documentElement.style.colorScheme = t === "dark" ? "dark" : "only light";
  dispatchEvent(new CustomEvent("themechange", { detail: t }));
}

/** Sets the theme on the page now (call early, before anything draws) and keeps following the system setting. */
export function initTheme(): void {
  apply();
  system?.addEventListener("change", () => { if (!chosen && !stored()) apply(); });
}

/** The Day/Night switch, shown with the sound switches. */
export function mountThemeSwitch(labels: { day: string; night: string; group: string }): HTMLElement {
  const btn = el("button", { type: "button", class: "snd-btn theme-btn" });
  const paint = () => {
    const dark = currentTheme() === "dark";
    // icon always; the word hides on phones (the button keeps it in its accessible name), like the sound switches
    btn.replaceChildren(el("span", { "aria-hidden": "true", text: dark ? "☾" : "☀" }), el("span", { class: "snd-txt", text: " " + (dark ? labels.night : labels.day) }));
    btn.setAttribute("aria-label", `${labels.group}: ${dark ? labels.night : labels.day}`);
    btn.setAttribute("aria-pressed", String(dark));
  };
  btn.addEventListener("click", () => {
    chosen = currentTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, chosen); } catch { /* private mode: the choice lasts for this visit */ }
    apply();
  });
  addEventListener("themechange", paint);
  paint();
  return btn;
}
