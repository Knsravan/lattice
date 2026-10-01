// @ts-nocheck -- Three.js loads from the CDN at runtime and is used untyped here (src/types/three.d.ts covers only Scene 4).
import { reducedMotion, clamp } from "./dom.ts";

/**
 * The 3D stage behind the page (user decision, Oct 1; it replaced one fixed glass piece per chapter): one orb of light and one
 * pool of glowing dots travel the whole page and rebuild themselves into each chapter's piece as you scroll.
 *
 *   title   the wave: a sheet of lattice dots rippling under the floating sphere. Scrolling pushes the sphere down through it;
 *           the sheet parts where it passes and its halves slide out of the page, left and right
 *   ch. 0   only the sphere flies on. The halves slide back in from the sides, join as they parted, and curl into a globe of
 *           points and arcs of light round it (one arc red: a copy being taken), inside glass
 *   ch. 1   the sphere stays behind; the dots float down as threads and lay themselves along a cube's edges, which turns into
 *           glass rods and steel joints
 *   ch. 2   the same cube, carried down by the threads; its rods lean as you read while its joints stay a grid
 *   ch. 3   the threads gather into a ball of dots, tumble for a second, and a liquid glass sphere grows from the middle;
 *           everything trembles more as you read
 *   ch. 4   dots and sphere travel together: the dots ring round gold plates (a quantum computer) and the sphere lands
 *           under them as the glowing chip, pulses fading as you read
 *   ch. 5   only the sphere goes on and becomes the glowing heart while glass plates fly in from the left and right edges
 *           and close round it, seams turning green (the lock)
 *
 * Behind it all: a far aurora (teal and violet curtains, a warm glow that follows the sphere), drifting dust, and a ribbon
 * of optical fibres through every piece. Each piece sits by its chapter heading ([data-slot], in page order) and scrolls
 * with the page; the camera never moves.
 *
 * If Three.js can't load, the promise rejects and the page keeps the flat hero lattice. Decorative only (aria-hidden). If
 * the frame rate stays low it lowers sharpness, and drops the glow (bloom) only as a last resort.
 */
