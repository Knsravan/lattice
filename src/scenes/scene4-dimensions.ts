import {
  showcaseBases, pointsInBall, closestVectorExact, lll, rotationMatrix4, applyMatrix4, project4to3, unrotate4,
} from "../core/index.ts";
import type { Basis, Vec, Angles4, LLLStep } from "../core/index.ts";
import type * as T from "three";
import { el, runWhileVisible, easeOut, palette } from "../ui/dom.ts";
import { scene4 as copy } from "../ui/copy.ts";
import { createAttackChart } from "./scene4-chart.ts";
import { startSweep } from "./scene4-sweep.ts";

type Dim = 2 | 3 | 4;
type Three = typeof import("three");

const RADIUS: Record<Dim, number> = { 2: 4.2, 3: 3.0, 4: 2.4 }; // window of dots per dimension
const DOT = 0.07;
const STEP_S = 0.12; // one LLL step per ~100 ms
const PROJ_DIST = 7; // 4D camera distance along w
const SWEEP_DIMS = Array.from({ length: 20 }, (_, i) => 2 + 2 * i); // 2, 4, …, 40
const SWEEP_TRIALS = 20;
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
  const chartPanel = el("div", { class: "chart-panel" }, chartCanvas, chartStatus);
  root.append(stage, controls, chartPanel);

  // ---------- chart (works without Three.js) ----------
  const chart = createAttackChart(chartCanvas);
  chart.reset(SWEEP_DIMS, SWEEP_TRIALS);
  let sweepSeed = 1;
  let cancelSweep: (() => void) | null = null;
  let slowest = 0;
  function sweep() {
    cancelSweep?.();
    chart.reset(SWEEP_DIMS, SWEEP_TRIALS);
    slowest = 0;
    let lastDim = SWEEP_DIMS[0];
    let fallback = false;
    const status = () => { chartStatus.textContent = (fallback ? copy.chart.noWorker + " " : "") + copy.chart.running.replace("{trials}", String(SWEEP_TRIALS)).replace("{d}", String(lastDim)); };
    status();
    cancelSweep = startSweep(
      { dims: SWEEP_DIMS, trials: SWEEP_TRIALS, seed: sweepSeed++, budgetMs: BUDGET_MS },
      (m) => { chart.add(m.result); slowest = Math.max(slowest, m.ms); lastDim = m.result.dim; status(); },
      () => {
        cancelSweep = null;
        chartStatus.textContent = copy.chart.done.replace("{trials}", String(SWEEP_TRIALS)).replace("{ms}", String(Math.max(1, Math.ceil(slowest))));
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
  let dots: Vec[] = pointsInBall(good, RADIUS[2]).map((p) => p.point);
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
    dots = pointsInBall(good, RADIUS[d]).map((p) => p.point);
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
    if (v.length === 3) return { p: [v[0], v[1], v[2]], bright: 1, size: 1 };
    const r = applyMatrix4(rot4, v);
    const { p, scale } = project4to3(r, PROJ_DIST);
    const R = RADIUS[4];
    const bright = 0.18 + 0.82 * Math.min(1, Math.max(0, (r[3] + R) / (2 * R)));
    return { p: [p[0], p[1], p[2]], bright, size: scale };
  }

  // ---------- per-frame state update (independent of Three.js) ----------
  function update(dt: number) {
    time += dt;
    if (pendingDim !== null) {
      fade = Math.max(0, fade - dt / 0.25);
      if (fade === 0) { applyDim(pendingDim); pendingDim = null; }
    } else fade = Math.min(1, fade + dt / 0.35);
    if (dim === 4) {
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

    // dots: one instanced sphere mesh, recoloured every frame (4D fades with w)
    const MAX = 800;
    const dotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX);
    scene.add(dotMesh);
    const dummy = new THREE.Object3D();
    const cDim = new THREE.Color(palette.bg), cDot = new THREE.Color(palette.dotBright), tmp = new THREE.Color();

    // arrows: cylinder shaft + cone head, one per basis vector
    const red = new THREE.Color(palette.attacker), green = new THREE.Color(palette.secret);
    const UP = new THREE.Vector3(0, 1, 0);
    const arrows = [0, 1, 2, 3].map(() => {
      const mat = new THREE.MeshBasicMaterial({ color: palette.attacker });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 10), mat);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1, 16), mat);
      const g = new THREE.Group();
      g.add(shaft, head);
      scene.add(g);
      const dir = new THREE.Vector3();
      return {
        mat,
        set(tip: [number, number, number] | null) {
          if (!tip) { g.visible = false; return; }
          dir.set(...tip);
          const len = dir.length();
          g.visible = len > 1e-3;
          if (!g.visible) return;
          dir.multiplyScalar(1 / len);
          g.quaternion.setFromUnitVectors(UP, dir);
          const hl = Math.min(0.28, len * 0.45);
          shaft.scale.set(1, len - hl, 1);
          shaft.position.set(0, (len - hl) / 2, 0);
          head.scale.set(1, hl, 1);
          head.position.set(0, len - hl / 2, 0);
        },
      };
    });

    // ball, nearest-dot highlight, and the line between them
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshLambertMaterial({ color: palette.ball }));
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshBasicMaterial({ color: palette.secret, wireframe: true }));
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new THREE.BufferAttribute(new Float32Array(6), 3);
    lineGeo.setAttribute("position", linePos);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: palette.ball }));
    scene.add(ballMesh, ring, line);

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
        dummy.position.set(...p);
        dummy.scale.setScalar(Math.max(1e-4, DOT * size * g));
        dummy.updateMatrix();
        dotMesh.setMatrixAt(i, dummy.matrix);
        dotMesh.setColorAt(i, tmp.lerpColors(cDim, cDot, bright));
      }
      dotMesh.count = n;
      dotMesh.instanceMatrix.needsUpdate = true;
      if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;

      for (let i = 0; i < arrows.length; i++) {
        const a = arrows[i];
        if (i >= shown.length) { a.set(null); continue; }
        const { p } = place(shown[i]);
        a.set([p[0] * g, p[1] * g, p[2] * g]);
        a.mat.color.lerpColors(red, green, arrowTint);
      }

      const showBall = ball !== null && ball.at.length === dim;
      ballMesh.visible = ring.visible = line.visible = showBall;
      if (ball && showBall) {
        const age = time - ball.born;
        const b = place(ball.at).p, d = place(ball.nearest).p;
        ballMesh.position.set(...b);
        ballMesh.scale.setScalar(Math.max(1e-4, easeOut(age / 0.3)));
        const reach = easeOut((age - 0.2) / 0.35);
        ring.position.set(...d);
        ring.visible = reach >= 1;
        linePos.setXYZ(0, b[0], b[1], b[2]);
        linePos.setXYZ(1, b[0] + (d[0] - b[0]) * reach, b[1] + (d[1] - b[1]) * reach, b[2] + (d[2] - b[2]) * reach);
        linePos.needsUpdate = true;
        ring.rotation.y += dt * 1.2;
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
