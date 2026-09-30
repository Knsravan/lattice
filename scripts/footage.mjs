// Real video footage for the page background: one clip per chapter, a day and a night version, scrubbed by scroll.
// Run on your own computer (needs internet, a free Pexels API key and ffmpeg):
//
//   set PEXELS_API_KEY=your-key          (Windows)     export PEXELS_API_KEY=your-key   (macOS/Linux)
//   npm run footage                       # search, download and prepare every clip that isn't there yet
//   npm run footage -- --dry-run          # only show which clips it would use
//   npm run footage -- --pick grid-day=1234567   # use a different Pexels video (id from footage-candidates.html)
//   npm run footage -- --only grid --force       # redo one chapter's clips
//
// Every run also writes footage-candidates.html (not committed): thumbnails of the best matches for each slot,
// with the id to pass to --pick. Clips come from Pexels (https://www.pexels.com/license/: free to use, no
// attribution required; credited anyway in public/footage/manifest.json and the page footer).
//
// ffmpeg prepares each clip for scrubbing: at most 10 s, no sound, 1280 px wide, 24 fps, and a keyframe every
// 6 frames so the browser can jump to any moment instantly as you scroll. Zero dependencies otherwise.
import { mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Slots: which chapter, and what to search Pexels for, by day and at night. */
const SLOTS = [
  { slot: "title", day: "city aerial view skyline", night: "city aerial night lights" },
  { slot: "problem", day: "person texting smartphone street", night: "texting on phone at night city" },
  { slot: "grid", day: "aerial top down city streets grid", night: "aerial top down city night streets" },
  { slot: "routes", day: "aerial traffic intersection city", night: "night traffic intersection aerial" },
  { slot: "shake", day: "rain city street", night: "rain city street night" },
  { slot: "dimensions", day: "construction site crane building", night: "construction crane night" },
  { slot: "clock", day: "clock tower city", night: "clock tower night" },
];
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const only = opt("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const picks = Object.fromEntries(args.flatMap((a, i) => (a === "--pick" && args[i + 1] ? [args[i + 1].split("=")] : [])));
const KEY = opt("key", process.env.PEXELS_API_KEY || "");
const API = (process.env.PEXELS_API || "https://api.pexels.com").replace(/\/$/, "");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT = new URL("../public/footage/", import.meta.url), TMP = new URL("../footage-tmp/", import.meta.url);
const CANDIDATES = new URL("../footage-candidates.html", import.meta.url);
const exists = async (u) => { try { await access(u); return true; } catch { return false; } };

async function get(url, kind = "json") {
  let r;
  try { r = await fetch(url, { headers: { Authorization: KEY, "User-Agent": "lattice-site-footage/1.0" } }); }
  catch (e) { throw new Error(`Can't reach ${new URL(url).host} (${e.cause?.code || e.message}). Are you online?`); }
  if (r.status === 401 || r.status === 403) throw new Error("Pexels refused the API key. Check PEXELS_API_KEY (free at https://www.pexels.com/api/).");
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return kind === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
}

/** The best file of a Pexels video for us: landscape, closest to 1280–1920 px wide, mp4. */
const bestFile = (v) => (v.video_files || [])
  .filter((f) => f.file_type === "video/mp4" && f.width >= f.height && f.width >= 960)
  .sort((a, b) => Math.abs(a.width - 1600) - Math.abs(b.width - 1600))[0];

async function search(q) {
  const r = await get(`${API}/videos/search?query=${encodeURIComponent(q)}&orientation=landscape&size=medium&per_page=12`);
  return (r.videos || []).filter((v) => v.duration >= 5 && bestFile(v));
}

function prepare(input, output) {
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-i", fileURLToPath(input), "-t", "10", "-an",
    "-vf", "scale=1280:-2,fps=24", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", fileURLToPath(output)], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.error) throw new Error(`ffmpeg didn't start (${r.error.code}). Is it installed? (Windows: winget install Gyan.FFmpeg)`);
  if (r.status !== 0) throw new Error(`ffmpeg couldn't prepare ${fileURLToPath(output)}`);
  // a still of the first frame, shown while the clip loads and when the visitor asks for less motion
  spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-i", fileURLToPath(output), "-frames:v", "1", "-q:v", "4", fileURLToPath(output).replace(/\.mp4$/, ".jpg")]);
}

async function main() {
  if (!KEY) throw new Error("Set PEXELS_API_KEY first (free at https://www.pexels.com/api/). Windows: set PEXELS_API_KEY=your-key");
  if (!flag("dry-run") && spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status !== 0) throw new Error("ffmpeg isn't installed. Windows: winget install Gyan.FFmpeg, then open a new window.");
  let manifest = {};
  try { manifest = JSON.parse(await readFile(new URL("manifest.json", OUT), "utf8")); } catch { /* first run */ }
  const sheet = [];
  await mkdir(OUT, { recursive: true }); await mkdir(TMP, { recursive: true });
  for (const s of SLOTS) {
    if (only.length && !only.includes(s.slot)) continue;
    for (const time of ["day", "night"]) {
      const key = `${s.slot}-${time}`, file = `${key}.mp4`;
      const found = await search(s[time]);
      sheet.push({ key, q: s[time], found });
      const want = picks[key] ? Number(picks[key]) : null;
      const v = want ? (found.find((x) => x.id === want) ?? (await get(`${API}/videos/videos/${want}`))) : found[0];
      if (!v) { console.log(`  ! ${key}: nothing found for "${s[time]}"`); continue; }
      if (!want && !flag("force") && manifest[key] && (await exists(new URL(file, OUT)))) { console.log(`  = ${key}  (already here: Pexels ${manifest[key].id})`); continue; }
      console.log(`  ${flag("dry-run") ? "would use" : "↓"} ${key}  ←  Pexels ${v.id} by ${v.user?.name ?? "?"} (${v.duration}s)`);
      if (flag("dry-run")) continue;
      const raw = new URL(`${key}-raw.mp4`, TMP);
      await writeFile(raw, await get(bestFile(v).link, "bin"));
      prepare(raw, new URL(file, OUT));
      await rm(raw, { force: true });
      manifest[key] = { file, poster: `${key}.jpg`, id: v.id, url: v.url, author: v.user?.name, authorUrl: v.user?.url, license: "Pexels License" };
      await writeFile(new URL("manifest.json", OUT), JSON.stringify(manifest, null, 2) + "\n"); // after each clip, so a stop keeps progress
      console.log(`  ✓ ${file}`);
    }
  }
  await rm(TMP, { recursive: true, force: true });
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await writeFile(CANDIDATES, `<!doctype html><meta charset="utf-8"><title>Footage candidates</title>
<style>body{font:15px system-ui;margin:24px;background:#111;color:#eee}h2{margin:28px 0 8px}.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:240px}img{width:240px;border-radius:6px}figcaption{font-size:12px;color:#aaa}code{color:#9ad}</style>
<h1>Footage candidates</h1><p>The first clip in each row is used unless you pick another: <code>npm run footage -- --pick grid-day=ID</code></p>
${sheet.map((r) => `<h2>${esc(r.key)} <small style="color:#888">“${esc(r.q)}”</small></h2><div class="row">${r.found.map((v, i) => `<figure><a href="${esc(v.url)}" target="_blank"><img src="${esc(v.image)}" alt=""></a><figcaption>${i === 0 ? "★ default · " : ""}id <code>${v.id}</code> · ${v.duration}s · ${esc(v.user?.name ?? "")}</figcaption></figure>`).join("")}</div>`).join("\n")}`);
  console.log(`\n${flag("dry-run") ? "" : "Done. Commit public/footage/ and deploy. "}See footage-candidates.html to swap any clip.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
