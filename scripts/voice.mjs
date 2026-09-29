// Record the narration for every scroll-story step with VoiceStudio (https://github.com/debpalash/VoiceStudio).
//
//   1. Open VoiceStudio on your computer (its backend listens on http://localhost:3900).
//   2. npm run voice                     # records every step that is new or whose words changed
//      npm run voice -- --list           # show the voices VoiceStudio has
//      npm run voice -- --voice <id>     # use one of them (default: VoiceStudio's default voice)
//      npm run voice -- --force          # re-record everything
//      npm run voice -- --dry-run        # just show what would be recorded
//      npm run voice -- --samples        # the same sentence in several voices → voice-samples/index.html, to pick one
//      npm run voice -- --design "female, young adult, british accent" --seed 7   # record with a designed voice
//      npm run voice -- --url http://host:port --format wav --out /some/folder
//   3. Commit public/voice/ — the site plays these files; visitors never talk to VoiceStudio.
//
// Zero dependencies. The words come straight from src/ui/copy.ts, so the voice always says what the page shows;
// the manifest stores each clip's text, and the page skips any clip whose text no longer matches.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chapter0, chapter1, chapter2, chapter3, chapter4, chapter5 } from "../src/ui/copy.ts";

const STORIES = { c0: chapter0.steps, c1: chapter1.steps, c2: chapter2.steps, c3: chapter3.steps, c4: chapter4.steps, c5: chapter5.steps };

