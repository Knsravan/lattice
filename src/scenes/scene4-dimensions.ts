import {
  showcaseBases, pointsInBall, pointsInBox, closestVectorExact, lll, rotationMatrix4, applyMatrix4, project4to3, unrotate4,
} from "../core/index.ts";
import type { Basis, Vec, Angles4, LLLStep } from "../core/index.ts";
import type * as T from "three";
import { el, runWhileVisible, easeOut, reducedMotion, palette } from "../ui/dom.ts";
import { scene4 as copy } from "../ui/copy.ts";
import { createAttackChart } from "./scene4-chart.ts";
import { startSweep } from "./scene4-sweep.ts";

type Dim = 2 | 3 | 4;
type Three = typeof import("three");

const RADIUS: Record<Dim, number> = { 2: 4.2, 3: 3.0, 4: 2.4 }; // the core of the grid: where balls land, how 4D fades with w
const FILL: Record<3 | 4, number> = { 3: 5.8, 4: 3.4 }; // 3D/4D: the grid carries on past the box's edges, fading with distance
const BOX2: [number, number] = [7.2, 5.4]; // 2D: the whole face-on view (the camera sees about ±6.4 × ±4.8), with a margin
const DOT = 0.07;
const STEP_S = 0.12; // one LLL step per ~100 ms
const PROJ_DIST = 7; // 4D camera distance along w
const GRID_CHOICES = [5, 20, 50]; // random grids per dimension
const CLIMB_CHOICES = [40, 60]; // highest dimension on the chart
const sweepDims = (top: number) => Array.from({ length: top / 2 }, (_, i) => 2 + 2 * i); // 2, 4, …, top
const BUDGET_MS = 2000;
const CAMERA: Record<Dim, [number, number, number]> = { 2: [0, 0, 11.5], 3: [-5, 3.2, 5.8], 4: [-5, 3.2, 5.8] };

