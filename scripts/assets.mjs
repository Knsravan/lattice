// Download the real-world textures and models for the 3D town background (option B), on your own computer.
//
//   npm run assets                 # downloads everything that isn't there yet into public/town/
//   npm run assets -- --dry-run    # only show what it would download
//   npm run assets -- --force      # download again, replacing what is there
//   npm run assets -- --only facade,asphalt
//
// Sources (both CC0: free to use, no credit required, but we credit them anyway in public/town/assets.json):
//   ambientCG  (https://ambientcg.com)  photographed building facades, bricks, roof tiles, asphalt, paving, grass, concrete
//   Poly Haven (https://polyhaven.com)  scanned street props and plants
//
// Zero dependencies: Node's own fetch, zlib and fs. The site uses whatever this leaves in public/town/ and
// falls back to the textures it makes in code for anything missing. Commit public/town/ and deploy.
import { mkdir, writeFile, readFile, access, rm } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const only = opt("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const AMBIENTCG = (process.env.AMBIENTCG_URL || "https://ambientcg.com").replace(/\/$/, "");
const POLYHAVEN = (process.env.POLYHAVEN_API || "https://api.polyhaven.com").replace(/\/$/, "");
const OUT = new URL("../public/town/", import.meta.url);

/** Texture slots: what the town needs, the ambientCG search that finds it, and how many different ones to keep. */
const TEXTURES = [
  { slot: "facade", q: "Facade", count: 4 },
  { slot: "bricks", q: "Bricks", count: 1 },
  { slot: "roof", q: "RoofingTiles", count: 1 },
  { slot: "asphalt", q: "Asphalt", count: 1 },
  { slot: "paving", q: "PavingStones", count: 1 },
  { slot: "grass", q: "Grass", count: 1 },
  { slot: "concrete", q: "Concrete", count: 1 },
];
/** Model slots: Poly Haven models whose name, tags or categories match, smallest first. */
const MODELS = [
  { slot: "tree", match: /\btree\b/i, count: 2 },
  { slot: "shrub", match: /\b(shrub|bush)\b/i, count: 1 },
  { slot: "bench", match: /\bbench\b/i, count: 1 },
  { slot: "lamp", match: /\bstreet ?(light|lamp)\b|\blamp ?post\b/i, count: 1 },
  { slot: "hydrant", match: /\bhydrant\b/i, count: 1 },
  { slot: "bin", match: /\b(trash|garbage|rubbish|litter|waste) ?(can|bin)\b/i, count: 1 },
];
const KEEP_MAPS = { Color: "color", NormalGL: "normal", Roughness: "roughness", AmbientOcclusion: "ao" }; // ambientCG map names → ours
const MAX_MODEL_BYTES = 12e6; // skip very heavy scans; the town repeats these many times

const exists = async (u) => { try { await access(u); return true; } catch { return false; } };
async function get(url, kind = "json") {
  let r;
  try { r = await fetch(url, { headers: { "User-Agent": "lattice-site-assets/1.0 (+https://github.com/Knsravan/lattice)" } }); }
  catch (e) { throw new Error(`Can't reach ${new URL(url).host} (${e.cause?.code || e.message}). Are you online?`); }
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return kind === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
}

/** The files inside a .zip (stored or deflated entries), read from its central directory. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("broken zip directory");
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + size);
    if (!name.endsWith("/")) files.set(name, method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Every { attribute, downloadLink } pair anywhere in an ambientCG API answer (its shape nests these deeply). */
function downloadsIn(node, out = []) {
  if (Array.isArray(node)) node.forEach((x) => downloadsIn(x, out));
  else if (node && typeof node === "object") {
    if (typeof node.downloadLink === "string" && typeof node.attribute === "string") out.push(node);
    Object.values(node).forEach((x) => downloadsIn(x, out));
  }
  return out;
}

async function textures(plan, manifest) {
  for (const t of TEXTURES) {
    if (only.length && !only.includes(t.slot)) continue;
    const list = await get(`${AMBIENTCG}/api/v2/full_json?type=Material&q=${encodeURIComponent(t.q)}&limit=${t.count * 3}&sort=Popular&include=downloadData`);
    const ids = (list.foundAssets || []).map((a) => ({ id: a.assetId, dl: downloadsIn(a).find((d) => d.attribute === "1K-JPG") }))
      .filter((a) => a.id && a.id.toLowerCase().startsWith(t.q.toLowerCase())).slice(0, t.count);
    if (!ids.length) { console.log(`  ! ${t.slot}: ambientCG found nothing for "${t.q}"`); continue; }
    for (const [k, a] of ids.entries()) {
      const dir = new URL(`textures/${t.slot}${t.count > 1 ? `-${k + 1}` : ""}/`, OUT), key = dir.pathname.split("/public/town/")[1].replace(/\/$/, "");
      if (!flag("force") && (await exists(new URL("color.jpg", dir)))) { manifest.textures[key] ??= { source: `ambientCG ${a.id}` }; continue; }
      const link = a.dl?.downloadLink || `${AMBIENTCG}/get?file=${a.id}_1K-JPG.zip`;
      plan.push(`${key}  ←  ambientCG ${a.id} (1K)`);
      if (flag("dry-run")) continue;
      const files = unzip(await get(link, "bin"));
      await mkdir(dir, { recursive: true });
      const saved = [];
      for (const [name, data] of files) {
        const m = name.match(/_(Color|NormalGL|Roughness|AmbientOcclusion)\.jpe?g$/i);
        if (m && data) { const ours = KEEP_MAPS[Object.keys(KEEP_MAPS).find((x) => x.toLowerCase() === m[1].toLowerCase())]; await writeFile(new URL(`${ours}.jpg`, dir), data); saved.push(ours); }
      }
      if (!saved.includes("color")) throw new Error(`${a.id}: the zip had no colour map`);
      manifest.textures[key] = { source: `ambientCG ${a.id}`, url: `https://ambientcg.com/view?id=${a.id}`, license: "CC0", maps: saved };
      console.log(`  ✓ ${key}  (${saved.join(", ")})`);
    }
  }
}

async function models(plan, manifest) {
  const all = Object.entries(await get(`${POLYHAVEN}/assets?t=models`));
  for (const m of MODELS) {
    if (only.length && !only.includes(m.slot)) continue;
    const hits = all.filter(([id, a]) => m.match.test([id, a.name, ...(a.tags || []), ...(a.categories || [])].join(" ")));
    if (!hits.length) { console.log(`  ! ${m.slot}: Poly Haven has no model matching ${m.match}`); continue; }
    let kept = 0;
    for (const [id, a] of hits) {
      if (kept >= m.count) break;
      const dir = new URL(`models/${m.slot}-${kept + 1}/`, OUT), key = `${m.slot}-${kept + 1}`;
      if (!flag("force") && (await exists(new URL("model.gltf", dir)))) { kept++; continue; }
      const files = await get(`${POLYHAVEN}/files/${encodeURIComponent(id)}`);
      const g = files?.gltf?.["1k"]?.gltf;
      if (!g?.url) continue;
      const inc = Object.entries(g.include || {});
      const bytes = (g.size || 0) + inc.reduce((s, [, f]) => s + (f.size || 0), 0);
      if (bytes > MAX_MODEL_BYTES) { console.log(`  · skipping ${id} (${(bytes / 1e6).toFixed(1)} MB is too heavy)`); continue; }
      kept++;
      plan.push(`models/${key}  ←  Poly Haven ${id} "${a.name}" (${(bytes / 1e6).toFixed(1)} MB)`);
      if (flag("dry-run")) continue;
      await mkdir(dir, { recursive: true });
      for (const [path, f] of inc) { const to = new URL(path, dir); await mkdir(new URL(".", to), { recursive: true }); await writeFile(to, await get(f.url, "bin")); }
      // the .gltf names its files relative to itself, so it keeps working after the rename to model.gltf
      await writeFile(new URL("model.gltf", dir), await get(g.url, "bin"));
      manifest.models[key] = { source: `Poly Haven ${id}`, name: a.name, url: `https://polyhaven.com/a/${id}`, license: "CC0" };
      console.log(`  ✓ models/${key}  ${a.name}`);
    }
  }
}

async function main() {
  const manifestUrl = new URL("assets.json", OUT);
  let manifest = { textures: {}, models: {} };
  try { manifest = { textures: {}, models: {}, ...JSON.parse(await readFile(manifestUrl, "utf8")) }; } catch { /* first run */ }
  if (flag("force") && !only.length && !flag("dry-run")) { await rm(new URL("textures/", OUT), { recursive: true, force: true }); await rm(new URL("models/", OUT), { recursive: true, force: true }); manifest = { textures: {}, models: {} }; }
  const plan = [];
  console.log("Textures (ambientCG):"); await textures(plan, manifest);
  console.log("Models (Poly Haven):"); await models(plan, manifest);
  if (flag("dry-run")) { console.log(plan.length ? `\nWould download:\n  ${plan.join("\n  ")}` : "\nNothing to download."); return; }
  await mkdir(OUT, { recursive: true });
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + "\n");
  console.log(plan.length ? `\nDone. Commit public/town/ and deploy.` : "\nEverything is already here.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