/** Voices for --samples: VoiceStudio's default, plus voices designed from OmniVoice's tags (gender, age, pitch, accent). */
const SAMPLES = [
  { id: "default", label: "VoiceStudio default voice" },
  { id: "f-us", label: "Woman, young, American", design: "female, young adult, moderate pitch, american accent" },
  { id: "f-uk", label: "Woman, middle-aged, British, lower", design: "female, middle-aged, low pitch, british accent" },
  { id: "f-in", label: "Woman, young, Indian", design: "female, young adult, moderate pitch, indian accent" },
  { id: "f-au", label: "Woman, young, Australian, brighter", design: "female, young adult, high pitch, australian accent" },
  { id: "m-us", label: "Man, young, American", design: "male, young adult, moderate pitch, american accent" },
  { id: "m-uk", label: "Man, middle-aged, British, deep", design: "male, middle-aged, low pitch, british accent" },
  { id: "m-in", label: "Man, young, Indian", design: "male, young adult, moderate pitch, indian accent" },
  { id: "m-teen", label: "Teenage boy, American", design: "male, teenager, moderate pitch, american accent" },
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const base = opt("url", process.env.VOICESTUDIO_URL || "http://localhost:3900").replace(/\/$/, "");
const voice = opt("voice", process.env.VOICESTUDIO_VOICE || "default");
const design = opt("design", process.env.VOICESTUDIO_DESIGN || "");
const seed = Number(opt("seed", process.env.VOICESTUDIO_SEED || "7"));
const format = opt("format", "mp3");
const dirUrl = (p) => pathToFileURL(resolve(p) + "/"); // works with Windows paths too
const OUT = opt("out", "") ? dirUrl(opt("out", "")) : new URL("../public/voice/", import.meta.url);
const SAMPLES_OUT = new URL("../voice-samples/", import.meta.url);

async function api(path, init) {
  let r;
  try {
    r = await fetch(base + path, init);
  } catch (e) {
    throw new Error(`Can't reach VoiceStudio at ${base} (${e.cause?.code || e.message}). Is the app open?`);
  }
  return r;
}

const looksLikeAudio = (buf, fmt) => {
  if (buf.length < 1000) return false;
  const head = buf.subarray(0, 4).toString("latin1");
  if (fmt === "wav") return head === "RIFF";
  if (fmt === "mp3") return head.startsWith("ID3") || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
  return true;
};

/** One clip from VoiceStudio. A designed voice uses a fixed seed so it stays the same person in every clip. */
async function speak(text, key, v = { voice, design }) {
  const body = { model: "tts-1", voice: v.voice || "default", input: text, response_format: format, seed };
  if (v.design) body.instruct = v.design;
  const r = await api("/v1/audio/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok) throw new Error(`${key}: VoiceStudio answered ${r.status}: ${buf.toString("utf8").slice(0, 300)}`);
  if (!looksLikeAudio(buf, format)) throw new Error(`${key}: the reply isn't ${format} audio (${buf.length} bytes). Nothing was saved for this step.`);
  return buf;
}

/** --samples: Chapter 0's first two steps in every SAMPLES voice, plus a page to listen and compare. */
async function samples() {
  const text = `${chapter0.steps[0]} ${chapter0.steps[1]}`;
  await mkdir(SAMPLES_OUT, { recursive: true });
  const done = [];
  for (const s of SAMPLES) {
    const t0 = Date.now();
    process.stdout.write(`  ${s.label} … `);
    try {
      const buf = await speak(text, s.id, { voice: "default", design: s.design });
      await writeFile(new URL(`${s.id}.${format}`, SAMPLES_OUT), buf);
      done.push(s);
      console.log(`✓ (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }
  const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = done.map((s) => `<li><b>${esc(s.label)}</b><br><audio controls preload="none" src="${s.id}.${format}"></audio><br>
<code>npm run voice -- --force${s.design ? ` --design "${s.design}" --seed ${seed}` : ""}</code></li>`).join("\n");
  await writeFile(new URL("index.html", SAMPLES_OUT), `<!doctype html><meta charset="utf-8"><title>Voice samples</title>
<style>body{font:16px system-ui;background:#0b0d12;color:#e8eaf0;max-width:720px;margin:32px auto;padding:0 16px}li{margin:0 0 22px}audio{margin:8px 0;width:100%}code{color:#9ad;font-size:13px}</style>
<h1>Pick a voice</h1><p>“${esc(text)}”</p><p>Each command below records all ${Object.values(STORIES).flat().length} story steps in that voice.</p><ol>${rows}</ol>`);
  console.log(`\n${done.length} of ${SAMPLES.length} voices recorded. Open voice-samples/index.html to listen.`);
}

async function main() {
  if (flag("samples")) {
    const health = await api("/health");
    if (!health.ok) throw new Error(`VoiceStudio at ${base} answered ${health.status} on /health.`);
    return samples();
  }
  const jobs = Object.entries(STORIES).flatMap(([id, steps]) => steps.map((text, i) => ({ key: `${id}-s${i}`, text })));
  let manifest = {};
  try { manifest = JSON.parse(await readFile(new URL("manifest.json", OUT), "utf8")); } catch { /* first run */ }
  const exists = async (f) => { try { await access(new URL(f, OUT)); return true; } catch { return false; } };

  const todo = [];
  for (const j of jobs) {
    const have = manifest[j.key];
    if (!flag("force") && have && have.text === j.text && (await exists(have.file))) continue;
    todo.push(j);
  }
  console.log(`${jobs.length} steps, ${todo.length} to record${todo.length ? ":" : "."}`);
  for (const j of todo) console.log(`  ${j.key}  ${j.text.slice(0, 70)}${j.text.length > 70 ? "…" : ""}`);
  if (flag("dry-run") || (!todo.length && !flag("list"))) return;

  const health = await api("/health");
  if (!health.ok) throw new Error(`VoiceStudio at ${base} answered ${health.status} on /health.`);
  if (flag("list")) {
    const r = await api("/v1/audio/voices");
    console.log(r.ok ? JSON.stringify(await r.json(), null, 2) : `Couldn't list voices (${r.status}).`);
    return;
  }

  await mkdir(OUT, { recursive: true });
  for (const j of todo) {
    const buf = await speak(j.text, j.key);
    const file = `${j.key}.${format}`;
    await writeFile(new URL(file, OUT), buf);
    manifest[j.key] = { file, text: j.text };
    await writeFile(new URL("manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n"); // after each clip, so a stop keeps progress
    console.log(`  ✓ ${file}  (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`Done. Commit public/voice/ and deploy.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
