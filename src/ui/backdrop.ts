import { pointsInBox, identityBasis, mulberry32 } from "../core/index.ts";
import type * as T from "three";
import { el, reducedMotion, palette, clamp } from "./dom.ts";

type Three = typeof import("three");
type V3 = [number, number, number];

/**
 * The 3D backdrop behind the whole page: one cloud of lattice points that changes shape with the story
 * as you scroll, while the camera moves through it.
 *
 *   title    a 3D lattice, slowly shearing          chapter 3  the grid, every dot shaking
 *   ch. 0    a network globe, messages hopping      chapter 4  a full 3D lattice you fly into
 *   ch. 1    a flat grid you fly over               chapter 5  the 97-hour clock, split into its two halves
 *   ch. 2    the same grid, skewed (red arrows)     footer     back to the lattice
 *
 * Every point keeps its identity, so moving between chapters is a morph, not a cut. Purely decorative
 * (aria-hidden, behind the content). Three.js loads from the CDN; if it can't, the promise rejects and the
 * page carries on without it. Under reduced motion the cloud holds still between scrolls.
 */
export async function mountBackdrop(anchors: HTMLElement[]): Promise<() => void> {
  const THREE: Three = await import("three");
  const narrow = () => innerWidth < 820;

  // ---------- the points: a 3D lattice from core, 9 × 9 × 9 (7³ on phones) ----------
  const half = narrow() ? 3 : 4;
  const lattice = pointsInBox(identityBasis(3), [half, half, half]).map((p) => p.point as V3);
  const N = lattice.length;
  const rnd = mulberry32(7);
  const noise = Array.from({ length: N }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1] as V3);
  const phase = Array.from({ length: N }, () => rnd() * Math.PI * 2);
  const cols = Math.ceil(Math.sqrt(N));
  const GAP = 0.8, DEPTH = Math.ceil(N / cols) * GAP;

  // ---------- shapes: position of point i in each chapter, at story time t and scroll flow ----------
  interface Ctx { t: number; flow: number; local: number }
  const floor = (i: number, c: Ctx, shear: number, wobble: number): V3 => {
    const u = (i % cols) - cols / 2, v = Math.floor(i / cols);
    let z = ((v * GAP + c.flow) % DEPTH + DEPTH) % DEPTH - DEPTH / 2; // the grid slides under the camera as you scroll
    let x = u * GAP + shear * z * 0.55;
    let y = -1.6;
    if (wobble) {
      const k = wobble * (0.65 + 0.35 * Math.sin(c.t * 2.1 + phase[i]));
      x += noise[i][0] * k; y += noise[i][1] * k * 0.8; z += noise[i][2] * k;
    }
    return [x, y, z];
  };
  const shapes: ((i: number, c: Ctx) => V3)[] = [
    // 0 title / 7 footer: the lattice, the second arrow swinging so the whole grid shears
    (i, c) => {
      const [a, b, d] = lattice[i], s = 0.55 * Math.sin(c.t * 0.22 + 0.7);
      return [(a + s * b) * 1.5, b * 1.5, d * 1.5];
    },
    // 1 the network: a globe of computers; a few messages hop around it
    (i, c) => {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y);
      const moving = i % 23 === 0;
      const lon = i * 2.39996 + (moving ? c.t * 0.9 : c.t * 0.05);
      const R = 6 + (moving ? 0.25 : 0.12 * Math.sin(c.t + phase[i]));
      return [Math.cos(lon) * r * R, y * R, Math.sin(lon) * r * R];
    },
    // 2 a flat grid, 3 the same grid skewed, 4 the grid with every dot shaking
    (i, c) => floor(i, c, 0, 0),
    (i, c) => floor(i, c, 0.9 + 0.35 * Math.sin(c.t * 0.5), 0),
    (i, c) => floor(i, c, 0, 0.32),
    // 5 the full 3D lattice, turning; the camera flies into it
    (i, c) => {
      const [a, b, d] = lattice[i], ang = c.t * 0.06 + c.local * 1.2;
      const x = a * 1.2, z = d * 1.2, co = Math.cos(ang), si = Math.sin(ang);
      return [x * co - z * si, b * 1.2, x * si + z * co];
    },
    // 6 the 97-hour clock: points on a ring, bunched into 97 hours
    (i, c) => {
      const hour = i % 97, ring = Math.floor(i / 97), rings = Math.ceil(N / 97);
      const a = (hour / 97) * Math.PI * 2 + c.t * 0.04 + c.local * 0.8, b = (ring / rings) * Math.PI * 2;
      const R = 5.4 + 0.8 * Math.cos(b), y = 0.8 * Math.sin(b);
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      return [x, y * 0.9 + z * 0.35, z * 0.9 - y * 0.35]; // tilted towards the camera
    },
  ];
  const SHAPE_OF_ANCHOR = [0, 1, 2, 3, 4, 5, 6, 0]; // title, chapters 0–5, footer

  // ---------- colours per shape (static), mixed with the same morph ----------
  const hex = (h: string): V3 => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as V3;
  const C = { dot: hex(palette.dot), bright: hex(palette.dotBright), ball: hex(palette.ball), secret: hex(palette.secret), attacker: hex(palette.attacker) };
  const colorOf: ((i: number) => V3)[] = [
    (i) => (i % 29 === 0 ? C.secret : C.bright),
    (i) => (i % 23 === 0 ? C.ball : i % 61 === 0 ? C.attacker : C.dot),
    (i) => (i % cols === Math.floor(cols / 2) || Math.floor(i / cols) % 8 === 0 ? C.secret : C.bright),
    (i) => (i % cols === Math.floor(cols / 2) || Math.floor(i / cols) % 8 === 0 ? C.attacker : C.bright),
    (i) => (i % 17 === 0 ? C.ball : C.bright),
    (i) => (i % 31 === 0 ? C.attacker : i % 13 === 0 ? C.secret : C.bright),
    (i) => { const h = i % 97; return h < 25 || h > 72 ? C.secret : C.ball; },
  ];
  const colors = colorOf.map((f) => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) a.set(f(i), i * 3); return a; });

  // ---------- Three.js scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  const canvas = renderer.domElement;
  canvas.className = "backdrop";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.bg, 8, 30);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const posAttr = new THREE.BufferAttribute(pos, 3), colAttr = new THREE.BufferAttribute(col, 3);
  const geo = new THREE.BufferGeometry().setAttribute("position", posAttr).setAttribute("color", colAttr);
  const sprite = new THREE.CanvasTexture(disc());
  const mat = new THREE.PointsMaterial({
    size: 0.2, sizeAttenuation: true, vertexColors: true, map: sprite, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geo, mat));

  // ---------- camera per shape: distance, height, where it looks, sideways shift (title only, wide screens) ----------
  // (yaw: the lattice shapes look best seen nearly along an axis, where the dots line up into rows)
  const CAM: { dist: number; height: number; lookY: number; yaw: number }[] = [
    { dist: 15, height: 1.6, lookY: 0, yaw: 0.22 }, { dist: 15, height: 2, lookY: 0, yaw: 0.6 },
    { dist: 9, height: 4.2, lookY: -1.6, yaw: 0.35 }, { dist: 9, height: 4.2, lookY: -1.6, yaw: 0.35 },
    { dist: 8.5, height: 3.6, lookY: -1.6, yaw: 0.35 }, { dist: 16, height: 2.5, lookY: 0, yaw: 0.2 },
    { dist: 13, height: 5.5, lookY: 0, yaw: 0.6 },
  ];

  // ---------- scroll → story position ----------
  let tops: number[] = [];
  const measure = () => { tops = anchors.map((a) => a.getBoundingClientRect().top + scrollY); };
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  measure();
  /** s = anchor index + morph fraction; the morph happens in the screen-height around each chapter's start. */
  const stageAt = (y: number) => {
    let s = 0;
    for (let b = 1; b < tops.length; b++) s += smooth((y - (tops[b] - 0.3 * innerHeight)) / (0.75 * innerHeight));
    return s;
  };
  const localAt = (k: number, y: number) =>
    k + 1 < tops.length ? clamp((y - tops[k]) / Math.max(1, tops[k + 1] - tops[k]), 0, 1) : 0;

  let pointer = [0, 0], ptr = [0, 0];
  const onMove = (e: PointerEvent) => { pointer = [e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5]; };
  addEventListener("pointermove", onMove, { passive: true });

  let raf = 0, last = 0, t = 0, lastKey = "";
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const still = reducedMotion();
    if (!still) t += dt;
    const y = scrollY + innerHeight / 2;
    const w = innerWidth, h = innerHeight;
    const key = `${scrollY}|${w}|${h}`;
    if (still && key === lastKey) return; // nothing moves on its own: draw only when the page moves
    lastKey = key;

    const s = stageAt(y);
    const k = Math.min(Math.floor(s), anchors.length - 1), f = s - k;
    const from = SHAPE_OF_ANCHOR[k], to = SHAPE_OF_ANCHOR[Math.min(k + 1, anchors.length - 1)];
    const ctx: Ctx = { t, flow: scrollY * 0.006 + t * 0.25, local: localAt(k, y) };
    const ctxTo: Ctx = { ...ctx, local: localAt(k + 1, y) };
    const e = smooth(f);
    for (let i = 0; i < N; i++) {
      const a = shapes[from](i, ctx), b = f > 0.001 ? shapes[to](i, ctxTo) : a;
      pos[i * 3] = a[0] + (b[0] - a[0]) * e; pos[i * 3 + 1] = a[1] + (b[1] - a[1]) * e; pos[i * 3 + 2] = a[2] + (b[2] - a[2]) * e;
    }
    const ca = colors[from], cb = colors[to];
    for (let j = 0; j < N * 3; j++) col[j] = ca[j] + (cb[j] - ca[j]) * e;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    // camera: orbits as you scroll, eases toward each chapter's view, leans a little with the mouse
    const P = CAM[from], Q = CAM[to];
    const lerp = (p: number, q: number) => p + (q - p) * e;
    let dist = lerp(P.dist, Q.dist);
    if (from === 5) dist -= 9 * ctx.local * (1 - e); // chapter 4: fly into the lattice
    const height = lerp(P.height, Q.height), lookY = lerp(P.lookY, Q.lookY);
    ptr = still ? [0, 0] : [ptr[0] + (pointer[0] - ptr[0]) * 0.04, ptr[1] + (pointer[1] - ptr[1]) * 0.04];
    const theta = lerp(P.yaw, Q.yaw) + (still ? 0 : Math.sin(scrollY * 0.0004) * 0.35 + Math.sin(t * 0.05) * 0.12) + ptr[0] * 0.25;
    const side = w >= 820 ? -5.5 * (1 - Math.min(1, s)) : 0; // on the title, the lattice sits right of the heading
    camera.position.set(Math.sin(theta) * dist + side, height - ptr[1] * 1.2, Math.cos(theta) * dist);
    camera.lookAt(side, lookY, 0);
    if (camera.aspect !== w / h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add("on")); // fade in

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener("pointermove", onMove);
    geo.dispose(); mat.dispose(); sprite.dispose(); renderer.dispose();
    canvas.remove();
  };
}

/** A soft round dot, used as each point's sprite. */
function disc(): HTMLCanvasElement {
  const c = el("canvas", { width: 64, height: 64 });
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const smooth = (x: number) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
