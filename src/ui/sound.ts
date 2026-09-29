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
  | "pop" | "blip" | "hop" | "tick" | "whoosh" | "slide" | "grow" | "snap" | "click" | "unlock" | "ding" | "nope"
  | "zap" | "crack" | "shimmer" | "shake" | "swap" | "coin" | "buzz";

/** How a sound should fit its animation: where it sits left/right (−1…1, or [from, to] to travel), how long. */
export interface SfxOptions {
  pan?: number | [number, number];
  /** Seconds — for sounds that follow a movement (whoosh, slide, grow, shake). */
  dur?: number;
  /** Pitch multiplier (e.g. rising hops: 1, 1.06, 1.12…). */
  pitch?: number;
  /** Loudness multiplier. */
  gain?: number;
}

const state = { effects: false, voice: false };
let actx: AudioContext | null = null;
let master: GainNode | null = null;
let room: ConvolverNode | null = null;

// ---------- sound effects ----------
// Everything is synthesized: physical-sounding shapes (a bell's partials, a metal click, a soft footstep), a
// small shared room echo so the sounds sit in one space, slight random detune so repeats never sound identical,
// and stereo panning that follows the thing moving on screen.

function ctx(): AudioContext | null {
  if (actx) return actx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = 0.55;
  // gentle top-end roll-off keeps synthesized sounds from feeling harsh
  const soften = actx.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 9000;
  master.connect(soften).connect(actx.destination);
  // a small room: a short decaying-noise impulse response, mixed in quietly
  room = actx.createConvolver();
  const len = Math.floor(actx.sampleRate * 1.1);
  const ir = actx.createBuffer(2, len, actx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  room.buffer = ir;
  const wet = actx.createGain();
  wet.gain.value = 0.22;
  room.connect(wet).connect(master);
  return actx;
}

/** Where a voice goes: a panner (fixed or travelling) → dry to master + a little into the room. */
function out(o: SfxOptions, at: number, dur: number, reverb = 1): AudioNode {
  const a = actx!;
  const p = a.createStereoPanner();
  const [p0, p1] = Array.isArray(o.pan) ? o.pan : [o.pan ?? 0, o.pan ?? 0];
  p.pan.setValueAtTime(Math.max(-1, Math.min(1, p0)), at);
  if (p1 !== p0) p.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, p1)), at + dur);
  p.connect(master!);
  if (reverb > 0) {
    const send = a.createGain();
    send.gain.value = reverb;
    p.connect(send).connect(room!);
  }
  return p;
}

const jitter = (k = 0.03) => 1 + (Math.random() * 2 - 1) * k;

/** A sine/triangle partial with an attack and an exponential ring-out. */
function partial(dest: AudioNode, freq: number, at: number, dur: number, gain: number, opts: { type?: OscillatorType; to?: number; attack?: number } = {}) {
  const a = actx!;
  const o = a.createOscillator(), g = a.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + Math.min(dur, 0.25));
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + (opts.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
/** Filtered noise with a shaped envelope (attack fraction, sustain) — air, paper, metal, wood. */
function hiss(dest: AudioNode, at: number, dur: number, gain: number, f: { type: BiquadFilterType; freq: number; to?: number; mid?: number; q?: number }, shape: { attack?: number } = {}) {
  const a = actx!;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 3; } // a softer, pinker noise
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = a.createBiquadFilter();
  filt.type = f.type;
  filt.Q.value = f.q ?? 1;
  filt.frequency.setValueAtTime(f.freq, at);
  if (f.mid) filt.frequency.exponentialRampToValueAtTime(f.mid, at + dur * 0.5);
  if (f.to) filt.frequency.exponentialRampToValueAtTime(f.to, at + dur);
  const g = a.createGain();
  const atk = Math.max(0.002, dur * (shape.attack ?? 0.05));
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filt).connect(g).connect(dest);
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.05);
}

