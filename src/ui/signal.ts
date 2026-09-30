import { reducedMotion, clamp } from "./dom.ts";

/**
 * The 3D stage behind the page (user decision, Sept 30; it replaced the 3D town): one realistic piece of glass or metal
 * per chapter, standing for the chapter's idea without telling its story, plus one thread of light through the page.
 *
 *   title   a faceted glass crystal holding the message's amber light
 *   ch. 0   a stream of optical fibres leaving the right edge of the chapter's heading card and running off the right of the
 *           screen, light flowing along them left to right, nonstop (the internet)
 *   ch. 1   a sculpture of glass rods and steel joints (a lattice)
 *   ch. 2   the same sculpture leaning as you read (a crooked basis builds the same grid)
 *   ch. 3   a drop of liquid glass that trembles more as you read on (the shake)
 *   ch. 4   the gold chandelier of a quantum computer, rings pulsing from its chip (fading as you read)
 *   ch. 5   glass plates closing around the light into one sealed sphere, seams turning green (the lock)
 *
 * Each piece is held by an element on the page ([data-slot]; chapter 0's stream by its heading card) and moves with it as you scroll, like the rest of the page;
 * the camera never moves. Fine optical fibres run the whole length of the page behind everything, carrying pulses of
 * light from piece to piece, in a dark studio (the site has one theme: dark, user decision Sept 30).
 *
 * Three.js loads from the CDN like Scene 4 and is typed loosely here. If it can't load, the promise rejects and the page
 * keeps the flat hero lattice. Decorative only (aria-hidden). If the frame rate stays low it drops bloom, then sharpness.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export async function mountSignal(slots: HTMLElement[]): Promise<() => void> {
  const addon = (p: string): Promise<Any> => import(/* @vite-ignore */ `three/addons/${p}`);
  const [THREE, { RoomEnvironment }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoundedBoxGeometry }]: Any[] = await Promise.all([
    import("three"), addon("environments/RoomEnvironment.js"), addon("postprocessing/EffectComposer.js"), addon("postprocessing/RenderPass.js"),
    addon("postprocessing/UnrealBloomPass.js"), addon("postprocessing/OutputPass.js"), addon("geometries/RoundedBoxGeometry.js")]);

  const lite = matchMedia("(max-width: 820px), (pointer: coarse)").matches; // phones: fewer threads, lighter geometry
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const canvas: HTMLCanvasElement = renderer.domElement;
  canvas.className = "backdrop"; canvas.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 200); camera.position.set(0, 0, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; // a soft studio for the glass to reflect
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 8, 10); scene.add(key);
  const rim = new THREE.PointLight(0x7fb4ff, 30, 40); rim.position.set(8, -4, 6); scene.add(rim);

  const C = { ball: new THREE.Color(0xffb454), secret: new THREE.Color(0x3ddc97), gold: new THREE.Color(0xe7c46b) };
  const glass = (tint = 0xffffff, extra: Record<string, unknown> = {}): Any => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: .06, transmission: 1,
    thickness: 1.4, ior: 1.46, iridescence: .35, iridescenceIOR: 1.3, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.3, specularIntensity: 1, ...extra });
  const glow = (c: Any, k = 3): Any => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: .4 });
  const gold = new THREE.MeshStandardMaterial({ color: C.gold, metalness: 1, roughness: .18, envMapIntensity: 1.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: .25 });
  const V = (x: number, y: number, z: number): Any => new THREE.Vector3(x, y, z);
  type Tick = (t: number, p: number) => void;
  const pieces: Record<string, Any> = {};

  // ---------- the pieces (each about 2–3 units across, built around its own centre) ----------
  { // title: a faceted crystal with the message's light caught inside
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), glass(0xffffff, { thickness: 2.2, iridescence: .6, envMapIntensity: .7, specularIntensity: .6 })); g.add(gem);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), glow(C.ball, 1.6)); g.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.95, .012, 8, 160), steel); halo.rotation.x = 1.2; g.add(halo);
    g.userData.tick = ((t, p) => { gem.rotation.set(t * .15 + p * 2, t * .22, 0); core.rotation.y = -t; halo.rotation.z = t * .1; }) as Tick;
    pieces.key = g; }
  /** A sculpture of glass rods and steel joints: every rod one step along an arrow. shape(M) places it through a 3×3 matrix. */
  const rodLattice = (n = 3, s = .8): Any => {
    const g = new THREE.Group(), rodG = new THREE.CylinderGeometry(.035, .035, s, 10), jointG = new THREE.SphereGeometry(.075, 16, 12), rm = glass(0xe8f1ff, { thickness: .3 });
    const joints: [Any, Any][] = [], rods: [Any, Any, Any][] = [], h = (n - 1) / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) { const p = V(i - h, j - h, k - h);
      const jm = new THREE.Mesh(jointG, steel); g.add(jm); joints.push([jm, p]);
      for (const d of [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)]) { const q = d.add(p); if (Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z)) > h + .01) continue;
        const r = new THREE.Mesh(rodG, rm); g.add(r); rods.push([r, p, q]); } }
    const up = V(0, 1, 0);
    g.userData.shape = (M: Any) => { const w = (p: Any) => p.clone().applyMatrix3(M).multiplyScalar(s);
      for (const [m, p] of joints) m.position.copy(w(p));
      for (const [r, a, b] of rods) { const A = w(a), B = w(b), d = B.clone().sub(A); r.position.copy(A).add(B).multiplyScalar(.5); r.scale.y = d.length() / s; r.quaternion.setFromUnitVectors(up, d.normalize()); } };
    g.userData.shape(new THREE.Matrix3()); return g; };
  { const g = rodLattice(); g.userData.tick = ((t, p) => { g.rotation.set(.5 + p * .6, t * .18 + p * 1.5, 0); }) as Tick; pieces.lattice = g; }
  { // chapter 2: the same sculpture leans; the joints keep their grid, the rods turn crooked
    const g = rodLattice(), M = new THREE.Matrix3();
    g.userData.tick = ((t, p) => { const k = Math.sin(clamp((p - .15) / .6, 0, 1) * Math.PI / 2) * .9; M.set(1, k, 0, 0, 1, k * .5, 0, 0, 1); g.userData.shape(M); g.rotation.set(.45, t * .15 - .6, 0); }) as Tick;
    pieces.shear = g; }
  { // chapter 3: a drop of liquid glass that trembles more as you read on
    const geo = new THREE.IcosahedronGeometry(1.25, lite ? 20 : 40), base = Float32Array.from(geo.attributes.position.array as Float32Array), g = new THREE.Group();
    g.add(new THREE.Mesh(geo, glass(0xffffff, { thickness: 2.4, iridescence: .8, dispersion: 3 })));
    const core = new THREE.Mesh(new THREE.SphereGeometry(.18, 20, 14), glow(C.ball, 2.5)); g.add(core);
    const v = V(0, 0, 0);
    g.userData.tick = ((t, p) => { const amp = .04 + p * .16, pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromArray(base, i * 3); const n = Math.sin(v.x * 3.1 + t * 2.1) * Math.sin(v.y * 2.7 - t * 1.7) + Math.sin(v.z * 3.7 + t * 1.3) * .6; v.multiplyScalar(1 + n * amp); pos.setXYZ(i, v.x, v.y, v.z); }
      pos.needsUpdate = true; geo.computeVertexNormals(); core.position.set(Math.sin(t * 3.1) * p * .25, Math.cos(t * 2.3) * p * .25, 0); g.rotation.y = t * .1; }) as Tick;
    pieces.drop = g; }
  { // chapter 4: the gold chandelier of a quantum computer: cold plates stepping down, copper cables wound between them
    const g = new THREE.Group(), plates = [1.25, 1.05, .88, .72, .58], copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: .3 });
    plates.forEach((r, i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .08, 64), gold); d.position.y = 1.3 - i * .62; g.add(d);
      if (i < plates.length - 1) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + i * .3, rr = plates[i + 1] * .82;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .62, 8), gold); rod.position.set(Math.cos(a) * rr, 1.3 - i * .62 - .31, Math.sin(a) * rr); g.add(rod); } });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, pts: Any[] = [];
      for (let s = 0; s <= 24; s++) { const y = 1.3 - s / 24 * 2.5, rr = 1.1 - s / 24 * .6 + Math.sin(s * .9 + k) * .06; pts.push(V(Math.cos(a + s * .12) * rr, y, Math.sin(a + s * .12) * rr)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .018, 6), copper)); }
    const chip = new THREE.Mesh(new RoundedBoxGeometry(.5, .08, .5, 3, .02), glow(0x9ab8ff, 2.5)); chip.position.y = -1.3; g.add(chip);
    const rings: Any[] = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.6, .008, 6, 96), new THREE.MeshBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.rotation.x = Math.PI / 2; r.position.y = -1.34; g.add(r); rings.push(r); }
    g.userData.tick = ((t, p) => { g.rotation.y = t * .25; rings.forEach((r, i) => { const k = (t * .35 + i / 3) % 1; r.scale.setScalar(.3 + k * 2.6); r.material.opacity = (1 - k) * .8 * (1 - p * .7); }); }) as Tick;
    pieces.quantum = g; }
  { // chapter 5: glass plates close around the light into one sealed sphere, the seams turning green
    const g = new THREE.Group(), ico = new THREE.IcosahedronGeometry(1.3, 1) /* (already one triangle per face) */, P = ico.attributes.position;
    const pm = glass(0xf2fff8, { thickness: .5, iridescence: .5, side: THREE.DoubleSide }), seam = new THREE.LineBasicMaterial({ color: C.secret, transparent: true, opacity: .9 });
    const plates: [Any, Any, Any, Any][] = [];
    for (let f = 0; f < P.count; f += 3) { const a = V(0, 0, 0).fromBufferAttribute(P, f), b = V(0, 0, 0).fromBufferAttribute(P, f + 1), c = V(0, 0, 0).fromBufferAttribute(P, f + 2);
      const mid = a.clone().add(b).add(c).divideScalar(3), shape = new THREE.BufferGeometry().setFromPoints([a, b, c].map((q) => q.clone().sub(mid).multiplyScalar(.96)));
      shape.computeVertexNormals(); const holder = new THREE.Group(); holder.add(new THREE.Mesh(shape, pm), new THREE.LineLoop(shape, seam)); holder.position.copy(mid); g.add(holder);
      plates.push([holder, mid.clone(), mid.clone().normalize().multiplyScalar(2.6 + (f % 7) * .25), new THREE.Euler((f % 5) - 2, (f % 3) - 1, (f % 4) - 1.5)]); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(.32, 32, 20), glow(C.ball, 2)); g.add(core);
    g.userData.tick = ((t, p) => { const e = 1 - Math.pow(1 - clamp((p - .05) / .6, 0, 1), 3);
      for (const [h, home, away, rot] of plates) { h.position.lerpVectors(away, home, e); h.rotation.set(rot.x * (1 - e), rot.y * (1 - e), rot.z * (1 - e)); }
      seam.opacity = .2 + e * .8; core.material.emissive.copy(C.ball).lerp(C.secret, e); g.rotation.y = t * .12; }) as Tick;
    pieces.shield = g; }
  // the holder follows the slot and the cursor; the piece moves on its own inside it
  const holders: Record<string, Any> = {};
  for (const [k, g] of Object.entries(pieces)) { const h = new THREE.Group(); h.add(g); h.visible = false; scene.add(h); holders[k] = h; }

  // ---------- chapter 0: the fibre stream, from the heading card's right edge to past the right of the screen ----------
  const streamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSeed; attribute vec3 aCol; varying vec2 vUv; varying float vSeed; varying vec3 vCol;
      void main() { vUv = uv; vSeed = aSeed; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vSeed; varying vec3 vCol;
      void main() { float x = vUv.x * 7.0 - uTime * (0.55 + vSeed * 0.35) + vSeed * 11.0; // pulses travel from the card outward
        float pulse = pow(max(0.0, 1.0 - fract(x) * 4.0), 2.5) * step(0.35, fract(floor(x) * 0.618 + vSeed * 3.1));
        float glassLine = 0.16 + 0.1 * sin(vUv.y * 6.283), fadeIn = smoothstep(0.0, 0.012, vUv.x);
        gl_FragColor = vec4((vec3(0.62, 0.68, 0.78) * glassLine + vCol * pulse * 2.2) * fadeIn, (0.3 + pulse) * fadeIn); }` });
  const stream = new THREE.Group(); scene.add(stream);
  const streamSlot = slots.find((s) => s.dataset.slot === "fibre"), streamCard = streamSlot?.closest(".chapter-open")?.querySelector<HTMLElement>(".chapter-head") ?? null;
  function buildStream() {
    stream.traverse((o: Any) => o.geometry?.dispose()); stream.clear();
    if (!streamCard) return;
    const r = streamCard.getBoundingClientRect(), len = (innerWidth - r.right) * unit + 3, band = Math.min(innerHeight * unit * .75, 7), start = r.height * unit * .32;
    const N = lite ? 26 : 46, cols = [C.ball, C.secret, new THREE.Color(0x7fb4ff)];
    for (let i = 0; i < N; i++) {
      const lane = i / (N - 1) - .5, y0 = lane * start, pts: Any[] = [];
      for (let k = 0; k <= 40; k++) { const u = k / 40, e = 1 - Math.pow(1 - Math.min(1, u * 1.6), 3); // open out quickly, then run level
        pts.push(V(u * len, y0 * (1 - e) + lane * band * e + Math.sin(u * 4 + i) * .25 * e, -e * (i % 4) * .6)); }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), lite ? 120 : 220, .016 + (i % 3) * .006, 5), n = geo.attributes.position.count;
      const c = cols[i % 7 === 0 ? 1 : i % 3 === 0 ? 2 : 0], rgb = new Float32Array(n * 3); for (let j = 0; j < n; j++) rgb.set([c.r, c.g, c.b], j * 3);
      geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(n).fill((i * .37) % 1), 1)); geo.setAttribute("aCol", new THREE.BufferAttribute(rgb, 3));
      stream.add(new THREE.Mesh(geo, streamMat)); } }

  // ---------- the thread: optical fibres the whole length of the page, weaving past every piece ----------
  const threadMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: C.ball }, uB: { value: new THREE.Color(0x7fb4ff) } },
    vertexShader: "attribute float aSeed; varying vec2 vUv; varying float vSeed; void main() { vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv; varying float vSeed;
      void main() { float x = vUv.x * 60.0 - uTime * (0.6 + vSeed * 0.5) + vSeed * 17.0;
        float pulse = pow(max(0.0, 1.0 - fract(x) * 3.0), 3.0) * step(0.55, fract(floor(x) * 0.618 + vSeed));
        vec3 pc = mix(uA, uB, step(0.5, fract(vSeed * 7.0)));
        gl_FragColor = vec4(uB * 0.18 + pc * pulse * 1.6, 0.35 + pulse * 0.65); }` });
  const threads = new THREE.Group(); scene.add(threads);
  let unit = 1; // world units per CSS pixel on the plane the pieces sit on
  function buildThreads() {
    threads.children.forEach((m: Any) => m.geometry.dispose()); threads.clear();
    const pageH = document.documentElement.scrollHeight, n = lite ? 5 : 9, half = innerHeight * unit;
    const anchors = slots.map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0) // (a slot hidden on this screen isn't on the thread's path)
      .map((r) => [(r.left + r.width / 2 - innerWidth / 2) * unit, -(r.top + scrollY + r.height / 2) * unit]);
    for (let i = 0; i < n; i++) {
      const pts = [V(anchors[0][0] + (i - n / 2) * .4, half, -2 - i * .3)];
      // one loose ribbon: it passes just behind each piece, fanned out a little, and drifts across the page between them
      anchors.forEach(([x, y], j) => { const z = -2 - (i % 3) * .9, next = anchors[j + 1];
        pts.push(V(x + (i - n / 2) * .32, y, z));
        if (next) pts.push(V((x + next[0]) / 2 + Math.sin(j * 1.3 + .6) * 2.4 + (i - n / 2) * .45, (y + next[1]) / 2, z - 1)); });
      pts.push(V(0, -(pageH + innerHeight) * unit, -2));
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), lite ? 500 : 900, .012 + (i % 3) * .006, 5);
      geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(i / n), 1));
      threads.add(new THREE.Mesh(geo, threadMat)); } }

  // ---------- post-processing ----------
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .5, .86); composer.addPass(bloom); composer.addPass(new OutputPass());

  // ---------- the dark studio ----------
  scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#05070d");
  bloom.strength = .5; bloom.threshold = .86; key.intensity = 1.6; rim.intensity = 40;

  // ---------- layout: each piece sits in its slot; the page moves, the camera doesn't ----------
  let W = 0, H = 0, mx = 0, my = 0, pageH = 0, rebuild = 0;
  const onPointer = (e: PointerEvent) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; };
  addEventListener("pointermove", onPointer, { passive: true });
  const resize = () => { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    unit = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / H; buildThreads(); buildStream(); pageH = document.documentElement.scrollHeight; };
  // the page keeps growing while scenes and fonts load: rebuild the thread once it settles
  const ro = new ResizeObserver(() => { clearTimeout(rebuild); rebuild = window.setTimeout(resize, 250); }); ro.observe(document.body); resize();

  let raf = 0, t = 0, last = performance.now(), slow = 0, sampled = 0, level = 0, frames = 0;
  const downgrades = [() => { bloom.enabled = false; }, () => { renderer.setPixelRatio(1); composer.setPixelRatio(1); }];
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, .05); last = now; // (a frame's timestamp can be a little earlier than the last one)
    const still = reducedMotion(); if (!still) t += dt;
    if (++frames % 60 === 0 && Math.abs(document.documentElement.scrollHeight - pageH) > 40) { pageH = document.documentElement.scrollHeight; buildThreads(); }
    threadMat.uniforms.uTime.value = t * 1.2;
    threads.position.y = (scrollY + H / 2) * unit;
    streamMat.uniforms.uTime.value = t;
    if (streamCard) { const r = streamCard.getBoundingClientRect(); stream.visible = r.bottom > -H * .5 && r.top < H * 1.5;
      // the fibres start exactly at the card's right edge, halfway down it
      stream.position.set((r.right - W / 2) * unit, -(r.top + r.height / 2 - H / 2) * unit, 0); stream.rotation.set(my * .06, mx * .08, 0); }
    for (const s of slots) { const name = s.dataset.slot!, g = pieces[name], h = holders[name]; if (!g) continue;
      const r = s.getBoundingClientRect(), on = r.width > 0 && r.bottom > -H * .3 && r.top < H * 1.3;
      h.visible = on; if (!on) continue;
      const p = clamp((H - r.top) / (H + r.height), 0, 1); // 0 as the slot enters the screen, 1 as it leaves
      h.position.set((r.left + r.width / 2 - W / 2) * unit + mx * .4, -(r.top + r.height / 2 - H / 2) * unit - my * .3, 0);
      h.scale.setScalar(r.width * unit / 3.2); h.rotation.set(my * .25, mx * .35, 0); g.userData.tick(t, p); }
    composer.render();
    // if this computer can't keep up, give up bloom, then sharpness (not during the first frames: shaders compile then)
    if (!still && level < downgrades.length && frames > 150) { sampled++; if (dt > 1 / 45) slow++;
      if (sampled >= 90) { if (slow > 45) downgrades[level++](); sampled = slow = 0; } }
  };
  document.body.prepend(canvas);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add("on"));
  return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("pointermove", onPointer); renderer.dispose(); canvas.remove(); };
}
