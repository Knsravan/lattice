// Tiny static server for local preview (no dependencies): node scripts/serve.mjs  → http://localhost:5173
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = "dist";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".glb": "model/gltf-binary" };
createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = join(root, normalize(p));
  try {
    const body = await readFile(file);
    const type = types[extname(file)] || "application/octet-stream";
    // byte ranges, like GitHub Pages: without them a browser can't jump around inside a video (the footage scrubbing)
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m) {
      const start = m[1] ? +m[1] : Math.max(0, body.length - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
      res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${body.length}` });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(5173, () => console.log("serving dist/ at http://localhost:5173"));