type Recipe = (at: number, o: SfxOptions) => void;
const k = (o: SfxOptions) => (o.pitch ?? 1) * jitter(0.025);
const RECIPES: Record<Sfx, Recipe> = {
  // a water-drop "bloop" as something appears
  pop: (t, o) => { const d = out(o, t, 0.2, 0.6), f = 380 * k(o); partial(d, f, t, 0.16, 0.5 * (o.gain ?? 1), { to: f * 2.6 }); partial(d, f * 2.2, t, 0.05, 0.08); },
  // a soft two-note chime (speech bubble, label)
  blip: (t, o) => { const d = out(o, t, 0.3, 0.8), f = 740 * k(o); partial(d, f, t, 0.22, 0.18, { type: "triangle" }); partial(d, f * 1.335, t + 0.07, 0.3, 0.14, { type: "triangle" }); },
  // a footstep: a soft low tap plus a little scuff
  hop: (t, o) => { const d = out(o, t, 0.15, 0.4), f = 210 * k(o); partial(d, f, t, 0.1, 0.5, { to: f * 0.7 }); hiss(d, t, 0.05, 0.12, { type: "bandpass", freq: 1200 * (o.pitch ?? 1), q: 1.5 }); },
  // a woodblock tick (counting, measuring)
  tick: (t, o) => { const d = out(o, t, 0.08, 0.3); hiss(d, t, 0.03, 0.25 * (o.gain ?? 1), { type: "bandpass", freq: 2400 * k(o), q: 9 }); partial(d, 1850 * k(o), t, 0.035, 0.08); },
  // air rushing past: the band sweeps up then down, and the sound travels with the object
  whoosh: (t, o) => { const dur = o.dur ?? 0.6, d = out(o, t, dur, 0.5); hiss(d, t, dur, 0.28 * (o.gain ?? 1), { type: "bandpass", freq: 320, mid: 1500 * k(o), to: 500, q: 0.8 }, { attack: 0.45 }); },
  // something sliding into place (rows of dots, arrows moving)
  slide: (t, o) => { const dur = o.dur ?? 0.45, d = out(o, t, dur, 0.4); hiss(d, t, dur, 0.16 * (o.gain ?? 1), { type: "lowpass", freq: 700 * k(o), to: 1800, q: 0.7 }, { attack: 0.3 }); },
  // an arrow stretching out: a soft glide up
  grow: (t, o) => { const dur = o.dur ?? 0.8, d = out(o, t, dur, 0.6), f = 260 * k(o); partial(d, f, t, dur, 0.12, { type: "triangle", to: f * 1.9, attack: dur * 0.4 }); partial(d, f * 2, t, dur, 0.04, { to: f * 3.8, attack: dur * 0.4 }); },
  // Eve's copy: a quick camera-shutter "ch-chk"
  snap: (t, o) => { const d = out(o, t, 0.12, 0.3); hiss(d, t, 0.025, 0.35, { type: "highpass", freq: 3500 }); hiss(d, t + 0.045, 0.035, 0.28, { type: "bandpass", freq: 2200, q: 2 }); partial(d, 140, t + 0.045, 0.05, 0.2); },
  // a padlock shackle snapping shut: sharp transient, metallic ring, a low thunk
  click: (t, o) => { const d = out(o, t, 0.3, 0.7); hiss(d, t, 0.012, 0.6, { type: "highpass", freq: 3000 }); [2150, 3420, 5230].forEach((f, i) => partial(d, f * k(o), t, 0.09 - i * 0.02, 0.1 / (i + 1))); partial(d, 150, t, 0.07, 0.35, { to: 90 }); },
  // a key turning: a short scrape, then the latch releasing, then a tiny spring
  unlock: (t, o) => { const d = out(o, t, 0.5, 0.7); hiss(d, t, 0.12, 0.14, { type: "bandpass", freq: 900, to: 2200, q: 3 }, { attack: 0.5 }); hiss(d, t + 0.14, 0.012, 0.45, { type: "highpass", freq: 2800 }); [1800, 2900].forEach((f) => partial(d, f * k(o), t + 0.14, 0.07, 0.08)); partial(d, 620, t + 0.17, 0.14, 0.08, { to: 470 }); },
  // a small bell: inharmonic partials with different ring-outs (arrival, success)
  ding: (t, o) => { const d = out(o, t, 1.4, 1), f = 880 * k(o); [[1, 1.4, 0.2], [2.76, 0.8, 0.07], [5.4, 0.45, 0.035], [8.93, 0.25, 0.015]].forEach(([m, dur, g]) => partial(d, f * m, t, dur, g * (o.gain ?? 1))); },
  // "uh-oh": two soft descending notes, muffled
  nope: (t, o) => { const d = out(o, t, 0.5, 0.5); partial(d, 392 * k(o), t, 0.16, 0.16, { type: "triangle" }); partial(d, 311 * k(o), t + 0.15, 0.3, 0.16, { type: "triangle" }); },
  buzz: (t, o) => { const d = out(o, t, 0.4, 0.3); partial(d, 110 * k(o), t, 0.3, 0.14, { type: "triangle" }); partial(d, 116 * k(o), t, 0.3, 0.1, { type: "triangle" }); },
  // the quantum computer: a rising, shimmering sweep (FM)
  zap: (t, o) => {
    const a = actx!, d = out(o, t, 0.6, 0.9);
    const car = a.createOscillator(), mod = a.createOscillator(), mg = a.createGain(), g = a.createGain();
    car.frequency.setValueAtTime(300, t); car.frequency.exponentialRampToValueAtTime(1500, t + 0.45);
    mod.frequency.setValueAtTime(90, t); mod.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    mg.gain.setValueAtTime(200, t); mg.gain.exponentialRampToValueAtTime(900, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    mod.connect(mg).connect(car.frequency); car.connect(g).connect(d);
    car.start(t); mod.start(t); car.stop(t + 0.6); mod.stop(t + 0.6);
  },
  // a padlock breaking: a heavy thump, a crunch, a bent-metal ring
  crack: (t, o) => { const d = out(o, t, 0.6, 0.8); partial(d, 90, t, 0.25, 0.5, { to: 45 }); hiss(d, t, 0.22, 0.4, { type: "lowpass", freq: 2500, to: 400 }); partial(d, 1370, t + 0.02, 0.35, 0.04); partial(d, 1420, t + 0.02, 0.35, 0.04); },
  // a soft bell arpeggio (a whole grid of dots appearing)
  shimmer: (t, o) => { const d = out(o, t, 1.2, 1); [659, 784, 988, 1319].forEach((f, i) => { partial(d, f * k(o), t + i * 0.09, 0.7, 0.07); partial(d, f * 2.76, t + i * 0.09, 0.3, 0.01); }); },
  // a ball being shaken: a quick rattle
  shake: (t, o) => {
    const dur = o.dur ?? 0.45, d = out(o, t, dur, 0.3);
    for (let i = 0; i * 0.055 < dur; i++) hiss(d, t + i * 0.055, 0.04, 0.12 * (1 - (i * 0.055) / dur), { type: "bandpass", freq: 1600 * jitter(0.2), q: 4 });
  },
  // two arrows trading places: two notes crossing
  swap: (t, o) => { const d = out(o, t, 0.3, 0.5); partial(d, 520 * k(o), t, 0.18, 0.12, { type: "triangle", to: 780 }); partial(d, 780 * k(o), t, 0.18, 0.1, { type: "triangle", to: 520 }); },
  // a score point: a tiny bright bell
  coin: (t, o) => { const d = out(o, t, 0.5, 0.6), f = 1320 * k(o); partial(d, f, t, 0.12, 0.08); partial(d, f * 1.5, t + 0.06, 0.3, 0.08); },
};

/** Play a sound effect (if the visitor has sound effects on), shaped to fit its animation. */
export function sfx(name: Sfx, opts: SfxOptions = {}) {
  if (!state.effects || !ctx() || actx!.state !== "running") return;
  RECIPES[name](actx!.currentTime + 0.005, opts);
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