export function mountScene4(root: HTMLElement): () => void {
  // ---------- DOM ----------
  const readout = el("div", { class: "readout", text: copy.labels.loading });
  const stage = el("div", { class: "stage" }, readout);
  const dimButtons = copy.labels.dims.map((label, i) =>
    el("button", { type: "button", class: "seg" + (i === 0 ? " active" : ""), "aria-pressed": String(i === 0), text: label, onClick: () => setDim((i + 2) as Dim) }),
  );
  const runBtn = el("button", { type: "button", class: "btn", text: copy.labels.run, onClick: () => runAttack() });
  const resetBtn = el("button", { type: "button", class: "btn", text: copy.labels.reset, onClick: () => resetArrows() });
  const controls = el("div", { class: "controls" }, el("div", { class: "segmented dims", role: "group", "aria-label": copy.labels.dimsGroup }, ...dimButtons), runBtn, resetBtn);
  const chartCanvas = el("canvas", { class: "chart-canvas", "aria-label": copy.chart.title });
  const chartStatus = el("div", { class: "chart-status", text: copy.chart.idle });
  let trials = 20, top = 40;
  const choice = <T extends number>(label: string, values: T[], current: T, fmt: (v: T) => string, set: (v: T) => void) => {
    const btns = values.map((v) => el("button", {
      type: "button", class: "seg" + (v === current ? " active" : ""), "aria-pressed": String(v === current), text: fmt(v),
      onClick: () => {
        btns.forEach((b, i) => { b.classList.toggle("active", values[i] === v); b.setAttribute("aria-pressed", String(values[i] === v)); });
        set(v);
        sweep(); // a new setting re-runs the chart straight away
      },
    }));
    return el("span", { class: "chart-choice" }, label, el("span", { class: "segmented dims", role: "group", "aria-label": label }, ...btns));
  };
  const chartControls = el("div", { class: "chart-controls" },
    choice(copy.chart.grids, GRID_CHOICES, trials, String, (v) => { trials = v; }),
    choice(copy.chart.climb, CLIMB_CHOICES, top, (v) => v + copy.chart.dimension, (v) => { top = v; }));
  const chartPanel = el("div", { class: "chart-panel" }, chartCanvas, chartStatus, chartControls);
  const card = (c: { name: string; body: string; verdict: string }, verdictClass: string) =>
    el("div", { class: "qcard" },
      el("h4", { text: c.name }),
      el("p", { text: c.body }),
      el("p", { class: "qverdict " + verdictClass, text: c.verdict }));
  const quantumPanel = el("div", { class: "kpanel qpanel" },
    el("h3", { text: copy.quantum.title }),
    el("div", { class: "qcards" }, card(copy.quantum.shor, "public"), card(copy.quantum.grover, "secret")));
  root.append(stage, controls, chartPanel, quantumPanel);

  // ---------- chart (works without Three.js) ----------
  const chart = createAttackChart(chartCanvas);
  chart.reset(sweepDims(top), trials);
  let sweepSeed = 1;
  let cancelSweep: (() => void) | null = null;
  let slowest = 0;
  function sweep() {
    cancelSweep?.();
    const dims = sweepDims(top), n = trials;
    chart.reset(dims, n);
    slowest = 0;
    let lastDim = dims[0];
    let fallback = false;
    const status = () => { chartStatus.textContent = (fallback ? copy.chart.noWorker + " " : "") + copy.chart.running.replace("{trials}", String(n)).replace("{d}", String(lastDim)); };
    status();
    cancelSweep = startSweep(
      { dims, trials: n, seed: sweepSeed++, budgetMs: BUDGET_MS },
      (m) => { chart.add(m.result); slowest = Math.max(slowest, m.ms); lastDim = m.result.dim; status(); },
      () => {
        cancelSweep = null;
        chartStatus.textContent = copy.chart.done.replace("{trials}", String(n)).replace("{ms}", String(Math.max(1, Math.ceil(slowest))));
      },
      () => { fallback = true; },
    );
  }
  const stopChart = runWhileVisible(chartPanel, (dt) => chart.draw(dt));

  // ---------- lattice state (pure data; Three.js only draws it) ----------
  let dim: Dim = 2;
  let pendingDim: Dim | null = null;
  let fade = 0; // 0..1: dots and arrows grow in after a dimension change
  let good: Basis = showcaseBases(2).good;
  let bad: Basis = showcaseBases(2).bad;
  /** The dots to show: they fill the whole box, not just a patch in the middle (user request). */
  const dotsFor = (d: Dim, basis: Basis): Vec[] => (d === 2 ? pointsInBox(basis, BOX2) : pointsInBall(basis, FILL[d], 1500)).map((p) => p.point);
  let dots: Vec[] = dotsFor(2, good);
  let shown: Basis = bad.map((v) => v.slice()); // the arrows as currently drawn
  let arrowTint = 0; // 0 = red (bad), 1 = green (good)
  let anim: { from: Basis; to: Basis; t: number; dur: number; tintFrom: number; tintTo: number } | null = null;
  let attack: { steps: LLLStep[]; idx: number } | null = null;
  let ball: { at: Vec; nearest: Vec; born: number } | null = null;
  let angles: Angles4 = { xy: 0, xz: 0, xw: 0.4, yz: 0, yw: 0.2, zw: 0 };
  let time = 0;

  function setDim(d: Dim) {
    if (d === dim && pendingDim === null) return;
    pendingDim = d;
    dimButtons.forEach((b, i) => { b.classList.toggle("active", i + 2 === d); b.setAttribute("aria-pressed", String(i + 2 === d)); });
    attack = null;
    anim = null;
    ball = null;
    runBtn.disabled = false;
    view?.flyTo(CAMERA[d]);
  }
  function applyDim(d: Dim) {
    dim = d;
    ({ good, bad } = showcaseBases(d));
    dots = dotsFor(d, good);
    shown = bad.map((v) => v.slice());
    arrowTint = 0;
    readout.textContent = copy.hint;
    readout.classList.remove("warn");
  }
  function morph(to: Basis, dur: number, tintTo: number) {
    anim = { from: shown.map((v) => v.slice()), to, t: 0, dur, tintFrom: arrowTint, tintTo };
  }
  function runAttack() {
    if (!view) { sweep(); return; } // no 3D view: the chart still works
    if (pendingDim !== null) return;
    const { trace } = lll(bad);
    attack = { steps: trace, idx: 0 };
    shown = bad.map((v) => v.slice());
    arrowTint = 0;
    runBtn.disabled = true;
    nextStep();
    sweep();
  }
  function nextStep() {
    if (!attack) return;
    const { steps, idx } = attack;
    if (idx >= steps.length) {
      readout.textContent = copy.readout.done.replace("{n}", String(steps.length)).replace("{d}", String(dim));
      attack = null;
      runBtn.disabled = false;
      return;
    }
    const s = steps[idx];
    readout.textContent = (s.type === "reduce"
      ? copy.readout.reduce.replace("{i}", String(s.i + 1)).replace("{j}", String(s.j + 1))
      : copy.readout.swap.replace("{a}", String(s.i + 1)).replace("{b}", String(s.i + 2))
    ).replace("{s}", String(idx + 1)).replace("{n}", String(steps.length));
    morph(s.basis, STEP_S, (idx + 1) / steps.length);
    attack.idx++;
  }
  function resetArrows() {
    if (pendingDim !== null) return;
    attack = null;
    runBtn.disabled = false;
    morph(bad.map((v) => v.slice()), 0.5, 0);
    readout.textContent = copy.readout.reset;
  }
  function throwBall(p: Vec) {
    const nearest = closestVectorExact(good, p).point;
    ball = { at: p, nearest, born: time };
    const dist = Math.hypot(...p.map((x, i) => x - nearest[i]));
    if (!attack) readout.textContent = copy.readout.ball.replace("{dist}", dist.toFixed(2));
  }

  /** Where a lattice vector appears in 3D, plus how bright/big it should be (4D fades with w). */
  let rot4 = rotationMatrix4(angles);
  function place(v: Vec): { p: [number, number, number]; bright: number; size: number } {
    if (v.length === 2) return { p: [v[0], v[1], 0], bright: 1, size: 1 };
    if (v.length === 3) { const far = Math.max(0, Math.hypot(v[0], v[1], v[2]) - RADIUS[3]) / (FILL[3] - RADIUS[3]); return { p: [v[0], v[1], v[2]], bright: 1 - far * .8, size: 1 }; }
    const r = applyMatrix4(rot4, v);
    const { p, scale } = project4to3(r, PROJ_DIST);
    const R = RADIUS[4];
    const far = Math.max(0, Math.hypot(...v) - R) / (FILL[4] - R); // the outer dots fade, like in 3D
    const bright = (0.18 + 0.82 * Math.min(1, Math.max(0, (r[3] + R) / (2 * R)))) * (1 - far * .7);
    return { p: [p[0], p[1], p[2]], bright, size: scale };
  }

  // ---------- per-frame state update (independent of Three.js) ----------
  function update(dt: number) {
    time += dt;
    if (pendingDim !== null) {
      fade = Math.max(0, fade - dt / 0.25);
      if (fade === 0) { applyDim(pendingDim); pendingDim = null; }
    } else fade = Math.min(1, fade + dt / 0.35);
    if (dim === 4 && !reducedMotion()) {
      angles = { ...angles, xw: angles.xw + dt * 0.35, yw: angles.yw + dt * 0.22, zw: angles.zw + dt * 0.08 };
      rot4 = rotationMatrix4(angles);
    }
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      const k = easeOut(anim.t);
      const a = anim;
      shown = a.from.map((v, i) => v.map((x, j) => x + (a.to[i][j] - x) * k));
      arrowTint = a.tintFrom + (a.tintTo - a.tintFrom) * k;
      if (anim.t >= 1) { anim = null; nextStep(); }
    }
  }

  // ---------- Three.js view (loaded from the CDN on demand) ----------
  let view: View | null = null;
  let stopView: (() => void) | null = null;
  let disposed = false;
  Promise.all([import("three"), import("three/addons/controls/OrbitControls.js")])
    .then(([THREE, { OrbitControls }]) => {
      if (disposed) return;
      view = createView(THREE, OrbitControls);
      readout.textContent = copy.hint;
      stopView = runWhileVisible(stage, (dt) => { update(dt); view!.render(dt); });
    })
    .catch(() => {
      readout.textContent = copy.labels.failed;
      readout.classList.add("warn");
    });

  interface View {
    render(dt: number): void;
    flyTo(p: [number, number, number]): void;
    dispose(): void;
  }

  function createView(THREE: Three, Orbit: typeof import("three/addons/controls/OrbitControls.js").OrbitControls): View {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = "scene-canvas";
    renderer.domElement.setAttribute("aria-label", copy.labels.canvas);
    stage.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
    camera.position.set(...CAMERA[2]);
    const controls = new Orbit(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 20;
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(4, 8, 6);
    scene.add(sun);

    // The look matches the 2D diagrams and the 3D stage: glass beads, beams of light, a glowing orb.
    /** A soft round sprite drawn once on a canvas: a glass bead, a glow, or a ring of light. */
    const sprite = (paint: (g: CanvasRenderingContext2D, R: number) => void) => {
      const c = document.createElement("canvas"); c.width = c.height = 128; paint(c.getContext("2d")!, 64); return new THREE.CanvasTexture(c);
    };
    const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
    const beadTex = sprite((g, R) => { // halo, then a body lit from the top-left
      const halo = g.createRadialGradient(R, R, R * .22, R, R, R); halo.addColorStop(0, hexA(palette.dotBright, .22)); halo.addColorStop(1, hexA(palette.dotBright, 0));
      g.fillStyle = halo; g.fillRect(0, 0, R * 2, R * 2);
      const r = R / 2.6, body = g.createRadialGradient(R - r * .35, R - r * .4, r * .1, R, R, r);
      body.addColorStop(0, "#fff"); body.addColorStop(.35, palette.dotBright); body.addColorStop(1, hexA(palette.dot, .9));
      g.fillStyle = body; g.beginPath(); g.arc(R, R, r, 0, Math.PI * 2); g.fill(); });
    const glowTex = sprite((g, R) => { const h = g.createRadialGradient(R, R, 0, R, R, R);
      h.addColorStop(0, "rgba(255,255,255,1)"); h.addColorStop(.25, "rgba(255,255,255,.55)"); h.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = h; g.fillRect(0, 0, R * 2, R * 2); });
    const ringTex = sprite((g, R) => { g.strokeStyle = hexA(palette.secret, .25); g.lineWidth = 16; g.beginPath(); g.arc(R, R, R * .62, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = palette.secret; g.lineWidth = 5; g.shadowColor = palette.secret; g.shadowBlur = 12; g.beginPath(); g.arc(R, R, R * .62, 0, Math.PI * 2); g.stroke(); });

    // dots: glass-bead sprites, sized by distance like real spheres, dimmed and shrunk in 4D by their distance along w
    const MAX = 1500;
    const dotPos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3), dotSize = new THREE.BufferAttribute(new Float32Array(MAX), 1), dotBright = new THREE.BufferAttribute(new Float32Array(MAX), 1);
    const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute("position", dotPos); dotGeo.setAttribute("aSize", dotSize); dotGeo.setAttribute("aBright", dotBright);
    const dotMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { uMap: { value: beadTex }, uProj: { value: 1 } },
      vertexShader: `attribute float aSize; attribute float aBright; uniform float uProj; varying float vBright;
        void main() { vBright = aBright; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * 2.6 * 2.0 * uProj / -mv.z; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vBright;
        void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(t.rgb * mix(0.3, 1.0, vBright), t.a * mix(0.35, 1.0, vBright)); }` });
    const dotPoints = new THREE.Points(dotGeo, dotMat); dotPoints.frustumCulled = false; scene.add(dotPoints);
    /** A single glowing point (a spark, a halo, a ring) of a given colour, `px` across at one unit away. */
    const glowPoint = (tex: T.Texture, color: string, additive = true, onTop = false) => {
      const geo = new THREE.BufferGeometry(), pos = new THREE.BufferAttribute(new Float32Array(3), 3); geo.setAttribute("position", pos);
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: !onTop, ...(additive ? { blending: THREE.AdditiveBlending } : {}),
        uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(color) }, uSize: { value: .3 }, uProj: { value: 1 }, uAlpha: { value: 1 } },
        vertexShader: `uniform float uSize, uProj; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uProj / -mv.z; }`,
        fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha;
          void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(mix(uColor, vec3(1.0), t.r * t.r * 0.6) * t.a, t.a * uAlpha); }` });
      const pt = new THREE.Points(geo, mat); pt.frustumCulled = false;
      return { pt, mat, at(x: number, y: number, z: number) { pos.setXYZ(0, x, y, z); pos.needsUpdate = true; } };
    };
    const projUniforms: { value: unknown }[] = [dotMat.uniforms.uProj];

    // arrows: a beam of light (coloured core, white centre, soft halo), a glowing head, and a spark running tail to tip
    const red = new THREE.Color(palette.attacker), green = new THREE.Color(palette.secret), tint = new THREE.Color();
    const UP = new THREE.Vector3(0, 1, 0);
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };
    const arrows = [0, 1, 2, 3].map((k) => {
      const mat = new THREE.MeshBasicMaterial({ color: palette.attacker });
      const haloMat = new THREE.MeshBasicMaterial({ color: palette.attacker, opacity: .22, ...additive });
      const white = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: .7, transparent: true });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), mat);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 6), white);
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 12), haloMat);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1, 16), mat);
      const headHalo = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1, 16), haloMat);
      const spark = glowPoint(glowTex, palette.attacker); spark.mat.uniforms.uSize.value = .55; projUniforms.push(spark.mat.uniforms.uProj);
      const g = new THREE.Group();
      g.add(halo, shaft, core, headHalo, head, spark.pt);
      scene.add(g);
      const dir = new THREE.Vector3();
      let len = 0;
      return {
        tint(c: T.Color) { mat.color.lerpColors(c, c, 0); haloMat.color.lerpColors(c, c, 0); (spark.mat.uniforms.uColor.value as T.Color).lerpColors(c, c, 0); },
        set(tip: [number, number, number] | null) {
          if (!tip) { g.visible = false; return; }
          dir.set(...tip);
          len = dir.length();
          g.visible = len > 1e-3;
          if (!g.visible) return;
          dir.multiplyScalar(1 / len);
          g.quaternion.setFromUnitVectors(UP, dir);
          const hl = Math.min(0.28, len * 0.45);
          for (const m of [shaft, core, halo]) { m.scale.set(1, len - hl, 1); m.position.set(0, (len - hl) / 2, 0); }
          for (const m of [head, headHalo]) { m.scale.set(1, hl, 1); m.position.set(0, len - hl / 2, 0); }
          const u = reducedMotion() ? .6 : (performance.now() / 1000 * .55 + k * .27) % 1;
          spark.at(0, (len - hl) * u, 0); spark.pt.visible = len > .5;
        },
      };
    });

    // ball (a glowing amber orb), the nearest dot (a ring of green light), and the line between them
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshBasicMaterial({ color: palette.ball, depthTest: false }));
    const ballGlow = glowPoint(glowTex, palette.ball, true, true); ballGlow.mat.uniforms.uSize.value = 1.8; projUniforms.push(ballGlow.mat.uniforms.uProj);
    const ring = glowPoint(ringTex, palette.secret, false, true); ring.mat.uniforms.uSize.value = .7; projUniforms.push(ring.mat.uniforms.uProj);
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new THREE.BufferAttribute(new Float32Array(6), 3);
    lineGeo.setAttribute("position", linePos);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: palette.ball, depthTest: false }));
    // the ball, its line and the ring always sit on top of the grid: they are what the reader follows
    for (const o of [ballMesh, ballGlow.pt, ring.pt, line]) o.renderOrder = 10;
    scene.add(ballMesh, ballGlow.pt, ring.pt, line);

    // camera flights between 2D (face-on) and 3D/4D (angled)
    let flight: { from: T.Vector3; to: T.Vector3; t: number } | null = null;
    const flyTo = (p: [number, number, number]) => {
      flight = { from: camera.position.clone(), to: new THREE.Vector3(...p), t: 0 };
    };

    // click (without dragging) throws a ball onto the plane through the origin facing the camera
    let down: { x: number; y: number; t: number } | null = null;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const normal = new THREE.Vector3();
    renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 500 || pendingDim !== null) return;
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (dim === 2) normal.set(0, 0, 1);
      else camera.getWorldDirection(normal);
      if (!raycaster.ray.intersectPlane(new THREE.Plane(normal, 0), hit)) return;
      const len = hit.length(), max = RADIUS[dim] * 0.8;
      if (len > max) hit.multiplyScalar(max / len);
      const p3: Vec = [hit.x, hit.y, hit.z];
      throwBall(dim === 2 ? [p3[0], p3[1]] : dim === 3 ? p3 : unrotate4([...p3, 0], angles));
    });

    const resize = () => {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // pixels per world unit at distance 1, for the sprites' sizes (the camera's field of view is 45°)
      const proj = h * renderer.getPixelRatio() / (2 * Math.tan(Math.PI / 8));
      for (const u of projUniforms) u.value = proj;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    function render(dt: number) {
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / 0.8);
        camera.position.lerpVectors(flight.from, flight.to, easeOut(flight.t));
        if (flight.t >= 1) flight = null;
      }
      controls.update();

      const g = easeOut(fade);
      const n = Math.min(dots.length, MAX);
      for (let i = 0; i < n; i++) {
        const { p, bright, size } = place(dots[i]);
        dotPos.setXYZ(i, ...p);
        dotSize.array[i] = Math.max(1e-4, DOT * size * g);
        dotBright.array[i] = bright;
      }
      dotGeo.setDrawRange(0, n);
      dotPos.needsUpdate = dotSize.needsUpdate = dotBright.needsUpdate = true;

      for (let i = 0; i < arrows.length; i++) {
        const a = arrows[i];
        if (i >= shown.length) { a.set(null); continue; }
        const { p } = place(shown[i]);
        a.set([p[0] * g, p[1] * g, p[2] * g]);
        a.tint(tint.lerpColors(red, green, arrowTint));
      }

      const showBall = ball !== null && ball.at.length === dim;
      ballMesh.visible = ballGlow.pt.visible = ring.pt.visible = line.visible = showBall;
      if (ball && showBall) {
        const age = time - ball.born;
        const b = place(ball.at).p, d = place(ball.nearest).p;
        ballMesh.position.set(...b);
        ballMesh.scale.setScalar(Math.max(1e-4, easeOut(age / 0.3)));
        ballGlow.at(...b); ballGlow.mat.uniforms.uAlpha.value = easeOut(age / 0.3);
        const reach = easeOut((age - 0.2) / 0.35);
        ring.at(...d);
        ring.pt.visible = reach >= 1;
        ring.mat.uniforms.uSize.value = .62 + (reducedMotion() ? 0 : Math.sin(time * 4) * .06); // a gentle pulse
        linePos.setXYZ(0, b[0], b[1], b[2]);
        linePos.setXYZ(1, b[0] + (d[0] - b[0]) * reach, b[1] + (d[1] - b[1]) * reach, b[2] + (d[2] - b[2]) * reach);
        linePos.needsUpdate = true;
      }
      renderer.render(scene, camera);
    }

    return {
      render,
      flyTo,
      dispose() { ro.disconnect(); controls.dispose(); renderer.dispose(); },
    };
  }

  return () => {
    disposed = true;
    cancelSweep?.();
    stopChart();
    stopView?.();
    view?.dispose();
    root.innerHTML = "";
  };
}
