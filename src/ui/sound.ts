import { el } from "./dom.ts";
import { sound as copy } from "./copy.ts";

/**
 * Sound for the scroll stories: synthesized sound effects (Web Audio, no files) and a recorded
 * narration clip per story step (public/voice/*.mp3, made with VoiceStudio by `npm run voice`).
 *
 * Both start OFF: browsers only allow sound after the visitor clicks something, and the choice is
 * theirs. The Voice / Sound-effects buttons stay in the corner; the choice is remembered on this device.
 */
export type Sfx =
  | "pop" | "blip" | "whoosh" | "click" | "unlock" | "snap" | "ding" | "buzz" | "tick" | "zap" | "crack" | "shimmer" | "hop" | "nope";

const state = { effects: false, voice: false };
let actx: AudioContext | null = null;
let master: GainNode | null = null;

// ---------- sound effects ----------

function ctx(): AudioContext | null {
  if (actx) return actx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.32;
  master.connect(actx.destination);
  return actx;
}

/** One tone with a quick attack and exponential decay. */
function tone(freq: number, dur: number, opts: { type?: OscillatorType; to?: number; gain?: number; at?: number } = {}) {
  const a = actx!, now = a.currentTime + (opts.at ?? 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, now);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.5, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(master!);
  o.start(now);
  o.stop(now + dur + 0.02);
}

/** A burst of filtered noise (whooshes, snaps, cracks). */
function noise(dur: number, opts: { from: number; to?: number; q?: number; gain?: number; type?: BiquadFilterType; at?: number }) {
  const a = actx!, now = a.currentTime + (opts.at ?? 0);
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.Q.value = opts.q ?? 1.2;
  f.frequency.setValueAtTime(opts.from, now);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, now + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.4, now + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(now);
}

const RECIPES: Record<Sfx, () => void> = {
  pop: () => tone(520, 0.12, { to: 880, gain: 0.45 }),
  blip: () => tone(990, 0.07, { gain: 0.3 }),
  hop: () => tone(430, 0.09, { to: 620, gain: 0.35 }),
  tick: () => tone(1600, 0.03, { type: "square", gain: 0.08 }),
  whoosh: () => noise(0.42, { from: 350, to: 2400, q: 0.9, gain: 0.35 }),
  snap: () => { noise(0.06, { from: 3500, type: "highpass", gain: 0.3 }); tone(1250, 0.06, { gain: 0.2 }); },
  click: () => { noise(0.035, { from: 2600, q: 3, gain: 0.55 }); tone(180, 0.08, { type: "triangle", gain: 0.4 }); },
  unlock: () => { tone(600, 0.06, { type: "triangle", gain: 0.35 }); tone(900, 0.09, { type: "triangle", gain: 0.35, at: 0.09 }); },
  ding: () => { tone(1320, 0.7, { gain: 0.3 }); tone(1980, 0.5, { gain: 0.12 }); },
  buzz: () => tone(140, 0.28, { type: "sawtooth", gain: 0.18 }),
  nope: () => { tone(330, 0.12, { type: "square", gain: 0.12 }); tone(247, 0.2, { type: "square", gain: 0.12, at: 0.12 }); },
  zap: () => tone(180, 0.35, { type: "sawtooth", to: 2200, gain: 0.16 }),
  crack: () => { noise(0.2, { from: 1200, to: 300, type: "lowpass", gain: 0.6 }); tone(90, 0.2, { type: "triangle", gain: 0.4 }); },
  shimmer: () => [0, 0.08, 0.16, 0.24].forEach((at, i) => tone([784, 988, 1175, 1568][i], 0.5, { gain: 0.15, at })),
};

/** Play a sound effect if the visitor has sound effects on. */
export function sfx(name: Sfx) {
  if (!state.effects || !ctx() || actx!.state !== "running") return;
  RECIPES[name]();
}

// ---------- narration ----------

interface Clip { file: string; text: string }
let manifest: Record<string, Clip> | null = null;
const texts: Record<string, string> = {};
const audio = typeof Audio === "function" ? new Audio() : null;
let current: string | null = null;

/** The stories register every step's words, so a stale recording (words changed since) is never played. */
export function registerVoiceText(key: string, text: string) {
  texts[key] = text;
}

/** Called when a story step becomes active. Plays its recording if Voice is on. */
export function voiceStep(key: string) {
  current = key;
  playCurrent();
}

/** Called when a story leaves the screen: stop talking about it. */
export function voiceStop(key?: string) {
  if (key && current !== key) return;
  audio?.pause();
}

function playCurrent() {
  if (!audio) return;
  audio.pause();
  if (!state.voice || !manifest || !current) return;
  const clip = manifest[current];
  if (!clip || clip.text !== texts[current]) return;
  audio.src = new URL(`voice/${clip.file}`, document.baseURI).href;
  audio.currentTime = 0;
  audio.play().catch(() => { /* blocked until the visitor interacts; the button click counts */ });
}

async function loadManifest(): Promise<void> {
  try {
    const r = await fetch(new URL("voice/manifest.json", document.baseURI));
    if (r.ok) manifest = (await r.json()) as Record<string, Clip>;
  } catch {
    manifest = null;
  }
}

// ---------- the corner control ----------

const read = (k: string) => { try { return localStorage.getItem(k) === "on"; } catch { return false; } };
const write = (k: string, on: boolean) => { try { localStorage.setItem(k, on ? "on" : "off"); } catch { /* private mode */ } };

export function mountSoundControls(): HTMLElement {
  const voiceBtn = el("button", { type: "button", class: "snd-btn" });
  const fxBtn = el("button", { type: "button", class: "snd-btn" });
  const box = el("div", { class: "snd", role: "group", "aria-label": copy.group }, voiceBtn, fxBtn);

  const render = () => {
    const hasVoice = !!manifest && Object.keys(manifest).length > 0;
    voiceBtn.disabled = !hasVoice;
    voiceBtn.title = hasVoice ? "" : copy.voiceMissing;
    const vOn = state.voice && hasVoice;
    const fill = (btn: HTMLButtonElement, icon: string, name: string, on: boolean) => {
      const words = `${name}: ${on ? copy.on : copy.off}`;
      // icon always; the words hide on phones (the button keeps them as its accessible name)
      btn.replaceChildren(el("span", { "aria-hidden": "true", text: icon }), el("span", { class: "snd-txt", text: " " + words }));
      btn.setAttribute("aria-label", words);
      btn.setAttribute("aria-pressed", String(on));
    };
    fill(voiceBtn, vOn ? "🔊" : "🔇", copy.voice, vOn);
    fill(fxBtn, state.effects ? "🔔" : "🔕", copy.effects, state.effects);
  };
  const wake = () => { if (ctx() && actx!.state !== "running") actx!.resume().catch(() => {}); };

  voiceBtn.addEventListener("click", () => {
    state.voice = !state.voice;
    write("lattice.voice", state.voice);
    wake();
    render();
    playCurrent();
  });
  fxBtn.addEventListener("click", () => {
    state.effects = !state.effects;
    write("lattice.effects", state.effects);
    wake();
    render();
    if (state.effects) setTimeout(() => sfx("blip"), 30);
  });

  // a remembered "on" choice still needs one click or key press on the page before the browser allows sound
  state.voice = read("lattice.voice");
  state.effects = read("lattice.effects");
  const firstGesture = () => { wake(); playCurrent(); window.removeEventListener("pointerdown", firstGesture); window.removeEventListener("keydown", firstGesture); };
  window.addEventListener("pointerdown", firstGesture);
  window.addEventListener("keydown", firstGesture);

  render();
  loadManifest().then(render);
  return box;
}
