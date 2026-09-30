// Record the narration for every scroll-story step with Voicebox (https://github.com/jamiepine/voicebox).
//
//   1. Open Voicebox on your computer (its server listens on http://127.0.0.1:17493).
//   2. npm run voice                     # records every step that is new or whose words changed, in "BNP Brand Voice"
//      npm run voice -- --list           # show your Voicebox voice profiles
//      npm run voice -- --voice "<name or id>"   # use another profile
//      npm run voice -- --only c0-s0     # record just one step (or a few: c0-s0,c2-s4)
//      npm run voice -- --force          # re-record everything
//      npm run voice -- --dry-run        # just show what would be recorded
//      npm run voice -- --url http://host:port --out /some/folder
//   3. Commit public/voice/ — the site plays these files; visitors never talk to Voicebox.
//
// Zero dependencies. The words come straight from src/ui/copy.ts, so the voice always says what the page shows;
// the manifest stores each clip's text, and the page skips any clip whose text no longer matches.
// Voicebox makes WAV; if ffmpeg is on this computer, each clip is also squeezed to a small MP3 for the website.
import { mkdir, readFile, writeFile, access, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chapter0, chapter1, chapter2, chapter3, chapter4, chapter5 } from "../src/ui/copy.ts";

const STORIES = { c0: chapter0.steps, c1: chapter1.steps, c2: chapter2.steps, c3: chapter3.steps, c4: chapter4.steps, c5: chapter5.steps };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const base = opt("url", process.env.VOICEBOX_URL || "http://127.0.0.1:17493").replace(/\/$/, "");
const voiceName = opt("voice", process.env.VOICEBOX_VOICE || "BNP Brand Voice");
const only = opt("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const OUT = opt("out", "") ? pathToFileURL(resolve(opt("out", "")) + "/") : new URL("../public/voice/", import.meta.url);
const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

async function api(path, init) {
  try {
    return await fetch(base + path, init);
  } catch (e) {
    throw new Error(`Can't reach Voicebox at ${base} (${e.cause?.code || e.message}). Is the app open?`);
  }
}
async function json(path, init) {
  const r = await api(path, init);
  const text = await r.text();
  if (!r.ok) throw new Error(`Voicebox answered ${r.status} on ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** The voice profile to use: matched by name (any case) or id. */
async function findProfile() {
  const all = await json("/profiles");
  const want = voiceName.toLowerCase();
  const p = all.find((x) => x.id === voiceName || x.name.toLowerCase() === want)
    ?? all.find((x) => x.name.toLowerCase().includes(want));
  if (!p) throw new Error(`No Voicebox profile called "${voiceName}". Yours: ${all.map((x) => `"${x.name}"`).join(", ") || "(none)"}.`);
  return p;
}

/** One clip: ask Voicebox to generate, wait until it's done, download the WAV. */
async function speak(profile, text, key) {
  const engine = profile.default_engine || profile.preset_engine || undefined; // let a preset/designed voice use its own engine
  const gen = await json("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profile.id, text, language: "en", seed: 7, ...(engine ? { engine } : {}) }),
  });
  // /generate/{id}/status is a stream of "data: {...}" lines that ends when the clip is completed or failed
  let status = gen.status, error = gen.error;
  while (status !== "completed" && status !== "failed") {
    const r = await api(`/generate/${gen.id}/status`);
    const lines = (await r.text()).split("\n").filter((l) => l.startsWith("data: "));
    const last = lines.length ? JSON.parse(lines[lines.length - 1].slice(6)) : { status: "failed", error: "no status" };
    ({ status, error } = last);
    if (status === "not_found") throw new Error(`${key}: Voicebox lost the job.`);
  }
  if (status === "failed") throw new Error(`${key}: Voicebox couldn't make this clip: ${error || "unknown error"}`);
  const r = await api(`/audio/${gen.id}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok || buf.length < 1000 || buf.subarray(0, 4).toString("latin1") !== "RIFF") {
    throw new Error(`${key}: the reply isn't WAV audio (${r.status}, ${buf.length} bytes). Nothing was saved for this step.`);
  }
  return buf;
}

/** Save a clip: MP3 when ffmpeg is here (about 10× smaller), otherwise the WAV as it came. */
async function save(key, wav) {
  const wavUrl = new URL(`${key}.wav`, OUT);
  await writeFile(wavUrl, wav);
  if (!hasFfmpeg) return `${key}.wav`;
  const mp3Url = new URL(`${key}.mp3`, OUT);
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", fileURLToPath(wavUrl), "-ac", "1", "-b:a", "64k", fileURLToPath(mp3Url)]);
  if (r.status !== 0) return `${key}.wav`;
  await unlink(wavUrl);
  return `${key}.mp3`;
}

async function main() {
  const jobs = Object.entries(STORIES).flatMap(([id, steps]) => steps.map((text, i) => ({ key: `${id}-s${i}`, text })));
  let manifest = {};
  try { manifest = JSON.parse(await readFile(new URL("manifest.json", OUT), "utf8")); } catch { /* first run */ }
  const exists = async (f) => { try { await access(new URL(f, OUT)); return true; } catch { return false; } };

  if (flag("list")) {
    const all = await json("/profiles");
    for (const p of all) console.log(`  ${p.name}   (id ${p.id}${p.default_engine || p.preset_engine ? `, ${p.default_engine || p.preset_engine}` : ""})`);
    return;
  }

  const todo = [];
  for (const j of jobs) {
    if (only.length && !only.includes(j.key)) continue;
    const have = manifest[j.key];
    if (!only.length && !flag("force") && have && have.text === j.text && (await exists(have.file))) continue;
    todo.push(j);
  }
  console.log(`${jobs.length} steps, ${todo.length} to record${todo.length ? ":" : "."}`);
  for (const j of todo) console.log(`  ${j.key}  ${j.text.slice(0, 70)}${j.text.length > 70 ? "…" : ""}`);
  if (flag("dry-run") || !todo.length) return;

  const profile = await findProfile();
  console.log(`\nVoice: ${profile.name}${hasFfmpeg ? "" : "  (ffmpeg not found: saving WAV files)"}\n`);
  await mkdir(OUT, { recursive: true });
  for (const j of todo) {
    const t0 = Date.now();
    const file = await save(j.key, await speak(profile, j.text, j.key));
    const old = manifest[j.key]?.file;
    if (old && old !== file) await unlink(new URL(old, OUT)).catch(() => {});
    manifest[j.key] = { file, text: j.text };
    await writeFile(new URL("manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n"); // after each clip, so a stop keeps progress
    console.log(`  ✓ ${file}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  console.log(`Done. Commit public/voice/ and deploy.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