export async function mountSignal(slots: HTMLElement[]): Promise<() => void> {
  const addon = (p: string) => import(/* @vite-ignore */ `three/addons/${p}`);
  const [THREE, { RoomEnvironment }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
    import("three"), addon("environments/RoomEnvironment.js"), addon("postprocessing/EffectComposer.js"), addon("postprocessing/RenderPass.js"),
    addon("postprocessing/UnrealBloomPass.js"), addon("postprocessing/OutputPass.js")]);
  if (slots.length < 7) throw new Error("the stage needs the title slot and one per chapter");

  const reduced = reducedMotion;
  const lite = matchMedia("(max-width: 820px), (pointer: coarse)").matches; // phones: fewer fibres and dots, lighter geometry
  const sstep = (x, a, b) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const canvas = renderer.domElement; canvas.className = "backdrop"; canvas.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#05070d");
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 300); camera.position.set(0, 0, 20);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-6, 8, 10); scene.add(key);
  const rim = new THREE.PointLight(0x7fb4ff, 60, 40); rim.position.set(8, -4, 6); scene.add(rim);
  const glass = (tint = 0xffffff, extra = {}) => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: .06, transmission: 1,
    thickness: .4, ior: 1.3, iridescence: .6, iridescenceIOR: 1.3, clearcoat: .4, clearcoatRoughness: .05, envMapIntensity: .35, specularIntensity: .4, transparent: true, ...extra });
  const gold = new THREE.MeshStandardMaterial({ color: 0xa8843a, metalness: 1, roughness: .28, envMapIntensity: .7, transparent: true });

  const spriteTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  // ---------- backdrop A: aurora far behind + dust ----------
  const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }`;
  const farMat = new THREE.ShaderMaterial({ depthWrite: false, uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uAspect: { value: 1 }, uFocus: { value: new THREE.Vector2(.7, .5) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime, uScroll, uAspect; uniform vec2 uFocus; varying vec2 vUv; ${NOISE}
      void main(){ vec2 p = vec2(vUv.x * uAspect, vUv.y) * 2.0, q = p + vec2(0.0, uScroll); float t = uTime;
        float warp = fbm(q * 0.9 + vec2(t * 0.02, -t * 0.015)), curtain = 0.0;
        for (int k = 0; k < 3; k++) { float fk = float(k);
          float x = q.x * 0.55 + fk * 0.9 + warp * 1.6 + sin(q.y * 0.7 + t * 0.07 + fk) * 0.6;
          curtain += exp(-pow(fract(x) - 0.5, 2.0) * 38.0) * (0.55 + 0.45 * n2(vec2(x * 9.0, q.y * 0.4 - t * 0.05))) * (0.6 + 0.4 * sin(fk * 2.1 + t * 0.05)); }
        float mist = fbm(q * 0.6 - vec2(t * 0.01, 0.0));
        vec3 col = vec3(0.0016, 0.0022, 0.0045) + mix(vec3(0.05, 0.38, 0.48), vec3(0.26, 0.11, 0.48), smoothstep(0.3, 0.75, warp)) * curtain * 0.16 + vec3(0.08, 0.16, 0.42) * mist * mist * 0.06;
        vec2 d = (vUv - uFocus) * vec2(uAspect, 1.0); col += vec3(1.0, 0.62, 0.25) * exp(-dot(d, d) * 5.0) * 0.035;
        col *= 1.0 - 0.55 * pow(length((vUv - 0.5) * vec2(1.1, 1.3)), 2.0);
        gl_FragColor = vec4(col, 1.0); }` });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), farMat); far.position.z = -60; scene.add(far);
  const DN = lite ? 260 : 700, dpos = new Float32Array(DN * 3), dsz = new Float32Array(DN), dcol = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) { dpos.set([(Math.random() - .5) * 46, (Math.random() - .5) * 30, -28 + Math.random() * 34], i * 3); dsz[i] = .4 + Math.random() ** 3 * 2.4;
    const c = new THREE.Color(Math.random() < .25 ? 0xffb454 : Math.random() < .5 ? 0x7fb4ff : 0xdfe6f2); dcol.set([c.r, c.g, c.b], i * 3); }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3)); dGeo.setAttribute("aSize", new THREE.BufferAttribute(dsz, 1)); dGeo.setAttribute("aCol", new THREE.BufferAttribute(dcol, 3));
  const dustMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uLift: { value: 0 }, uMap: { value: spriteTex }, uPx: { value: 1 } },
    vertexShader: `attribute float aSize; attribute vec3 aCol; uniform float uTime, uLift, uPx; varying vec3 vCol; varying float vA;
      void main(){ vec3 p = position; float depth = (p.z + 28.0) / 34.0;
        p.y = mod(p.y + uTime * (0.08 + aSize * 0.04) + uLift * (0.3 + depth * 0.9) + 15.0, 30.0) - 15.0; p.x += sin(uTime * 0.2 + position.y) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx * 90.0 / -mv.z; vCol = aCol; vA = (0.35 + 0.65 * sin(uTime * (0.5 + aSize) + position.x * 3.0) * 0.5 + 0.5) * smoothstep(0.0, 0.3, depth); }`,
    fragmentShader: "uniform sampler2D uMap; varying vec3 vCol; varying float vA; void main(){ gl_FragColor = vec4(vCol * vA * 0.5, 1.0) * texture2D(uMap, gl_PointCoord).a; }" });
  const dust = new THREE.Points(dGeo, dustMat); scene.add(dust);

  // ---------- everything below lives in page space: it scrolls with the page ----------
  const page = new THREE.Group(); scene.add(page);

  // colours (values above 1 glow through the bloom)
  const BLUE = new THREE.Color(.75, 1.25, 2.6), AMBER = new THREE.Color(2.4, 1.35, .5), WHITE = new THREE.Color(1.7, 1.8, 2.1), GREEN = new THREE.Color(.55, 2.4, 1.4),
    RED = new THREE.Color(2.6, .5, .8), GOLDC = new THREE.Color(2.2, 1.7, .7), COPPER = new THREE.Color(1.6, .8, .45), _c = new THREE.Color();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: .25, transparent: true });

  // ---------- the formations: one pool of dots arranged as each piece (local units, about 3 across) ----------
  const N = lite ? 225 : 289, rnd = (s) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const knn = (pts, k) => { const E = new Set(), out = [];
    pts.forEach((a, i) => pts.map((b, j) => [a.distanceToSquared(b), j]).filter(([, j]) => j !== i).sort((x, y) => x[0] - y[0]).slice(0, k)
      .forEach(([, j]) => { const key = i < j ? i + "," + j : j + "," + i; if (!E.has(key)) { E.add(key); out.push([Math.min(i, j), Math.max(i, j)]); } })); return out; };
  const fib = (n, R) => Array.from({ length: n }, (_, i) => { const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963; return V(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(R); });
  const F = [], G = {}; // G: shared state the formations read (rods showing, shear, tumble)

  const WM = Math.round(Math.sqrt(N)), side = new Float32Array(N);
  { // 0 · the wave
    const S = 2.9 / (WM - 1), base = [], E = [];
    for (let i = 0; i < WM; i++) for (let j = 0; j < WM; j++) { base.push([(i - (WM - 1) / 2) * S, (j - (WM - 1) / 2) * S]); side[base.length - 1] = i < (WM - 1) / 2 || (i === (WM - 1) / 2 && j % 2) ? -1 : 1; }
    for (let i = 0; i < WM; i++) for (let j = 0; j < WM; j++) { if (i < WM - 1) E.push([i * WM + j, (i + 1) * WM + j]); if (j < WM - 1) E.push([i * WM + j, i * WM + j + 1]); }
    F.push({ n: base.length, edges: E, rot: (t, f) => [.55, t * .12, 0],
      bead(i, t, f, v, c) { const [x, z] = base[i], r = Math.hypot(x, z), ph = r * 3.2 - t * 1.8, w = Math.pow(Math.max(0, Math.sin(ph)), 4) * Math.exp(-r * .4);
        v.set(x, Math.sin(ph) * Math.exp(-r * .55) * .22 - .25, z); c.copy(BLUE).multiplyScalar(.32).lerp(AMBER, w); return .03 + w * .02; } }); }
  { // 1 · the globe: points on a sphere, arcs of light between them, one arc red
    const R = 1.35, nodes = fib(100, R), E = knn(nodes, 3), arcs = [], per = 14;
    for (let a = 0; a < 12 && 100 + (a + 1) * per <= N; a++) { const A = nodes[(a * 37) % 100], B = nodes[(a * 37 + 41) % 100], mid = A.clone().add(B).normalize().multiplyScalar(R * 1.8);
      const curve = new THREE.QuadraticBezierCurve3(A, mid, B); for (let m = 0; m < per; m++) { arcs.push([a, m / (per - 1), curve.getPoint(m / (per - 1))]); if (m) E.push([100 + a * per + m - 1, 100 + a * per + m]); } }
    F.push({ n: 100 + arcs.length, edges: E, rot: (t, f) => [.35, t * .18 + f * 1.2, 0],
      bead(i, t, f, v, c) { if (i < 100) { v.copy(nodes[i]); c.copy(BLUE).multiplyScalar(.7); return .035; }
        const [a, u, p] = arcs[i - 100], pulse = Math.pow(Math.max(0, Math.sin((u - t * .45 - a * .37) * 9)), 8); v.copy(p);
        c.copy(a === 4 ? RED : AMBER).multiplyScalar(.25 + pulse * .9); return .02 + pulse * .02; } }); }
  // 2, 3 · the cube: 3×3×3 joints, and dots strung along every rod (threads of dots); then glass rods and steel joints take over
  const CS = .8, inner = lite ? 3 : 4, cubeP = [], cubeE = [], cubeJoint = [];
  { const P = (i, j, k) => V(i - 1, j - 1, k - 1).multiplyScalar(CS), id = (i, j, k) => (i * 3 + j) * 3 + k;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { cubeP.push(P(i, j, k)); cubeJoint.push(true); }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      if (i + di > 2 || j + dj > 2 || k + dk > 2) continue; const a = P(i, j, k), b = P(i + di, j + dj, k + dk); let prev = id(i, j, k);
      for (let m = 1; m <= inner; m++) { cubeP.push(a.clone().lerp(b, m / (inner + 1))); cubeJoint.push(false); cubeE.push([prev, cubeP.length - 1]); prev = cubeP.length - 1; }
      cubeE.push([prev, id(i + di, j + dj, k + dk)]); } }
  const shearM = (f) => { const k = sstep(f, .02, .45) * .9; return new THREE.Matrix3().set(1, k, 0, 0, 1, k * .5, 0, 0, 1); };
  for (const lean of [false, true]) F.push({ n: cubeP.length, edges: cubeE, lean, rot: lean ? (t, f) => [.45, t * .15 - .6, 0] : (t, f) => [.5 + f * .6, t * .18 + f * 1.5, 0],
    bead(i, t, f, v, c) { v.copy(cubeP[i]); if (lean) v.applyMatrix3(shearM(f)); const r = G.rods[lean ? 3 : 2] || 0;
      c.copy(WHITE).multiplyScalar(cubeJoint[i] ? .55 : .4 * (1 - r * .6)); return (cubeJoint[i] ? .045 : .026) * (1 - r * (cubeJoint[i] ? .3 : .7)); } });
  { // 4 · the shake: a ball of dots and threads round the liquid sphere, trembling more as you read
    const R = 1.55, P = fib(N, R), E = knn(P, 3);
    F.push({ n: N, edges: E, rot: (t, f) => [.2, t * .1, 0],
      bead(i, t, f, v, c) { const amp = .03 + f * .14, p = P[i]; v.copy(p);
        const n = Math.sin(p.x * 3.1 + t * 2.1) * Math.sin(p.y * 2.7 - t * 1.7) + Math.sin(p.z * 3.7 + t * 1.3) * .6; v.multiplyScalar(1 + n * amp);
        c.copy(BLUE).multiplyScalar(.45).lerp(WHITE, clamp(n * .5, 0, 1) * .6); return .024; } }); }
  const PLATES = [1.25, 1.05, .88, .72, .58];
  { // 5 · the chandelier: rings of dots round the gold plates, copper threads between them
    const counts = [40, 36, 30, 26, 22], P = [], E = [], kind = [];
    PLATES.forEach((r, i) => { const s = P.length, rr = r + .06; for (let m = 0; m < counts[i]; m++) { const a = m / counts[i] * Math.PI * 2; P.push(V(Math.cos(a) * rr, 1.3 - i * .62, Math.sin(a) * rr)); kind.push(0); E.push([s + m, s + (m + 1) % counts[i]]); } });
    for (let k = 0; k < 10 && P.length + 12 <= N; k++) { const s = P.length, a0 = k / 10 * Math.PI * 2;
      for (let m = 0; m < 12; m++) { const u = m / 11, y = 1.3 - u * 2.5, rr = 1.1 - u * .6; P.push(V(Math.cos(a0 + u * 1.4) * rr, y, Math.sin(a0 + u * 1.4) * rr)); kind.push(1); if (m) E.push([s + m - 1, s + m]); } }
    F.push({ n: P.length, edges: E, rot: (t, f) => [.18, t * .25, 0],
      bead(i, t, f, v, c) { v.copy(P[i]); if (kind[i]) { const w = Math.pow(Math.max(0, Math.sin(i * .5 - t * 3)), 6); c.copy(COPPER).multiplyScalar(.35 + w * .6); return .018; }
        c.copy(GOLDC).multiplyScalar(.55); return .028; } }); }

  // ---------- meshes ----------
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), N); beads.frustumCulled = false; page.add(beads);
  const maxL = F.reduce((a, f) => a + f.edges.length, 0) + N, lp = new Float32Array(maxL * 6), lc = new Float32Array(maxL * 6), lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3)); lg.setAttribute("color", new THREE.BufferAttribute(lc, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); lines.frustumCulled = false; page.add(lines);
  // the sphere: amber light in a glass shell
  const orb = new THREE.Group(); page.add(orb);
  const coreMat = new THREE.MeshBasicMaterial({ color: AMBER.clone() }), orbCore = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), coreMat); orb.add(orbCore);
  const orbShell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), glass(0xffffff, { thickness: .4, iridescence: .8, envMapIntensity: .6, specularIntensity: .8 })); orb.add(orbShell);
  const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, color: new THREE.Color(1.4, .8, .3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); orb.add(orbGlow);
  const TRAIL = 40, trailPts = Array.from({ length: TRAIL }, () => V()), tp = new Float32Array(TRAIL * 3), tcol = new Float32Array(TRAIL * 3), tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(tp, 3)); tg.setAttribute("color", new THREE.BufferAttribute(tcol, 3));
  const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; page.add(trail);
  // ch. 0: the globe's glass
  const globeGlass = new THREE.Mesh(new THREE.SphereGeometry(1.31, 64, 40), glass(0xe6efff, { thickness: .4 })); page.add(globeGlass);
  // ch. 1–2: glass rods and steel joints (the site's lattice sculpture)
  const rodLattice = () => { const g = new THREE.Group(), rodG = new THREE.CylinderGeometry(.035, .035, CS, 10), jointG = new THREE.SphereGeometry(.075, 16, 12), rm = glass(0xe8f1ff, { thickness: .3 });
    const joints = [], rods = [], up = V(0, 1, 0);
    for (let i = 0; i < 27; i++) { const m = new THREE.Mesh(jointG, steel); g.add(m); joints.push(m); }
    cubeE.length; // rods follow the joint pairs
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      if (i + di > 2 || j + dj > 2 || k + dk > 2) continue; const r = new THREE.Mesh(rodG, rm); g.add(r); rods.push([r, (i * 3 + j) * 3 + k, ((i + di) * 3 + j + dj) * 3 + k + dk]); }
    g.userData.shape = (M) => { const w = (n) => cubeP[n].clone().applyMatrix3(M);
      joints.forEach((m, n) => m.position.copy(w(n)));
      for (const [r, a, b] of rods) { const A = w(a), B = w(b), d = B.clone().sub(A); r.position.copy(A).add(B).multiplyScalar(.5); r.scale.y = d.length() / CS; r.quaternion.setFromUnitVectors(up, d.normalize()); } };
    g.userData.mat = rm; g.userData.shape(new THREE.Matrix3()); page.add(g); return g; };
  const rodsAt = { 2: rodLattice(), 3: rodLattice() };
  // ch. 3: the liquid sphere
  const dropGeo = new THREE.IcosahedronGeometry(1.15, lite ? 20 : 36), dropBase = Float32Array.from(dropGeo.attributes.position.array);
  const drop = new THREE.Mesh(dropGeo, glass(0xffffff, { thickness: 2.4, iridescence: .8, dispersion: 3, envMapIntensity: .8, specularIntensity: .9 })); page.add(drop);
  // ch. 4: gold plates that open out of the sphere, pulse rings from the chip
  const plates = new THREE.Group(); page.add(plates);
  PLATES.forEach((r, i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .045, 64), gold); d.position.y = 1.3 - i * .62 - .05; plates.add(d);
    if (i < PLATES.length - 1) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + i * .3, rr = PLATES[i + 1] * .82;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .62, 8), gold); rod.position.set(Math.cos(a) * rr, 1.3 - i * .62 - .36, Math.sin(a) * rr); plates.add(rod); } });
  const CHIP_Y = -1.36, chip = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.4) })); chip.position.y = CHIP_Y; page.add(chip);
  const chipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, color: new THREE.Color(.6, .8, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); chip.add(chipGlow);
  const pulses = []; for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.6, .008, 6, 96), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.rotation.x = Math.PI / 2; r.position.y = -1.42; plates.add(r); pulses.push(r); }
  // ch. 5: the site's lock, unchanged: glass plates fly in and close round the light, seams turning green
  const shield = new THREE.Group(); page.add(shield);
  const shieldPlates = [], seam = new THREE.LineBasicMaterial({ color: new THREE.Color(0x3ddc97), transparent: true, opacity: .9 });
  { const ico = new THREE.IcosahedronGeometry(1.3, 1), P = ico.attributes.position, pm = glass(0xf2fff8, { thickness: .5, iridescence: .5, side: THREE.DoubleSide, transparent: false, envMapIntensity: 1.1, specularIntensity: 1 });
    for (let f = 0; f < P.count; f += 3) { const a = V().fromBufferAttribute(P, f), b = V().fromBufferAttribute(P, f + 1), c = V().fromBufferAttribute(P, f + 2);
      const mid = a.clone().add(b).add(c).divideScalar(3), shape = new THREE.BufferGeometry().setFromPoints([a, b, c].map((q) => q.clone().sub(mid).multiplyScalar(.96)));
      shape.computeVertexNormals(); const holder = new THREE.Group(); holder.add(new THREE.Mesh(shape, pm), new THREE.LineLoop(shape, seam)); holder.position.copy(mid); shield.add(holder);
      shieldPlates.push([holder, mid.clone(), (f / 3) % 2 ? 1 : -1, [rnd(f + 1), rnd(f + 2), rnd(f + 3)], new THREE.Euler((f % 5) - 2, (f % 3) - 1, (f % 4) - 1.5)]); } }

  // ---------- the fibres, and the stations they pass through ----------
  const threadMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(0xffb454) }, uB: { value: new THREE.Color(0x7fb4ff) } },
    vertexShader: "attribute float aSeed; varying vec2 vUv; varying float vSeed; void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv; varying float vSeed;
      void main() { float x = vUv.x * 60.0 - uTime * (0.6 + vSeed * 0.5) + vSeed * 17.0;
        float pulse = pow(max(0.0, 1.0 - fract(x) * 3.0), 3.0) * step(0.55, fract(floor(x) * 0.618 + vSeed));
        vec3 pc = mix(uA, uB, step(0.5, fract(vSeed * 7.0))); gl_FragColor = vec4(uB * 0.12 + pc * pulse * 1.6, 0.35 + pulse * 0.65); }` });
  const threads = new THREE.Group(); page.add(threads);
  let unit = 1, W = 0, H = 0, mx = 0, my = 0, smx = 0, smy = 0, st = [], mids = [], pageH = 0, wires = []; // wires: each fibre sampled top to bottom, so what travels can ride on it
  function measure() {
    st = slots.map((s) => { const r = s.getBoundingClientRect(); return { x: (r.left + r.width / 2 - W / 2) * unit, y: -(r.top + scrollY + r.height / 2) * unit, py: r.top + scrollY + r.height / 2, top: r.top, h: r.height, sc: r.width * unit / 3.2 }; });
    mids = st.slice(0, -1).map((a, j) => { const b = st[j + 1]; return V((a.x + b.x) / 2 + Math.sin(j * 1.3 + .6) * 2.2, (a.y + b.y) / 2, -1.2); }); }
  /** The point on fibre `w` at page height y (the fibres run down the page, so y picks one point; nearest sample, then blended). */
  function onWire(w, y, out) { const f = wires[w], ys = f.y; let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ys[m] > y) lo = m; else hi = m; } // ys falls from top to bottom
    const k = ys[lo] === ys[hi] ? 0 : clamp((ys[lo] - y) / (ys[lo] - ys[hi]), 0, 1);
    return out.set(f.x[lo] + (f.x[hi] - f.x[lo]) * k, y, f.z[lo] + (f.z[hi] - f.z[lo]) * k + .04); }
  function layout() {
    measure(); pageH = document.documentElement.scrollHeight;
    threads.children.forEach((m) => m.geometry.dispose()); threads.clear();
    const n = lite ? 8 : 16; wires = [];
    // the ribbon passes behind each piece; between pieces it runs down the empty margin on the side of the next piece, so it
    // (and whatever rides it) isn't hidden behind the diagrams' glass (user request, Oct 1)
    const rects = slots.map((q) => q.getBoundingClientRect()), edgeL = Math.min(...rects.map((r) => r.left)), edgeR = Math.max(...rects.map((r) => r.right));
    for (let i = 0; i < n; i++) { const u = i / (n - 1) - .5, pts = [V(st[0].x + u * 9, H * unit * .5 + 2, -2.5 - Math.abs(u) * 3)];
      st.forEach((a, j) => { const z = -2.5 - (i % 3) * .7 - Math.abs(u) * 3, b = st[j + 1];
        pts.push(V(a.x + u * 5.5, a.y + Math.sin(i * 1.7) * .4, z));
        if (!b) return;
        const right = b.x > 0, gw = Math.max(right ? W - 44 - edgeR : edgeL, 56), gx = ((right ? W - 44 - gw / 2 : gw / 2) - W / 2) * unit;
        const fan = u * gw * unit * .75, d = Math.min(H * .7, (b.py - a.py) * .3) * unit, sway = Math.sin(j * 1.3 + .6) * gw * unit * .12;
        pts.push(V(gx + fan, a.y - d, z), V(gx + fan + sway, (a.y + b.y) / 2, z - .3), V(gx + fan, b.y + d, z)); });
      pts.push(V(u * 6, st[st.length - 1].y - H * unit, -3));
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal"), geo = new THREE.TubeGeometry(curve, lite ? 500 : 900, .012 + (i % 3) * .006, 5);
      const sp = curve.getSpacedPoints(lite ? 1200 : 2400); wires[i] = { y: Float32Array.from(sp, (p) => p.y), x: Float32Array.from(sp, (p) => p.x), z: Float32Array.from(sp, (p) => p.z) };
      geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(i / n), 1));
      threads.add(new THREE.Mesh(geo, threadMat)); } }

  // dots fly in strands (threads of dots), one after another
  const STR = 10, strand = (i) => i % STR, order = Float32Array.from({ length: N }, (_, i) => Math.floor(i / STR) / Math.ceil(N / STR));
  const lane = Array.from({ length: STR }, (_, s) => V((s / (STR - 1) - .5) * 2.2, (rnd(s + 3) - .5) * .5, (rnd(s + 9) - .5) * 1.2));

  // a station's transform: its slot, the formation's own turn, the cursor tilt, and (ch. 3) a tumble
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(), _m4 = new THREE.Matrix4(), tumbleQ = new THREE.Quaternion(), tumbleAxis = V(.6, 1, .3).normalize();
  function station(j, rot, dy = 0) { const s = st[j], [rx, ry, rz] = rot; _e.set(rx + smy * .25, ry + smx * .35, rz); _q.setFromEuler(_e); if (j === 4) _q.multiply(tumbleQ);
    return new THREE.Matrix4().compose(V(s.x + smx * .4, s.y - dy * unit - smy * .3, 0), _q.clone(), V(s.sc, s.sc, s.sc)); }
  const mk = () => ({ pos: Array.from({ length: N }, () => V()), col: Array.from({ length: N }, () => new THREE.Color()), size: new Float32Array(N) });
  const A = mk(), B = mk(), Wb = mk(), cur = mk();
  function fill(out, form, j, t, f, dy = 0) { const fm = F[form], m = station(j, fm.rot(t, f), dy), sc = st[j].sc, centre = V().setFromMatrixPosition(m);
    for (let i = 0; i < N; i++) { if (i < fm.n) { out.size[i] = fm.bead(i, t, f, out.pos[i], out.col[i]) * sc; out.pos[i].applyMatrix4(m); }
      else { out.pos[i].copy(centre); out.size[i] = 0; out.col[i].setRGB(0, 0, 0); } }
    return { m, centre, sc }; }

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .5, .86); composer.addPass(bloom); composer.addPass(new OutputPass());
  const onPointer = (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }; addEventListener("pointermove", onPointer, { passive: true });
  const resize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    unit = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H;
    const fh = 2 * 80 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); far.scale.set(fh * camera.aspect * 1.15, fh * 1.15, 1); farMat.uniforms.uAspect.value = camera.aspect;
    dustMat.uniforms.uPx.value = renderer.getPixelRatio() * H / 800; layout(); };
  let rebuild = 0; const ro = new ResizeObserver(() => { clearTimeout(rebuild); rebuild = window.setTimeout(resize, 200); }); ro.observe(document.body); resize();

  const e3 = (x) => x * x * (3 - 2 * x), bez2 = (a, c, b, u) => { const w = 1 - u; return V().addScaledVector(a, w * w).addScaledVector(c, 2 * w * u).addScaledVector(b, u * u); };
  const fract7 = (x) => { const v = x * 7; return v - Math.floor(v); }, FIB_A = new THREE.Color(1.6, .95, .4), FIB_B = new THREE.Color(.6, .95, 2); // (as the fibre shader: uA amber, uB blue)
  const ki = new Float32Array(N), kiL = new Float32Array(N), tu = new Float32Array(N); // arrived, left, place on its thread
  let t = 0, last = performance.now(), trailInit = false, shakeT0 = null, grow = 0, raf = 0, frames = 0, slow = 0, sampled = 0, level = 0;
  // (user decision: keep the glow; sharpness goes first, then fewer pixels still, and the glow only as a last resort)
  const downgrades = [() => { renderer.setPixelRatio(1); composer.setPixelRatio(1); }, () => { renderer.setPixelRatio(.75); composer.setPixelRatio(.75); }, () => { bloom.enabled = false; }];
  const frame = (now) => { raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, .05); last = now; // (a frame's timestamp can be a little earlier than the last one)
    const still = reduced(); if (!still) t += dt; smx += (mx - smx) * .06; smy += (my - smy) * .06; const sy = scrollY; // (the page's own glide already eases the scroll)
    measure(); if (++frames % 60 === 0 && Math.abs(document.documentElement.scrollHeight - pageH) > 40) layout();
    page.position.y = (sy + H / 2) * unit;
    threadMat.uniforms.uTime.value = t * 1.2; farMat.uniforms.uTime.value = t; farMat.uniforms.uScroll.value = sy / H * .35;
    dustMat.uniforms.uTime.value = t; dustMat.uniforms.uLift.value = sy * unit * .35; dust.position.set(-smx * 1.6, smy * 1.1, 0);

    // where are we? segment j runs from station j (centred on screen, s = 0) to station j+1 (centred, s = 1), however long the
    // chapter in between is (story, then playground). What travels never waits off screen (user request, Oct 1): it leaves its
    // piece in the first ~0.6 screens, then rides along the path in view the whole way down as threads of light, and builds the
    // next piece in the last ~0.8 screens before its heading reaches mid-screen.
    const cy = sy + H / 2; let j = 0; while (j < st.length - 2 && cy > st[j + 1].py) j++;
    const from = j === 0 ? Math.max(st[0].py, H / 2 + 1) : st[j].py; // (phones: the title piece sits above mid-screen at the top)
    const gap = st[j + 1].py - from, s = clamp((cy - from) / gap, 0, 1);
    const L1 = clamp(H * .6 / gap, .08, .4), L2 = clamp(H * .8 / gap, .1, .45), kLeave = sstep(s, 0, L1), kArr = sstep(s, 1 - L2, 1);
    const pOf = (q) => clamp((H - st[q].top) / (H + st[q].h), 0, 1); // 0 as a slot enters the screen, 1 as it leaves (as before)
    // it rides on the fibres that run down the page (user request, Oct 1): each thread of dots on its own fibre, the sphere on the middle one
    const yv = -(sy + H / 2) * unit, Lt = H * unit * 1.5, nW = wires.length, midWire = (nW - 1) >> 1;
    const flow = still ? 0 : t * .04 + (sy / H) * .35; // dots stream down their threads with time and with your scroll

    // ch. 3: once the dots have formed, they tumble for a second, then the liquid sphere grows from the middle
    const shakeHere = (j === 3 && kArr > .97) || j >= 4;
    if (shakeHere && shakeT0 === null) { shakeT0 = t; tumbleAxis.set(rnd(t) - .5, 1, rnd(t + 1) - .5).normalize(); } if (!shakeHere) shakeT0 = null;
    const since = shakeT0 === null ? 0 : still ? 9 : t - shakeT0; // (reduced motion: no tumble, the sphere is simply there)
    tumbleQ.setFromAxisAngle(tumbleAxis, e3(clamp(since / 1.1, 0, 1)) * Math.PI * 1.3);
    grow += ((shakeHere ? sstep(since, 1.1, 2.8) : 0) - grow) * (still ? 1 : .08);

    // rods show once the dots have formed the cube, and go before the dots leave
    G.rods = { 2: j === 1 ? sstep(kArr, .85, 1) : j === 2 ? 1 - sstep(kLeave, 0, .15) : 0, 3: j === 2 ? sstep(kArr, .85, 1) : j === 3 ? 1 - sstep(kLeave, 0, .15) : 0 };

    const last5 = j === 5; // ch. 4 → 5: only the sphere travels; the dots stay with the chandelier
    const a = fill(A, Math.min(j, 5), j, t, pOf(j)), b = last5 ? a : fill(B, j + 1, j + 1, t, pOf(j + 1));
    if (last5) for (let i = 0; i < N; i++) { B.pos[i].copy(A.pos[i]); B.col[i].copy(A.col[i]); B.size[i] = A.size[i]; }
    // (title → ch. 0 only) the curve's middle, between the two pieces
    const mid = V((a.centre.x + b.centre.x) / 2 + Math.sin(j * 1.3 + .6) * 2.2, (a.centre.y + b.centre.y) / 2, -1.2), ab = V().subVectors(mid, a.centre), ba = V().subVectors(mid, b.centre);

    // ---------- the dots ----------
    let wHalf = 0, wBack = 0, wOpen = 0;
    if (j === 0) { // the wave splits; its halves leave the page left and right, come back at the globe the same way, and curl into it
      fill(Wb, 0, 1, t, 0); const D = W * unit * .5 + 3.4 * Math.max(a.sc, b.sc);
      wOpen = sstep(s, .1, .2); wHalf = sstep(s, .2, .5); wBack = sstep(s, .56, .8);
      for (let i = 0; i < N; i++) { const curl = e3(clamp((s - .8 - order[i] * .06) / .1, 0, 1)); ki[i] = curl;
        if (s < .55) { cur.pos[i].copy(A.pos[i]); cur.pos[i].x += side[i] * (wOpen * .5 * a.sc + wHalf * wHalf * D); cur.pos[i].y -= wHalf * .6 * a.sc; cur.col[i].copy(A.col[i]); cur.size[i] = A.size[i]; }
        else { const o = (1 - wBack) * (1 - wBack) * D; cur.pos[i].copy(Wb.pos[i]); cur.pos[i].x += side[i] * o;
          if (curl > 0) { cur.pos[i].lerp(B.pos[i], curl); cur.pos[i].y += Math.sin(curl * Math.PI) * .5 * b.sc; }
          cur.col[i].copy(Wb.col[i]).lerp(B.col[i], curl); cur.size[i] = THREE.MathUtils.lerp(Wb.size[i], B.size[i], curl); } } }
    else if (last5) { for (let i = 0; i < N; i++) { cur.pos[i].copy(A.pos[i]); cur.col[i].copy(A.col[i]); cur.size[i] = A.size[i]; ki[i] = 0; } }
    else { // the dots leave as threads of light, ride the path in view, and build the next piece
      const spread = .6, T = V();
      for (let i = 0; i < N; i++) {
        const l = e3(clamp(kLeave * (1 + spread) - order[i] * spread, 0, 1)), r = e3(clamp(kArr * (1 + spread) - order[i] * spread, 0, 1));
        kiL[i] = l; ki[i] = r;
        // its place on its thread: threads hang down the path, gently waving, the dots streaming along them
        // spread over every fibre, spaced out along it, so the dots read as the fibres' own pulses of light (user request, Oct 1)
        const w = i % nW, u = (Math.floor(i / nW) / Math.ceil(N / nW) + rnd(i + 5) * .04 + flow * (1 + (w % 3) * .15)) % 1;
        tu[i] = u; onWire(w, yv + (.5 - u) * Lt, T);
        const fade = Math.sin(u * Math.PI), tw = .7 + .3 * Math.sin(t * 3 + i); // (dim at the ends, a little shimmer)
        cur.pos[i].copy(A.pos[i]).lerp(T, l).lerp(B.pos[i], r);
        _c.copy(fract7(w / nW) < .5 ? FIB_A : FIB_B).multiplyScalar((.5 + fade * .9) * tw); // the fibre's own pulse colour
        cur.col[i].copy(A.col[i]).lerp(_c, l).lerp(B.col[i], r);
        cur.size[i] = THREE.MathUtils.lerp(THREE.MathUtils.lerp(A.size[i], (.006 + fade * .01) * Math.max(a.sc, b.sc), l), B.size[i], r); } }
    for (let i = 0; i < N; i++) { _m4.compose(cur.pos[i], _q.identity(), _s.setScalar(cur.size[i])); beads.setMatrixAt(i, _m4); beads.setColorAt(i, cur.col[i]); }
    beads.instanceMatrix.needsUpdate = true; beads.instanceColor.needsUpdate = true;

    // ---------- the lines between them ----------
    let n = 0; const put = (x, y, al) => { if (al <= .01) return; const p = cur.pos[x], q = cur.pos[y]; _c.copy(cur.col[x]).multiplyScalar(al * .55);
      lp.set([p.x, p.y, p.z, q.x, q.y, q.z], n * 6); lc.set([_c.r, _c.g, _c.b, _c.r, _c.g, _c.b], n * 6); n++; };
    const rodFade = (st_) => 1 - (G.rods[st_] || 0) * .75;
    if (j === 0) { F[0].edges.forEach(([x, y]) => put(x, y, (side[x] === side[y] ? 1 : s < .55 ? 1 - sstep(wOpen, 0, .15) : sstep(wBack, .94, 1)) * (1 - sstep(Math.max(ki[x], ki[y]), 0, .15))));
      F[1].edges.forEach(([x, y]) => put(x, y, sstep(Math.min(ki[x], ki[y]), .85, 1))); }
    else { F[Math.min(j, 5)].edges.forEach(([x, y]) => put(x, y, (last5 ? 1 : 1 - sstep(Math.max(kiL[x], kiL[y]), 0, .12)) * rodFade(j)));
      if (!last5) F[j + 1].edges.forEach(([x, y]) => put(x, y, sstep(Math.min(ki[x], ki[y]), .88, 1) * rodFade(j + 1))); } // (in flight they ride inside the fibres: no lines)
    lg.setDrawRange(0, n * 2); lg.attributes.position.needsUpdate = lg.attributes.color.needsUpdate = true;

    // ---------- the pieces' solid parts ----------
    const place = (obj, m, scale) => { m.decompose(obj.position, obj.quaternion, _s); obj.scale.setScalar(scale); };
    // globe glass: forms after the dots curl in, fades as they leave
    const gv = j === 0 ? sstep(s, .9, 1) : j === 1 ? 1 - sstep(kLeave, 0, .2) : 0;
    globeGlass.visible = gv > .01; if (gv > .01) { place(globeGlass, j === 0 ? b.m : a.m, (j === 0 ? b.sc : a.sc) * (.7 + .3 * gv)); globeGlass.material.opacity = gv; }
    // glass rods and steel joints
    for (const q of [2, 3]) { const L = rodsAt[q], v = G.rods[q]; L.visible = v > .01; if (!L.visible) continue;
      const isA = j === q, m = isA ? a.m : b.m, f = pOf(q); place(L, m, st[q].sc); L.userData.shape(q === 3 ? shearM(f) : new THREE.Matrix3());
      L.userData.mat.opacity = v; steel.opacity = v; }
    // the liquid sphere (ch. 3)
    const dropOut = j === 4 ? sstep(kLeave, .2, .8) : 0, dv = grow * (1 - dropOut);
    drop.visible = dv > .01 && j >= 3 && j <= 4;
    if (drop.visible) { const m = j === 3 ? b.m : a.m, f = pOf(4); place(drop, m, st[4].sc * dv);
      const amp = .035 + f * .12, pos = dropGeo.attributes.position, v = V();
      for (let i = 0; i < pos.count; i++) { v.fromArray(dropBase, i * 3); const nn = Math.sin(v.x * 3.1 + t * 2.1) * Math.sin(v.y * 2.7 - t * 1.7) + Math.sin(v.z * 3.7 + t * 1.3) * .6; v.multiplyScalar(1 + nn * amp); pos.setXYZ(i, v.x, v.y, v.z); }
      pos.needsUpdate = true; dropGeo.computeVertexNormals(); }
    // gold plates open out of the sphere (ch. 4) and fold back into it when it leaves
        const pv = j === 4 ? sstep(kArr, .85, 1) : j >= 5 ? 1 : 0, pg = j === 4 ? sstep(kArr, .9, 1) : j === 5 ? 1 - sstep(kLeave, 0, .3) : 0; // plates; the chip (the sphere, landed)
    plates.visible = pv > .01; if (plates.visible) { place(plates, j === 4 ? b.m : a.m, st[5].sc * (.92 + .08 * pv)); gold.opacity = .85 * pv;
      pulses.forEach((r, i) => { const q = (t * .35 + i / 3) % 1; r.scale.setScalar(.3 + q * 2.6); r.material.opacity = (1 - q) * .8 * pg * (1 - pOf(5) * .7); }); }
    chip.visible = pg > .01; if (chip.visible) { place(chip, j === 4 ? b.m : a.m, st[5].sc); chip.position.copy(V(0, CHIP_Y, 0).applyMatrix4(j === 4 ? b.m : a.m));
      chip.scale.set(st[5].sc * pg, st[5].sc * (.4 + .6 * pg), st[5].sc * pg); chipGlow.scale.setScalar(1.5); chipGlow.material.opacity = .6 * pg; }
    // the lock (ch. 5): its own scroll animation, as on the site
    const r6 = { top: st[6].py - st[6].h / 2 - sy }, p6 = clamp((H - r6.top) / (H + st[6].h), 0, 1), lockE = 1 - Math.pow(1 - clamp((p6 - .05) / .6, 0, 1), 3);
    shield.visible = p6 > 0 && p6 < 1; if (shield.visible) { place(shield, station(6, [0, t * .12, 0]), st[6].sc);
      const inv = shield.quaternion.clone().invert(), sc6 = st[6].sc, halfW = W * unit * .5;
      for (const [h, home, sd, r, rot] of shieldPlates) { // each plate starts just past the page's left or right edge
        const e = e3(clamp(lockE * 1.15 - r[0] * .15, 0, 1)), off = V(sd * (halfW + 1.5 + r[1] * 3) - shield.position.x, (r[2] - .5) * 4 * sc6, (r[0] - .5) * 3).applyQuaternion(inv).divideScalar(sc6);
        h.position.copy(home).addScaledVector(off, 1 - e); h.rotation.set(rot.x * (1 - e) * 2, rot.y * (1 - e) * 2, rot.z * (1 - e) * 2); }
      seam.opacity = .2 + lockE * .8; }

    // ---------- the sphere ----------
    // title → ch. 0: it sinks into the wave and flies on alone; ch. 0 → 2: it stays with the globe; ch. 3: it is the liquid sphere;
    // ch. 3 → 4: it travels with the dots and lands as the chandelier's chip; ch. 4 → 5: it travels alone and becomes the lock's heart
    const local = (m, x, y, z) => V(x, y, z).applyMatrix4(m);
    let pos = V(), core = .12, shellR = .34, vis = 1, travel = 0, colG = 0;
    if (j === 0) { // it floats on the wave, bobbing with it; scrolling pushes it down through the sheet, which parts round it
      const rest = Math.sin(-t * 1.8) * .22 - .25 + .36, under = -1.4, sink = sstep(s, .04, .3), u = sstep(s, .3, .95); travel = u;
      if (s < .3) pos = local(a.m, 0, THREE.MathUtils.lerp(rest, under, e3(sink)), 0);
      else { const P0 = local(a.m, 0, under, 0); pos = bez2(P0, mid.clone().multiplyScalar(2).sub(P0.clone().add(b.centre).multiplyScalar(.5)), b.centre, u); }
      core = THREE.MathUtils.lerp(.12, .15, u); shellR = THREE.MathUtils.lerp(.34, .3, u); }
    else if (j === 1 || j === 2) { pos = j === 1 ? a.centre : V().setFromMatrixPosition(station(1, F[1].rot(t, 1))); core = .15; shellR = .3; vis = j === 1 ? 1 : 0; }
    else if (j === 3) { pos = b.centre; core = .16 * grow; shellR = 0; vis = grow > .01 ? 1 : 0; }
    else if (j >= 4) { // it leaves its piece, rides the path at the head of the threads in view, and lands (ch. 4: as the chip; ch. 5: as the lock's heart)
      const ride = Math.min(kLeave, 1 - kArr); travel = ride;
      const start = j === 4 ? a.centre : local(a.m, 0, CHIP_Y, 0), end = j === 4 ? local(b.m, 0, CHIP_Y, 0) : V().setFromMatrixPosition(station(6, [0, 0, 0]));
      const head = onWire(midWire, yv - Lt * (j === 4 ? .56 : 0), V());
      pos = start.clone().lerp(head, e3(kLeave)).lerp(end, e3(kArr));
      if (j === 4) { const q = 1 - pg; core = .16 * Math.max(grow, kLeave) * q; shellR = .3 * sstep(kLeave, .2, .7) * q; vis = q > .01 ? 1 : 0; }
      else { const q = 1 - pg; core = THREE.MathUtils.lerp(.04, .32, sstep(kArr, .3, 1)) * Math.max(q, kArr); shellR = .3 * Math.min(sstep(kLeave, .3, .9), 1 - sstep(kArr, .6, 1));
        colG = lockE * sstep(kArr, .8, 1); } }
    const sc = st[clamp(j, 0, 6)].sc;
    orb.visible = vis > 0; orb.position.copy(pos); orb.scale.setScalar(sc);
    orbCore.scale.setScalar(Math.max(core, .0001) * (1 + Math.sin(t * 1.8) * .06)); orbShell.scale.setScalar(Math.max(shellR, .0001)); orbShell.visible = shellR > .01;
    coreMat.color.copy(AMBER).lerp(GREEN, colG); orbGlow.material.color.setRGB(1.4, .8, .3).lerp(new THREE.Color(.4, 1.4, .8), colG);
    orbGlow.scale.setScalar(core * 8 + Math.sin(travel * Math.PI) * .8); orbGlow.material.opacity = .5 + Math.sin(travel * Math.PI) * .5;
    if (!trailInit) { trailPts.forEach((p) => p.copy(orb.position)); trailInit = true; }
    trailPts.pop(); trailPts.unshift(orb.position.clone());
    trailPts.forEach((p, i) => { tp.set([p.x, p.y, p.z], i * 3); const fade = (1 - i / TRAIL) * Math.sin(travel * Math.PI) * vis; tcol.set([2.4 * fade, 1.35 * fade, .5 * fade], i * 3); });
    tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true;

    const sp = orb.getWorldPosition(V()).project(camera), fo = farMat.uniforms.uFocus.value; if (orb.visible) { fo.x += ((sp.x + 1) / 2 - fo.x) * .08; fo.y += ((sp.y + 1) / 2 - fo.y) * .08; }
    composer.render();
    // if this computer can't keep up, lower sharpness, then the glow (not during the first frames: shaders compile then)
    if (!still && level < downgrades.length && frames > 150) { sampled++; if (dt > 1 / 45) slow++;
      if (sampled >= 90) { if (slow > 45) downgrades[level++](); sampled = slow = 0; } } };
  document.body.prepend(canvas);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add("on"));
  return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("pointermove", onPointer); renderer.dispose(); canvas.remove(); };
}
