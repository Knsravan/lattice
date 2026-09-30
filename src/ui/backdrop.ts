import { reducedMotion, palette, clamp } from "./dom.ts";

type Three = typeof import("three");
type V3 = [number, number, number];

/**
 * The 3D backdrop behind the whole page: soft ribbons of light that flow in 3D and change with the story as you scroll.
 * Deliberately no dots — dots belong to the diagrams, which carry the explanation; the backdrop is only mood.
 *
 *   title    calm blue waves                          chapter 3  the bands shiver (the shake)
 *   ch. 0    amber arcs travelling, one red (Eve)     chapter 4  a spiral tunnel the camera flies into
 *   ch. 1    calm, orderly parallel bands             chapter 5  a ring, half green, half amber (the clock split)
 *   ch. 2    neat green bands, crossed by skewed red  footer     calm waves again
 *
 * Each ribbon keeps its identity, so moving between chapters is a morph, not a cut. Purely decorative
 * (aria-hidden, behind the content). Three.js loads from the CDN; if it can't, the promise rejects and the
 * page carries on without it. Under reduced motion the ribbons hold still between scrolls.
 */
const RIBBONS = 6;
const SEGS = 150; // points along each ribbon

export async function mountBackdrop(anchors: HTMLElement[]): Promise<() => void> {
  const THREE: Three = await import("three");

  // ---------- each chapter's ribbons: centre line, width, colour along the ribbon ----------
  const hex = (h: string): V3 => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as V3;
  const C = {
    calm: hex("#7f95d6"), bright: hex(palette.dotBright), ball: hex(palette.ball), secret: hex(palette.secret),
    attacker: hex(palette.attacker), violet: hex("#8a7cff"),
  };
  const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  interface Look { at(r: number, u: number, t: number, local: number): V3; width: number; color(r: number, u: number): V3; flow: number }
  const off = (r: number) => r - (RIBBONS - 1) / 2; // −2.5 … 2.5
  const looks: Look[] = [
    { // title, footer: calm waves
      at: (r, u, t) => [(u - 0.5) * 34, off(r) * 0.8 + Math.sin(u * 4 + t * 0.25 + r) * 1.3, Math.cos(u * 3 + t * 0.18 + r * 0.7) * 2.5 - 2],
      width: 1.1, color: (r, u) => mix(C.calm, C.violet, 0.5 + 0.5 * Math.sin(u * 3 + r)), flow: 0.6,
    },
    { // ch. 0: messages travelling in arcs from one side to the other; one red ribbon is Eve listening in
      at: (r, u, t) => [(u - 0.5) * 28, Math.sin(u * Math.PI) * (2.5 + r * 0.7) - 3.2, off(r) * 1.6 + Math.sin(t * 0.4 + r) * 0.4],
      width: 0.8, color: (r, u) => (r === 4 ? C.attacker : mix(C.ball, C.bright, 0.35 + 0.3 * Math.sin(u * 5 + r))), flow: 2.2,
    },
    { // ch. 1: calm, orderly, evenly spaced bands
      at: (r, u, t) => [(u - 0.5) * 34, -2.2 + Math.sin(u * 2 + t * 0.2 + r * 0.5) * 0.25, off(r) * 2.3],
      width: 0.9, color: (r) => (r % 2 ? C.secret : C.bright), flow: 0.8,
    },
    { // ch. 2: the green bands stay neat; the red ones are skewed across them
      at: (r, u, t) => [(u - 0.5) * 34, -2.2 + Math.sin(u * 2 + t * 0.2 + r * 0.5) * 0.25, off(r) * 2.3 + (r % 2 ? 0 : (u - 0.5) * 13)],
      width: 0.9, color: (r) => (r % 2 ? C.secret : C.attacker), flow: 0.8,
    },
    { // ch. 3: the bands shiver
      at: (r, u, t) => [(u - 0.5) * 34, -2.2 + Math.sin(u * 23 + t * 5 + r) * 0.35 + Math.sin(u * 41 - t * 3.3 + r * 2) * 0.18, off(r) * 2.3 + Math.sin(u * 17 + t * 4 + r) * 0.25],
      width: 0.75, color: (r, u) => mix(C.ball, C.bright, 0.3 + 0.3 * Math.sin(u * 7 + r)), flow: 1.6,
    },
    { // ch. 4: a spiral tunnel into the distance — many directions; the camera flies into it
      at: (r, u, t, local) => {
        const a = u * Math.PI * 5 + (r / RIBBONS) * Math.PI * 2 + t * 0.25 + local * 2;
        return [Math.cos(a) * 3.6, Math.sin(a) * 3.6, (0.5 - u) * 44];
      },
      width: 0.6, color: (r) => [C.secret, C.bright, C.attacker, C.violet, C.ball, C.calm][r], flow: 1.4,
    },
    { // ch. 5: the 97-hour clock — a ring, green near 0, amber around the half (how Sam reads the numbers)
      at: (r, u, t, local) => {
        const a = u * Math.PI * 2 + t * 0.06 + local * 1.2, R = 6 + off(r) * 0.32;
        return [Math.cos(a) * R, off(r) * 0.18 + Math.sin(a * 3 + t * 0.6) * 0.25, Math.sin(a) * R];
      },
      width: 0.55, color: (_r, u) => (u < 0.25 || u > 0.75 ? C.secret : C.ball), flow: 1,
    },
  ];
  const LOOK_OF_ANCHOR = [0, 1, 2, 3, 4, 5, 6, 0]; // title, chapters 0–5, footer
  const CAM: { dist: number; height: number; lookY: number; yaw: number }[] = [
    { dist: 16, height: 1.5, lookY: 0, yaw: 0.25 }, { dist: 15, height: 1.2, lookY: -1, yaw: 0.35 },
    { dist: 11, height: 4.5, lookY: -2.2, yaw: 0.3 }, { dist: 11, height: 4.5, lookY: -2.2, yaw: 0.3 },
    { dist: 10, height: 3.8, lookY: -2.2, yaw: 0.3 }, { dist: 24, height: 0.6, lookY: 0, yaw: 0.05 },
    { dist: 14, height: 6, lookY: 0, yaw: 0.5 },
  ];

  // ---------- geometry: one strip per ribbon, rebuilt on the CPU each frame (6 × 150 × 2 vertices) ----------
  const V = RIBBONS * SEGS * 2;
  const pos = new Float32Array(V * 3), col = new Float32Array(V * 3), uv = new Float32Array(V * 2);
  const index: number[] = [];
  for (let r = 0; r < RIBBONS; r++) for (let i = 0; i < SEGS; i++) {
    const v = (r * SEGS + i) * 2;
    uv.set([i / (SEGS - 1), 0, i / (SEGS - 1), 1], v * 2);
    if (i < SEGS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
  }
  const phase = new Float32Array(V);
  for (let r = 0; r < RIBBONS; r++) phase.fill(r * 1.7, r * SEGS * 2, (r + 1) * SEGS * 2);
  const posAttr = new THREE.BufferAttribute(pos, 3), colAttr = new THREE.BufferAttribute(col, 3);
  const geo = new THREE.BufferGeometry()
    .setAttribute("position", posAttr).setAttribute("color", colAttr)
    .setAttribute("uv", new THREE.BufferAttribute(uv, 2)).setAttribute("phase", new THREE.BufferAttribute(phase, 1))
    .setIndex(index);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlow: { value: 1 }, uOpacity: { value: 0.55 } },
    vertexShader: `
      attribute vec3 color; attribute float phase;
      varying vec3 vColor; varying vec2 vUv; varying float vDepth; varying float vPhase;
      void main() {
        vColor = color; vUv = uv; vPhase = phase;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uFlow; uniform float uOpacity;
      varying vec3 vColor; varying vec2 vUv; varying float vDepth; varying float vPhase;
      void main() {
        float across = (vUv.y - 0.5) * 2.0;
        float core = exp(-across * across * 14.0);            // bright thread in the middle
        float halo = exp(-across * across * 2.2) * 0.35;      // soft glow around it
        float ends = sin(3.14159 * vUv.x);                    // fade in and out along the length
        float shimmer = 0.55 + 0.45 * sin(vUv.x * 26.0 - uTime * uFlow * 2.0 + vPhase);  // light running along it
        float depth = smoothstep(46.0, 16.0, vDepth) * smoothstep(0.6, 3.5, vDepth);    // fade far away and very close
        float a = (core + halo) * ends * shimmer * depth * uOpacity;
        gl_FragColor = vec4(vColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const u = mat.uniforms;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const canvas = renderer.domElement;
  canvas.className = "backdrop";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  scene.add(new THREE.Mesh(geo, mat));

  // ---------- scroll → story position ----------
  let tops: number[] = [];
  const measure = () => { tops = anchors.map((a) => a.getBoundingClientRect().top + scrollY); };
  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  measure();
  /** s = anchor index + morph fraction; each morph runs through the screen-height around a chapter's start. */
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

  const centre: V3[] = Array.from({ length: SEGS }, () => [0, 0, 0]);
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
    const from = LOOK_OF_ANCHOR[k], to = LOOK_OF_ANCHOR[Math.min(k + 1, anchors.length - 1)];
    const A = looks[from], B = looks[to];
    const e = smooth(f);
    const la = localAt(k, y), lb = localAt(k + 1, y);
    const lerp = (p: number, q: number) => p + (q - p) * e;

    // camera first: the ribbons turn to face it
    const P = CAM[from], Q = CAM[to];
    let dist = lerp(P.dist, Q.dist);
    if (from === 5) dist -= 22 * la * (1 - e); // chapter 4: fly into the tunnel
    const height = lerp(P.height, Q.height), lookY = lerp(P.lookY, Q.lookY);
    ptr = still ? [0, 0] : [ptr[0] + (pointer[0] - ptr[0]) * 0.04, ptr[1] + (pointer[1] - ptr[1]) * 0.04];
    const theta = lerp(P.yaw, Q.yaw) + (still ? 0 : Math.sin(scrollY * 0.0004) * 0.3 + Math.sin(t * 0.05) * 0.1) + ptr[0] * 0.25;
    const side = w >= 820 ? -4 * (1 - Math.min(1, s)) : 0; // on the title, the light sits right of the heading
    const cam: V3 = [Math.sin(theta) * dist + side, height - ptr[1] * 1.2, Math.cos(theta) * dist];
    camera.position.set(cam[0], cam[1], cam[2]);
    camera.lookAt(side, lookY, 0);

    const width = lerp(A.width, B.width) * 1.6;
    for (let r = 0; r < RIBBONS; r++) {
      for (let i = 0; i < SEGS; i++) {
        const uu = i / (SEGS - 1);
        const a = A.at(r, uu, t, la), b = f > 0.001 ? B.at(r, uu, t, lb) : a;
        const c = centre[i];
        c[0] = a[0] + (b[0] - a[0]) * e; c[1] = a[1] + (b[1] - a[1]) * e; c[2] = a[2] + (b[2] - a[2]) * e;
      }
      for (let i = 0; i < SEGS; i++) {
        // across the ribbon: tangent × direction to the camera, so each ribbon always faces the viewer
        const p = centre[i], q = centre[Math.min(i + 1, SEGS - 1)], o = centre[Math.max(i - 1, 0)];
        const tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
        const vx = cam[0] - p[0], vy = cam[1] - p[1], vz = cam[2] - p[2];
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
        const hw = width / 2 / (Math.hypot(sx, sy, sz) || 1);
        sx *= hw; sy *= hw; sz *= hw;
        const v = (r * SEGS + i) * 2;
        pos.set([p[0] - sx, p[1] - sy, p[2] - sz, p[0] + sx, p[1] + sy, p[2] + sz], v * 3);
        const uu = i / (SEGS - 1), ca = A.color(r, uu), cb = B.color(r, uu);
        const cr = ca[0] + (cb[0] - ca[0]) * e, cg = ca[1] + (cb[1] - ca[1]) * e, cbl = ca[2] + (cb[2] - ca[2]) * e;
        col.set([cr, cg, cbl, cr, cg, cbl], v * 3);
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    u.uTime.value = t;
    u.uFlow.value = lerp(A.flow, B.flow);

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
    geo.dispose(); mat.dispose(); renderer.dispose();
    canvas.remove();
  };
}

const smooth = (x: number) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
