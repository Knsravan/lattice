// Record the narration for every scroll-story step with VoiceStudio (https://github.com/debpalash/VoiceStudio).
//
//   1. Open VoiceStudio on your computer (its backend listens on http://localhost:3900).
//   2. npm run voice                     # records every step that is new or whose words changed
//      npm run voice -- --list           # show the voices VoiceStudio has
//      npm run voice -- --voice <id>     # use one of them (default: VoiceStudio's default voice)
//      npm run voice -- --force          # re-record everything
//      npm run voice -- --dry-run        # just show what would be recorded
//      npm run voice -- --url http://host:port --format wav --out /some/folder
//   3. Commit public/voice/ — the site plays these files; visitors never talk to VoiceStudio.
//
// Zero dependencies. The words come straight from src/ui/copy.ts, so the voice always says what the page shows;
// the manifest stores each clip's text, and the page skips any clip whose text no longer matches.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { chapter0, chapter1, chapter2, chapter3, chapter4, chapter5 } from "../src/ui/copy.ts";

const STORIES = { c0: chapter0.steps, c1: chapter1.steps, c2: chapter2.steps, c3: chapter3.steps, c4: chapter4.steps, c5: chapter5.steps };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const base = opt("url", process.env.VOICESTUDIO_URL || "http://localhost:3900").replace(/\/$/, "");
const voice = opt("voice", process.env.VOICESTUDIO_VOICE || "alloy");
const format = opt("format", "mp3");
const OUT = opt("out", "") ? new URL(`file://${opt("out", "").replace(/\/?$/, "/")}`) : new URL("../public/voice/", import.meta.url);

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

async function main() {
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
    const r = await api("/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice, input: j.text, response_format: format }),
    });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok) throw new Error(`${j.key}: VoiceStudio answered ${r.status}: ${buf.toString("utf8").slice(0, 300)}`);
    if (!looksLikeAudio(buf, format)) throw new Error(`${j.key}: the reply isn't ${format} audio (${buf.length} bytes). Nothing was saved for this step.`);
    const file = `${j.key}.${format}`;
    await writeFile(new URL(file, OUT), buf);
    manifest[j.key] = { file, text: j.text };
    await writeFile(new URL("manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n"); // after each clip, so a stop keeps progress
    console.log(`  ✓ ${file}  (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`Done. Commit public/voice/ and deploy.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
