import { reducedMotion, clamp } from "./dom.ts";
import { currentTheme } from "./theme.ts";

/**
 * Lattice Town: the 3D world behind the whole page (user decision, Sept 30).
 *
 * One continuous town. As you scroll, one camera travels through it and the town acts out each chapter:
 *   title   the whole town from above
 *   ch. 0   a delivery drone carries the glowing message along the main road, past the Wi-Fi cabinet, the phone mast,
 *           Eve's office (red scanner copies it) and the data centre; the open padlock flies back, clicks shut, the locked
 *           parcel flies home
 *   ch. 1   above downtown: the streets are the grid; the drone flies 3 blocks east, 2 north; a parcel drops, the nearest
 *           building lights up
 *   ch. 2   a green route (two short legs) and a red route (the long way round) painted on the streets, two cars drive them
 *   ch. 3   rain, a gust pushes the parcel off its spot, Eve's drone searches the wrong block, then a storm
 *   ch. 4   a steel frame grows in every direction; Eve's drone gets lost; the golden quantum computer's beams fade
 *   ch. 5   the clock tower with 97 marks, two identical keys, Sam's phone with the padlock
 * Day in the light theme, night in the dark theme.
 *
 * Real assets (public/town/web, all credited in public/town/assets.json): photographed facades, brick, roof tiles,
 * asphalt, paving, grass and concrete (ambientCG, CC0); street lamps, benches, bins, hydrants, shrubs (Poly Haven, CC0);
 * the car (Khronos "Car Concept", Eric Chadwick, CC BY 4.0) and the old-town lantern (Khronos, CC0); real skies for light
 * and reflections (Poly Haven, CC0). Everything else is built here from simple shapes. Decorative only (aria-hidden).
 *
 * Three.js and its add-ons load from the CDN like Scene 4; they are typed loosely here (the town uses far more of
 * Three.js than three.d.ts describes). If anything fails to load, the promise rejects and the page keeps the flat hero.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type V3 = [number, number, number];

const COL = { ball: 0xffb454, secret: 0x3ddc97, attacker: 0xff5c7a, gold: 0xe7c46b };

export async function mountTown(anchors: HTMLElement[], chapters: HTMLElement[]): Promise<() => void> {
  const addon = (p: string): Promise<Any> => import(/* @vite-ignore */ `three/addons/${p}`);
  const [THREE, { Sky }, { RoundedBoxGeometry }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { GLTFLoader }, { EXRLoader }, { MeshoptDecoder }]: Any[] =
    await Promise.all([import("three"), addon("objects/Sky.js"), addon("geometries/RoundedBoxGeometry.js"), addon("postprocessing/EffectComposer.js"),
      addon("postprocessing/RenderPass.js"), addon("postprocessing/UnrealBloomPass.js"), addon("postprocessing/OutputPass.js"),
      addon("loaders/GLTFLoader.js"), addon("loaders/EXRLoader.js"), addon("libs/meshopt_decoder.module.js")]);

  const lite = matchMedia("(max-width: 820px), (pointer: coarse)").matches; // phones: no shadows, no bloom, a smaller town
  const BASE = new URL("town/web/", document.baseURI).href;
  const V = (x: number, y: number, z: number): Any => new THREE.Vector3(x, y, z);
  const smooth = (x: number) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
  const seg = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ================= renderer, scene, sky =================
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const canvas: HTMLCanvasElement = renderer.domElement;
  canvas.className = "backdrop";
  canvas.setAttribute("aria-hidden", "true");
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1.75 : 2)); // sharp on phone and retina screens
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
  const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
  const skyU = sky.material.uniforms;
  skyU.turbidity.value = 2.2; skyU.rayleigh.value = 1.1; skyU.mieCoefficient.value = .005; skyU.mieDirectionalG.value = .8;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.fog = new THREE.Fog(0xa9c0da, 260, 1500);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3);
  sun.castShadow = !lite; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = .6;
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 1, far: 900 });
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x5b5140, 1.1); scene.add(hemi);

  // ================= real textures =================
  const texLoader = new THREE.TextureLoader();
  const tx = (name: string, color = true): Any => {
    const t = texLoader.load(BASE + "textures/" + name + ".webp");
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const pbr = (set: string, extra: Record<string, unknown> = {}): Any => new THREE.MeshStandardMaterial({
    map: tx(set + "-color"), normalMap: tx(set + "-normal", false), roughnessMap: tx(set + "-rough", false), roughness: 1, metalness: 0, ...extra });
  const M: Record<string, Any> = {
    asphalt: pbr("asphalt"), grass: pbr("grass"), paving: pbr("paving"), bricks: pbr("bricks"), roofTiles: pbr("roof"), concrete: pbr("concrete"),
    white: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: .6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: .5, metalness: .3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: .35, metalness: .9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e6b52, roughness: .6, metalness: .6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8cc, roughness: .05, metalness: .1, transparent: true, opacity: .35 }),
    window: new THREE.MeshStandardMaterial({ color: 0x31465c, roughness: .1, metalness: .6, emissive: 0xffcf8a, emissiveIntensity: 0 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4332, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: .9 }),
    gold: new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 1, roughness: .22 }),
  };
  M.concrete.color = new THREE.Color(0xc8c8c8);
  M.grass.color = new THREE.Color(.62, .66, .55); // the photo's green is very saturated from above
  /** Facades: [texture set, metres one texture tile covers across, metres it covers up]. Night lights come from the -lit map. */
  const FACADES: [string, number, number][] = [["facade-1", 12, 12], ["facade-2", 15, 21], ["facade-3", 18, 22], ["facade-4", 24, 27]];
  // (photos are darker than the lit look we want by day, so their colour is lifted a little)
  const facadeMats: Any[] = FACADES.map(([set]) => pbr(set, { emissiveMap: tx(set + "-lit", false), emissive: 0xffc98a, emissiveIntensity: 0, metalness: .1, color: new THREE.Color(1.7, 1.7, 1.75) }));
  const glowMat = (c: number, k = 2): Any => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: .4 });
  const nightGlows: [Any, number][] = []; // materials (or lights) whose glow follows the night

  /** Scale a geometry's texture coordinates so a texture tile covers `tile` metres. */
  const uvScale = (geo: Any, su: number, sv: number) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
  const add = (o: Any, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); scene.add(o); return o; };
  const shadowed = (m: Any, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
  const lampPool = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,210,150,1)"); r.addColorStop(.5, "rgba(255,190,120,.35)"); r.addColorStop(1, "rgba(255,180,100,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

  // ================= the ground: fields, main road, downtown grid =================
  { const ground = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(8000, 8000), 1000, 1000), M.grass); ground.rotation.x = -Math.PI / 2; add(shadowed(ground, false)); }
  const dashes: Any[] = [];
  function road(x1: number, z1: number, x2: number, z2: number, w = 12) {
    const len = Math.hypot(x2 - x1, z2 - z1), ang = -Math.atan2(z2 - z1, x2 - x1);
    const m = new THREE.Mesh(uvScale(new THREE.PlaneGeometry(len, w), len / 6, w / 6), M.asphalt);
    m.rotation.x = -Math.PI / 2; m.rotation.z = ang; add(shadowed(m, false), (x1 + x2) / 2, .05, (z1 + z2) / 2);
    const dir = V(x2 - x1, 0, z2 - z1).normalize(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ang));
    for (let i = 0; i < Math.floor(len / 7); i++) dashes.push(new THREE.Matrix4().compose(V(x1, .07, z1).addScaledVector(dir, 3.5 + i * 7), q, V(1, 1, 1)));
    for (const s of [-1, 1]) {
      const n = V(-dir.z, 0, dir.x).multiplyScalar(s * (w / 2 + 1.6));
      const pv = new THREE.Mesh(uvScale(new THREE.BoxGeometry(len, .3, 3.2), len / 3, 1), M.paving); pv.rotation.y = ang;
      add(shadowed(pv, false), (x1 + x2) / 2 + n.x, .15, (z1 + z2) / 2 + n.z);
    }
  }
  road(-230, 0, 230, 0, 14);
  const GX = [-75, -45, -15, 15, 45, 75], GZ = [-30, -60, -90, -120, -150, -180];
  for (const x of GX) road(x, -18, x, -195, 10);
  for (const z of GZ) road(-90, z, 90, z, 10);

  // ================= buildings with photographed facades =================
  function building(x: number, z: number, w: number, d: number, h: number, style: number) {
    const [, tw, th] = FACADES[style];
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    for (let face = 0; face < 6; face++) { const span = face < 2 ? d : w; for (let k = 0; k < 4; k++) { const i = face * 4 + k; uv.setXY(i, uv.getX(i) * span / tw, uv.getY(i) * h / th); } }
    const b = new THREE.Mesh(geo, [facadeMats[style], facadeMats[style], M.concrete, M.concrete, facadeMats[style], facadeMats[style]]);
    add(shadowed(b), x, h / 2, z);
    add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + .5, .9, d + .5), M.concrete)), x, h + .1, z); // parapet
    if (rnd() < .6) add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * .3, 2, d * .25), M.dark)), x + w * .15, h + 1, z - d * .2);
    if (rnd() < .4) add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 12), M.metal)), x - w * .25, h + 1.3, z + d * .2);
    return b;
  }
  seed = 17;
  for (let i = 0; i < GX.length - 1; i++) for (let j = 0; j < GZ.length - 1; j++) {
    const cx = (GX[i] + GX[i + 1]) / 2, cz = (GZ[j] + GZ[j + 1]) / 2, dist = Math.hypot(cx, cz + 105);
    const tall = 10 + (1 - dist / 110) * 40 + rnd() * 16;
    if (rnd() < .5) building(cx, cz, 17, 17, tall, Math.floor(rnd() * 4));
    else { building(cx - 4.5, cz, 8, 17, tall * (.6 + rnd() * .5), Math.floor(rnd() * 4)); building(cx + 4.5, cz - 3, 8, 11, tall * (.5 + rnd() * .6), Math.floor(rnd() * 4)); }
  }
  for (let i = 0; i < 16; i++) { const x = -200 + i * 26 + rnd() * 6;
    if (Math.abs(x + 20) < 16 || Math.abs(x - 50) < 20 || Math.abs(x + 150) < 20 || Math.abs(x - 160) < 26 || Math.abs(x + 110) < 8) continue;
    building(x, 44 + rnd() * 8, 12 + rnd() * 6, 12, 7 + rnd() * 12, Math.floor(rnd() * 4)); }

  // ================= houses (Alex, Sam, neighbours): brick walls, tiled roofs =================
  function house(x: number, z: number, rot = 0, s = 1) {
    const g = new THREE.Group(), w = 10 * s, d = 8 * s, h = 5.5 * s;
    const body = new THREE.Mesh(uvScale(new THREE.BoxGeometry(w, h, d), w / 3, h / 3), M.bricks); body.position.y = h / 2; g.add(shadowed(body));
    const shape = new THREE.Shape(); shape.moveTo(-d / 2 - .6, 0); shape.lineTo(0, 3.6 * s); shape.lineTo(d / 2 + .6, 0); shape.lineTo(-d / 2 - .6, 0);
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: w + 1.2, bevelEnabled: false }); uvScale(roofGeo, .3, .3);
    const roof = new THREE.Mesh(roofGeo, M.roofTiles); roof.rotation.y = Math.PI / 2; roof.position.set(-w / 2 - .6, h, 0); g.add(shadowed(roof));
    const chim = new THREE.Mesh(uvScale(new THREE.BoxGeometry(1.1, 3, 1.1), .4, 1), M.bricks); chim.position.set(w * .25, h + 2.6, -d * .15); g.add(shadowed(chim));
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, .2), M.dark); door.position.set(0, 1.2, d / 2 + .05); g.add(door);
    for (const [wx, wy] of [[-2.8, 1.8], [2.8, 1.8], [-2.8, 4.1], [2.8, 4.1]]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, .15), M.window); win.position.set(wx * s, wy * s, d / 2 + .05); g.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.55, .08), M.white); frame.position.set(wx * s, wy * s, d / 2 + .01); g.add(frame);
    }
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); return g;
  }
  seed = 29;
  const ALEX = V(-190, 0, -16), SAM = V(190, 0, -16), SITE = V(0, 0, -300), SQ = V(150, 0, -70);
  house(ALEX.x, ALEX.z, 0, 1.15); house(SAM.x, SAM.z, 0, 1.15);
  for (let i = 0; i < 14; i++) { const side = i < 7 ? -1 : 1, k = i % 7; const x = side * (205 + (k % 3) * 18 - (k > 3 ? 40 : 0)) + (rnd() - .5) * 6, z = (k < 4 ? -16 - (k % 2) * 22 : 22) + (rnd() - .5) * 4;
    if (Math.hypot(x - ALEX.x, z - ALEX.z) < 14 || Math.hypot(x - SAM.x, z - SAM.z) < 14) continue; house(x, z, z > 0 ? Math.PI : 0, .9 + rnd() * .2); }

  // ================= Chapter 0's road: Wi-Fi cabinet, phone mast, Eve's office, data centre =================
  add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.2, 1.2, 3, .15), new THREE.MeshStandardMaterial({ color: 0x4b5a4d, roughness: .6 }))), -150, 1.1, -9.5);
  const cabLed = add(new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), glowMat(COL.secret, 4)), -149.3, 1.7, -8.85);
  { const mast = new THREE.Group(); mast.position.set(-110, 0, -12); scene.add(mast);
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 34, 6), M.metal); leg.position.set(dx * .6, 17, dz * .6); leg.rotation.set(dz * .035, 0, -dx * .035); mast.add(shadowed(leg)); }
    for (let k = 0; k < 11; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.1 - k * .05, .08, 4, 4), M.metal); r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 4; r.position.y = 3 + k * 3; mast.add(r); }
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.5, 3, 1.1), M.white); const a = k * Math.PI * 2 / 3; p.position.set(Math.cos(a) * 1.3, 32, Math.sin(a) * 1.3); p.rotation.y = -a; mast.add(shadowed(p)); } }
  building(-20, -24, 20, 16, 22, 3);
  add(new THREE.Mesh(new THREE.BoxGeometry(20.2, 1.2, .3), glowMat(COL.attacker, 2)), -20, 20, -15.9);
  { const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xe9e9ee, roughness: .4, metalness: .3, side: THREE.DoubleSide }));
    dish.rotation.x = -1.1; add(shadowed(dish), -20, 25.5, -22); }
  const scanner = add(new THREE.Mesh(new THREE.ConeGeometry(4, 16, 24, 1, true), new THREE.MeshBasicMaterial({ color: COL.attacker, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })), -20, 16, -8);
  scanner.rotation.x = Math.PI * .72;
  building(50, -26, 34, 18, 10, 1);
  for (let k = 0; k < 6; k++) add(new THREE.Mesh(new THREE.BoxGeometry(2.4, .25, .2), glowMat(COL.secret, 3)), 38 + k * 4.6, 6, -16.9);

  // ================= the wider town: suburbs and hills =================
  {
    seed = 83;
    const spots: [number, number, number][] = [];
    for (let i = 0; i < (lite ? 700 : 1800); i++) { const a = rnd() * Math.PI * 2, r = 250 + Math.pow(rnd(), .7) * 900, x = Math.cos(a) * r, z = Math.sin(a) * r - 80;
      if (Math.abs(z - SITE.z) < 70 && Math.abs(x) < 110) continue; spots.push([x, z, rnd()]); }
    const body = new THREE.InstancedMesh(uvScale(new THREE.BoxGeometry(1, 1, 1), 3, 2), M.bricks, spots.length);
    const roofI = new THREE.InstancedMesh(new THREE.ConeGeometry(.78, .5, 4).rotateY(Math.PI / 4), M.roofTiles, spots.length);
    const winI = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), M.window, spots.length);
    spots.forEach(([x, z, k], i) => { const w = 8 + k * 6, d = 7 + k * 4, h = 4 + k * 3.5, rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.round(rnd() * 3) * Math.PI / 2 + (rnd() - .5) * .2, 0));
      body.setMatrixAt(i, new THREE.Matrix4().compose(V(x, h / 2, z), rot, V(w, h, d)));
      body.setColorAt(i, new THREE.Color().setHSL(.05 + rnd() * .06, .1 + rnd() * .15, .75 + rnd() * .25));
      roofI.setMatrixAt(i, new THREE.Matrix4().compose(V(x, h + 1.5, z), rot, V(w * .92, 6, d * 1.1)));
      winI.setMatrixAt(i, new THREE.Matrix4().compose(V(x, h * .55, z).add(V(0, 0, d / 2 + .05).applyQuaternion(rot)), rot, V(w * .6, Math.min(2, h * .3), 1))); });
    for (const m of [body, roofI, winI]) { m.frustumCulled = false; shadowed(m, !lite, true); scene.add(m); }
    const hills = new THREE.Mesh(new THREE.RingGeometry(1300, 3800, 160, 12), new THREE.MeshStandardMaterial({ color: 0x4b6a3f, roughness: 1 }));
    const hp = hills.geometry.attributes.position;
    for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), y = hp.getY(i), r = Math.hypot(x, y), a = Math.atan2(y, x);
      hp.setZ(i, Math.max(0, (r - 1350) / 2450) * (140 + 110 * Math.sin(a * 5) + 70 * Math.sin(a * 13 + 1) + 40 * Math.sin(a * 29))); }
    hills.geometry.computeVertexNormals(); hills.rotation.x = -Math.PI / 2; hills.position.y = -.5; scene.add(hills);
  }

  // ================= trees (built here: Poly Haven's real trees are hundreds of MB) =================
  seed = 41;
  const treeSpots: [number, number][] = [];
  for (let i = 0; i < (lite ? 300 : 900); i++) { const a = rnd() * Math.PI * 2, r = 240 + rnd() * 700; treeSpots.push([Math.cos(a) * r, Math.sin(a) * r - 80]); }
  for (let x = -225; x <= 225; x += 12) { if (rnd() < .75) treeSpots.push([x + rnd() * 4, 11.5 + rnd() * 2]); if (rnd() < .5) treeSpots.push([x + rnd() * 4, -12 - rnd() * 2]); }
  { const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .35, 4, 6), M.trunk, treeSpots.length);
    const leafGeo = new THREE.IcosahedronGeometry(2.3, 1); // 80 faces: thousands of trees stay cheap { const p = leafGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + (Math.sin(v.x * 3.1) + Math.sin(v.y * 2.7 + v.z)) * .08); p.setXYZ(i, v.x, v.y, v.z); } leafGeo.computeVertexNormals(); }
    const leafI = new THREE.InstancedMesh(leafGeo, M.leaves, treeSpots.length * 2);
    treeSpots.forEach(([x, z], i) => { const s = .8 + rnd() * .5;
      trunkI.setMatrixAt(i, new THREE.Matrix4().compose(V(x, 2 * s, z), new THREE.Quaternion(), V(s, s, s)));
      leafI.setMatrixAt(i * 2, new THREE.Matrix4().compose(V(x, 5 * s, z), new THREE.Quaternion(), V(s, s * 1.1, s)));
      leafI.setMatrixAt(i * 2 + 1, new THREE.Matrix4().compose(V(x + .8 * s, 6.4 * s, z + .5), new THREE.Quaternion(), V(s * .7, s * .8, s * .7)));
      leafI.setColorAt(i * 2, new THREE.Color().setHSL(.25 + rnd() * .06, .45, .3 + rnd() * .08)); leafI.setColorAt(i * 2 + 1, new THREE.Color().setHSL(.25 + rnd() * .06, .45, .34)); });
    trunkI.frustumCulled = leafI.frustumCulled = false; shadowed(trunkI); shadowed(leafI); scene.add(trunkI, leafI);
    const dashI = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, .35), M.white, dashes.length); dashes.forEach((m, i) => dashI.setMatrixAt(i, m)); dashI.frustumCulled = false; scene.add(dashI); }

  // street-lamp spots, benches, bins, hydrants, shrubs (filled with the real models when they arrive)
  const lampSpots: [number, number, number][] = [];
  for (let x = -222; x <= 222; x += 24) lampSpots.push([x, 9.4, Math.PI], [x + 12, -9.4, 0]);
  for (const x of GX) for (let z = -30; z >= -190; z -= 30) lampSpots.push([x + 6.4, z + 15, -Math.PI / 2]);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: lampPool, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), lampSpots.length);
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  lampSpots.forEach(([x, z], i) => pools.setMatrixAt(i, new THREE.Matrix4().compose(V(x, .12, z - Math.sign(z || 1) * 3), flat, V(1, 1, 1))));
  pools.frustumCulled = false; scene.add(pools);

  // ================= cars: the real car near the camera, a simple one far away =================
  const lods: Any[] = [];
  function car(color: number) {
    const g = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .6, roughness: .3, clearcoat: 1, clearcoatRoughness: .1 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(4.4, 1.1, 1.9, 3, .35), paint); body.position.y = .85; g.add(shadowed(body));
    const cab = new THREE.Mesh(new RoundedBoxGeometry(2.4, .9, 1.7, 3, .3), new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: .1, metalness: .5 })); cab.position.set(-.2, 1.7, 0); g.add(cab);
    for (const [x, z] of [[1.4, .9], [-1.4, .9], [1.4, -.9], [-1.4, -.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 14), M.dark); w.rotation.x = Math.PI / 2; w.position.set(x, .42, z); g.add(w); }
    const head = glowMat(0xfff4dc, 0), tail = glowMat(0xff3030, 0);
    for (const z of [-.6, .6]) { const h = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .4), head); h.position.set(2.2, .95, z); g.add(h);
      const t = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .4), tail); t.position.set(-2.2, .95, z); g.add(t); }
    nightGlows.push([head, 3], [tail, 2]);
    const lod = new THREE.LOD(); lod.addLevel(g, 0); lod.userData.paint = color; scene.add(lod); lods.push(lod); return lod;
  }
  seed = 53;
  const carColors = [0xb8bcc2, 0x1d2b44, 0x8c1c1c, 0xf2f2f2, 0x2f4f3a, 0x444a52, 0xd8c7a0];
  const traffic: { c: Any; path: string; lane?: number; k: number; speed: number }[] = [];
  for (let i = 0; i < 12; i++) traffic.push({ c: car(carColors[i % 7]), path: "main", k: rnd(), speed: (.012 + rnd() * .01) * (i % 2 ? 1 : -1) });
  for (let i = 0; i < (lite ? 4 : 10); i++) traffic.push({ c: car(carColors[(i + 3) % 7]), path: i % 2 ? "ns" : "ew", lane: i % 2 ? GX[1 + (i % 4)] : GZ[i % 5], k: rnd(), speed: (.02 + rnd() * .015) * (i % 3 ? 1 : -1) });

  // ================= story objects =================
  function drone(ledColor: number) {
    const g = new THREE.Group();
    g.add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.6, .5, 1.1, 3, .18), new THREE.MeshPhysicalMaterial({ color: 0xe8eaee, roughness: .3, clearcoat: 1 }))));
    const rotors: Any[] = [];
    for (const [x, z] of [[1.2, .9], [-1.2, .9], [1.2, -.9], [-1.2, -.9]]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.5, 6), M.dark); arm.rotation.z = Math.PI / 2; arm.rotation.y = Math.atan2(z, x); arm.position.set(x / 2, 0, z / 2); g.add(arm);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .03, 20), new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: .35 })); r.position.set(x, .3, z); g.add(r); rotors.push(r);
    }
    const led = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), glowMat(ledColor, 4)); led.position.set(.8, 0, 0); g.add(led);
    g.userData.rotors = rotors; scene.add(g); return g;
  }
  function parcel(color = COL.ball, ghostly = false) {
    const g = new THREE.Group();
    const box = new THREE.MeshStandardMaterial({ color: 0xc9a071, roughness: .85, transparent: ghostly, opacity: ghostly ? .55 : 1 });
    g.add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(1.3, .9, .9, 3, .08), box)));
    const band = glowMat(color, 2.2); if (ghostly) { band.transparent = true; band.opacity = .55; }
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.34, .18, .94), band)); scene.add(g); return g;
  }
  function padlock() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new RoundedBoxGeometry(.9, .8, .4, 3, .1), new THREE.MeshStandardMaterial({ color: COL.secret, metalness: .7, roughness: .3, emissive: COL.secret, emissiveIntensity: .35 })));
    const sh = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 10, 24, Math.PI), M.metal); sh.position.y = .4; g.add(sh);
    g.userData.shackle = sh; scene.add(g); return g;
  }
  const courier = drone(COL.ball), message = parcel(), ghost = parcel(COL.attacker, true), lock = padlock();
  const lineOn = (pts: [number, number][], color: number, width = 1.4) => {
    const g = new THREE.Group();
    for (let i = 0; i < pts.length - 1; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, .3, (z1 + z2) / 2); g.add(m); }
    scene.add(g); return g;
  };
  const setLine = (g: Any, a: number) => g.children.forEach((m: Any) => { m.material.opacity = a; });
  const O: [number, number] = [GX[1], GZ[4]];
  const hopPath = lineOn([O, [GX[4], GZ[4]], [GX[4], GZ[2]]], COL.ball);
  const greenRoute = lineOn([O, [GX[2], GZ[4]], [GX[2], GZ[3]]], COL.secret, 1.8);
  const redRoute = lineOn([O, [GX[0], GZ[1]], [GX[3], GZ[1]], [GX[2], GZ[3]]], COL.attacker, 1.8);
  const hopper = drone(COL.ball), greenCar = car(0x1f9e6c), redCar = car(0xc0304a);
  const ring = add(new THREE.Mesh(new THREE.RingGeometry(9, 10.5, 48), new THREE.MeshBasicMaterial({ color: COL.secret, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })));
  ring.rotation.x = -Math.PI / 2;
  const dropBox = parcel(), eveDrone = drone(COL.attacker);
  const scatter = [0, 1, 2, 3, 4].map(() => parcel());
  const RAIN = lite ? 2000 : 6000, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN * 6);
  seed = 61; for (let i = 0; i < RAIN; i++) { const x = (rnd() - .5) * 260, y = rnd() * 120, z = (rnd() - .5) * 260; rainPos.set([x, y, z, x, y - 1.6, z], i * 6); }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaec3dd, transparent: true, opacity: 0 })); rain.frustumCulled = false; scene.add(rain);

  // chapter 4: the growing steel frame, a tower crane, the quantum lab
  const beams: { a: Any; b: Any; r: number }[] = []; seed = 71; const B = 7;
  for (let i = -3; i <= 3; i++) for (let j = 0; j <= 6; j++) for (let k = -3; k <= 3; k++) {
    const p = V(SITE.x + i * B, j * B, SITE.z + k * B), r = Math.hypot(i, j * .8, k) + rnd() * .8;
    if (rnd() < .12) continue;
    beams.push({ a: p, b: p.clone().add(V(0, B, 0)), r });
    if (i < 3 && rnd() < .8) beams.push({ a: p.clone().add(V(0, B, 0)), b: p.clone().add(V(B, B, 0)), r: r + .2 });
    if (k < 3 && rnd() < .8) beams.push({ a: p.clone().add(V(0, B, 0)), b: p.clone().add(V(0, B, B)), r: r + .3 });
  }
  beams.sort((u, v) => u.r - v.r);
  const frameI = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .5, 1), M.steel, beams.length);
  beams.forEach((bm, n) => { const mid = bm.a.clone().add(bm.b).multiplyScalar(.5), len = bm.a.distanceTo(bm.b);
    frameI.setMatrixAt(n, new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), bm.b.clone().sub(bm.a).normalize()), V(1, 1, len))); });
  shadowed(frameI); frameI.frustumCulled = false; frameI.count = 0; scene.add(frameI);
  M.steel.emissive = new THREE.Color(0xff9a4a); nightGlows.push([M.steel, .12]); // work lights catch the steel at night
  { const flood = new THREE.PointLight(0xffc98a, 0, 140, 1.4); flood.position.set(SITE.x, 60, SITE.z + 40); scene.add(flood);
    const flood2 = new THREE.PointLight(0xffc98a, 0, 140, 1.4); flood2.position.set(SITE.x + 30, 30, SITE.z - 40); scene.add(flood2);
    nightGlows.push([{ set emissiveIntensity(v: number) { flood.intensity = v; flood2.intensity = v; } }, 1400]); }
  { const crane = new THREE.Group(); crane.position.set(SITE.x - 34, 0, SITE.z + 8); scene.add(crane);
    const yellow = new THREE.MeshStandardMaterial({ color: 0xe0b02a, roughness: .6, metalness: .3 });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(2, 70, 2), yellow); mast.position.y = 35; crane.add(shadowed(mast));
    const jib = new THREE.Mesh(new THREE.BoxGeometry(60, 1.6, 1.6), yellow); jib.position.set(18, 70, 0); crane.add(shadowed(jib));
    const cw = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3), M.concrete); cw.position.set(-9, 68.5, 0); crane.add(shadowed(cw)); }
  const lab = new THREE.Group(); lab.position.set(SITE.x + 50, 0, SITE.z + 10); scene.add(lab);
  const qc = new THREE.Group(); qc.position.y = 12; lab.add(qc);
  { const glass = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 18), M.glass); glass.position.y = 7; lab.add(glass);
    const top = new THREE.Mesh(new THREE.BoxGeometry(18.4, .6, 18.4), M.metal); top.position.y = 14; lab.add(shadowed(top));
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(3.4 - i * .55, 3.4 - i * .55, .25, 40), M.gold); d.position.y = -i * 1.8; qc.add(shadowed(d)); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 7, 6), M.gold); c.position.set(Math.cos(a) * 1.6, -3.6, Math.sin(a) * 1.6); qc.add(c); } }
  const beamsQ = [0, 1, 2].map(() => add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 1, 10), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))));
  const lostDrone = drone(COL.attacker);

  // chapter 5: the square, the clock tower, the keys, Sam's phone
  { const plaza = new THREE.Mesh(uvScale(new THREE.CircleGeometry(34, 48), 12, 12), M.paving); plaza.rotation.x = -Math.PI / 2; add(shadowed(plaza, false), SQ.x, .08, SQ.z);
    road(SAM.x - 40, -18, SQ.x, SQ.z + 30, 8); }
  { const tower = new THREE.Group(); tower.position.copy(SQ); scene.add(tower);
    const shaft = new THREE.Mesh(uvScale(new THREE.BoxGeometry(9, 40, 9), 3, 13), M.bricks); shaft.position.y = 20; tower.add(shadowed(shaft));
    const cap = new THREE.Mesh(new THREE.BoxGeometry(10.5, 2, 10.5), M.concrete); cap.position.y = 41; tower.add(shadowed(cap));
    const spire = new THREE.Mesh(uvScale(new THREE.ConeGeometry(7.4, 12, 4), 3, 3), M.roofTiles); spire.rotation.y = Math.PI / 4; spire.position.y = 48; tower.add(shadowed(spire)); }
  const face = new THREE.Group(); face.position.set(SQ.x, 33, SQ.z + 4.6); scene.add(face);
  { const disc = new THREE.Mesh(new THREE.CircleGeometry(3.7, 64), new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: .6, emissive: 0xfff0d0, emissiveIntensity: 0 })); face.add(disc); nightGlows.push([disc.material, .12]);
    for (let h = 0; h < 97; h++) { const a = Math.PI / 2 - h / 97 * Math.PI * 2, zone = h < 25 || h > 72;
      const t = new THREE.Mesh(new THREE.BoxGeometry(.1, h % 8 === 0 ? .6 : .32, .05), glowMat(zone ? COL.secret : COL.ball, 1.2)); t.position.set(Math.cos(a) * 3.3, Math.sin(a) * 3.3, .05); t.rotation.z = a - Math.PI / 2; face.add(t); } }
  const hand = new THREE.Group(); hand.position.z = .12; face.add(hand);
  { const hm = new THREE.Mesh(new THREE.BoxGeometry(.18, 3, .06), M.dark); hm.position.y = 1.4; hand.add(hm); }
  function key() { const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: COL.secret, metalness: .8, roughness: .25, emissive: COL.secret, emissiveIntensity: .8 });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(.55, .16, 10, 24), m)); const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, .24, .2), m); s.position.x = 1.4; g.add(s);
    for (const x of [1.9, 2.25]) { const t = new THREE.Mesh(new THREE.BoxGeometry(.18, .45, .2), m); t.position.set(x, -.3, 0); g.add(t); } g.scale.setScalar(1.6); scene.add(g); return g; }
  const keyA = key(), keyB = key();
  { const cv = document.createElement("canvas"); cv.width = 360; cv.height = 720; const g = cv.getContext("2d")!;
    g.fillStyle = "#0f131b"; g.fillRect(0, 0, 360, 720); g.fillStyle = "#1e2533"; g.beginPath(); g.roundRect(18, 60, 324, 64, 32); g.fill();
    g.strokeStyle = "#3ddc97"; g.lineWidth = 6; g.beginPath(); g.arc(58, 88, 11, Math.PI, 0); g.stroke(); g.fillStyle = "#3ddc97"; g.fillRect(44, 88, 28, 22);
    g.fillStyle = "#c9d1de"; g.font = "24px sans-serif"; g.fillText("sam.example", 90, 101); g.fillStyle = "#e8ecf1"; g.font = "bold 34px sans-serif"; g.fillText("meet at 5", 40, 260);
    g.fillStyle = "#8f99ab"; g.font = "22px sans-serif"; g.fillText("from Alex · locked ✓", 40, 300);
    const screenTex = new THREE.CanvasTexture(cv); screenTex.colorSpace = THREE.SRGBColorSpace;
    const phone = new THREE.Group(); phone.position.set(SAM.x + 1.2, 1.25, SAM.z + 8.2); phone.rotation.x = -.35; scene.add(phone);
    phone.add(new THREE.Mesh(new RoundedBoxGeometry(.75, 1.5, .08, 3, .08), M.dark));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.68, 1.36), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })); scr.position.z = .045; phone.add(scr);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: .6 });
    add(new THREE.Mesh(new THREE.BoxGeometry(3, .12, 1.6), wood), SAM.x + 1.2, .9, SAM.z + 8.2);
    for (const [dx, dz] of [[-1.3, -.6], [1.3, -.6], [-1.3, .6], [1.3, .6]]) add(new THREE.Mesh(new THREE.BoxGeometry(.08, .9, .08), wood), SAM.x + 1.2 + dx, .45, SAM.z + 8.2 + dz);
    const lampL = new THREE.PointLight(0xffd6a0, 0, 12, 2); lampL.position.set(SAM.x - .5, 2.4, SAM.z + 8.4); scene.add(lampL);
    nightGlows.push([{ set emissiveIntensity(v: number) { lampL.intensity = v; } }, 6]); }

  // ================= real models: loaded after the town is up; the town already works without them =================
  const envs: { day: Any; night: Any } = { day: null, night: null };
  let envNight = -1;
  const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
  const loadModel = (name: string): Promise<Any> => gltf.loadAsync(BASE + "models/" + name + ".glb").then((g: Any) => g.scene);
  /** One InstancedMesh per part of a model, placed at every matrix in `at`. */
  const instance = (model: Any, at: Any[], scale = 1) => {
    model.updateMatrixWorld(true);
    model.traverse((o: Any) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, at.length);
      const local = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(o.matrixWorld);
      at.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(local)));
      im.frustumCulled = false; shadowed(im, !lite, false); scene.add(im);
    });
  };
  const place = (x: number, z: number, ry = 0) => new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
  const heightOf = (model: Any) => new THREE.Box3().setFromObject(model).max.y;
  const pending: Promise<unknown>[] = [];
  const exr = new EXRLoader();
  for (const [k, file] of [["day", "sky-day.exr"], ["night", "sky-night.exr"]] as const)
    pending.push(exr.loadAsync(BASE + file).then((t: Any) => { t.mapping = THREE.EquirectangularReflectionMapping; envs[k] = pmrem.fromEquirectangular(t).texture; t.dispose(); envNight = -1; }));
  pending.push(loadModel("car").then((template) => {
    template.traverse((o: Any) => { if (o.isMesh) { o.castShadow = !lite; if (/license/i.test(o.name) || /license/i.test(o.material?.name || "")) o.visible = false; } });
    for (const lod of lods) {
      const real = template.clone(true);
      real.traverse((o: Any) => { if (o.isMesh && /^Paint/.test(o.material.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.set(lod.userData.paint); } });
      const wrap = new THREE.Group(); wrap.add(real); real.rotation.y = Math.PI / 2;
      lod.levels[0].distance = lite ? 50 : 90; lod.addLevel(wrap, 0);
    }
  }));
  pending.push(loadModel("lamp").then((lamp) => {
    instance(lamp, lampSpots.map(([x, z, r]) => place(x, z, r)));
    const top = heightOf(lamp); // a warm glow where each lamp's light is
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.28, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffd9a0, emissiveIntensity: 0 }), lampSpots.length);
    lampSpots.forEach(([x, z, r], i) => heads.setMatrixAt(i, place(x, z, r).multiply(new THREE.Matrix4().makeTranslation(0, top * .93, 0))));
    heads.frustumCulled = false; scene.add(heads); nightGlows.push([heads.material, 3]);
  }));
  pending.push(loadModel("lantern").then((lantern) => {
    lantern.traverse((o: Any) => { if (o.isMesh) { const m = o.material; m.emissive = new THREE.Color(0xffc46b); m.emissiveMap = m.map; nightGlows.push([m, 1.6]); } });
    const at: Any[] = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; at.push(place(SQ.x + Math.cos(a) * 30, SQ.z + Math.sin(a) * 30, -a + Math.PI / 2)); }
    for (const H of [ALEX, SAM]) for (const dx of [-14, 14]) at.push(place(H.x + dx, H.z + 8));
    instance(lantern, at, .24);
  }));
  seed = 91;
  const benchAt: Any[] = [], binAt: Any[] = [], hydrantAt: Any[] = [], shrubAt: Any[] = [];
  for (let x = -210; x <= 210; x += 36) { benchAt.push(place(x + 5, 10.2, Math.PI)); binAt.push(place(x + 8.5, 10.4)); hydrantAt.push(place(x + 18, -10.4)); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2; benchAt.push(place(SQ.x + Math.cos(a) * 26, SQ.z + Math.sin(a) * 26, -a - Math.PI / 2)); }
  for (const H of [ALEX, SAM]) for (let i = 0; i < 6; i++) shrubAt.push(place(H.x - 6 + i * 2.4 + rnd(), H.z + 6.2 + rnd() * .6, rnd() * 6));
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; shrubAt.push(place(SQ.x + Math.cos(a) * 36, SQ.z + Math.sin(a) * 36, rnd() * 6)); }
  for (const [name, at] of [["bench", benchAt], ["bin", binAt], ["hydrant", hydrantAt], ["shrub", shrubAt]] as const) pending.push(loadModel(name).then((m) => instance(m, at)));
  Promise.allSettled(pending); // each piece appears when it arrives; a missing one just leaves the built-in version

  // ================= post-processing =================
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .2, .35, .9); bloom.enabled = !lite; composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ================= day (light theme) / night (dark theme) =================
  let wantNight = currentTheme() === "dark" ? 1 : 0, night = wantNight;
  const onTheme = () => { wantNight = currentTheme() === "dark" ? 1 : 0; };
  addEventListener("themechange", onTheme);
  const sunDir = V(0, 1, 0), cDay = new THREE.Color(0xa9c0da), cNight = new THREE.Color(0x0a0f1c);
  function applyTime() {
    const elev = THREE.MathUtils.lerp(38, -7, night), az = THREE.MathUtils.lerp(215, 240, night);
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(az));
    skyU.sunPosition.value.copy(sunDir);
    const dir = sunDir.clone().lerp(V(-.4, .8, .45).normalize(), smooth(night * 1.2)).normalize(); // the sun by day, a cool moon by night
    sun.color.set(0xfff1dc).lerp(new THREE.Color(0x9fb4ff), night); sun.intensity = THREE.MathUtils.lerp(3.2, .35, night);
    hemi.intensity = THREE.MathUtils.lerp(1.1, .18, night); hemi.color.set(0xcfe2ff).lerp(new THREE.Color(0x4a5d8c), night);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(.42, .75, night);
    scene.fog.color.copy(cDay).lerp(cNight, night);
    bloom.strength = THREE.MathUtils.lerp(.1, .5, night); bloom.threshold = THREE.MathUtils.lerp(.92, .7, night);
    const lit = smooth((night - .3) / .5);
    facadeMats.forEach((m) => { m.emissiveIntensity = lit * .9; });
    M.window.emissiveIntensity = lit * .5; pools.material.opacity = lit * .38;
    nightGlows.forEach(([m, k]) => { m.emissiveIntensity = lit * k; });
    if (Math.abs(envNight - night) > .08) { envNight = night;
      const real = night > .5 ? envs.night : envs.day;
      if (real) { scene.environment = real; scene.environmentIntensity = THREE.MathUtils.lerp(.9, .35, night); } }
    return dir;
  }

  // ================= scroll → chapters → camera =================
  const MAIN = (k: number) => V(THREE.MathUtils.lerp(ALEX.x, SAM.x, k), 13 + Math.sin(k * Math.PI * 7) * 1.2, -2);
  const storyCh0 = (p: number) => p < .38 ? MAIN(seg(p, .04, .38)) : p < .62 ? MAIN(1 - seg(p, .4, .62)) : p < .7 ? MAIN(0) : MAIN(seg(p, .7, .98));
  const along = (a: Any, b: Any, k: number) => a.clone().lerp(b, k);
  type Shot = (p: number, t: number) => { pos: Any; tgt: Any };
  const titleShot: Shot = (p, t) => ({ pos: V(Math.sin(t * .03 + p) * 120 - 40, 150 - p * 30, 170 - p * 40), tgt: V(0, 0, -70) });
  const shots: Shot[] = [
    titleShot,
    (p) => { const f = storyCh0(p); return { pos: f.clone().add(V(-18, 6, 26)), tgt: f.clone().add(V(10, -4, -8)) }; },
    (p) => ({ pos: V(-20 + p * 20, 150, -40 - p * 20), tgt: V(0, 0, -115) }),
    (p) => ({ pos: V(-40 + p * 25, 125, -30), tgt: V(-15, 0, -115) }),
    (p) => ({ pos: V(60 - p * 30, 70, -40), tgt: V(-10, 0, -120) }),
    (p) => ({ pos: V(Math.sin(p * 2.2) * 95, 30 + p * 55, SITE.z + Math.cos(p * 2.2) * 95), tgt: V(0, 16 + p * 20, SITE.z) }),
    (p) => { const k = seg(p, .7, 1);
      const a = { pos: V(SQ.x - 30 + p * 20, 30, SQ.z + 55), tgt: V(SQ.x, 30, SQ.z) }, b = { pos: V(SAM.x + 1.2, 2.5, SAM.z + 11.4), tgt: V(SAM.x + 1.2, 1.2, SAM.z + 8.2) };
      return { pos: along(a.pos, b.pos, k), tgt: along(a.tgt, b.tgt, k) }; },
    titleShot, // footer
  ];
  let tops: number[] = [], chTop: number[] = [], chH: number[] = [];
  const measure = () => {
    tops = anchors.map((a) => a.getBoundingClientRect().top + scrollY);
    chTop = chapters.map((c) => c.getBoundingClientRect().top + scrollY); chH = chapters.map((c) => c.offsetHeight);
  };
  const ro = new ResizeObserver(measure); ro.observe(document.body); measure();

  let raf = 0, last = 0, t = 0, frames = 0;
  const camTgt = V(0, 0, -70); let camInit = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
    const still = reducedMotion();
    if (!still) t += dt;
    night += (wantNight - night) * (still ? 1 : 1 - Math.exp(-dt * 2.2));
    const keyDir = applyTime();
    if (++frames % 30 === 0) measure(); // the page keeps growing as scenes, fonts and pictures load
    const mid = scrollY + innerHeight * .5;
    // progress through each chapter's story (it holds at 1 through the chapter's "Try it yourself")
    const P = chapters.map((_, i) => clamp((mid - chTop[i]) / Math.max(1, chH[i]), 0, 1));

    // Chapter 0: the courier, Eve's copy, the padlock
    { const p = P[0], f = storyCh0(p);
      courier.position.copy(f); courier.rotation.y = p < .38 || p > .7 ? 0 : Math.PI;
      message.visible = p < .4 || p >= .62; lock.visible = p >= .38 && p < .72;
      message.position.copy(f).add(V(0, -1.3, 0)); lock.position.copy(f).add(V(0, p < .62 ? -1.3 : -.4, 0));
      lock.userData.shackle.position.y = .4 - seg(p, .64, .68) * .18;
      const ev = seg(p, .15, .22) * (1 - seg(p, .3, .34)), ev2 = seg(p, .78, .82) * (1 - seg(p, .88, .9));
      scanner.material.opacity = (ev + ev2 * .7) * (.35 + .15 * Math.sin(t * 20));
      ghost.visible = p > .18 && p < .36; const gk = seg(p, .2, .34); ghost.position.copy(MAIN(seg(.21, .04, .38))).add(V(0, -1.3 + gk * 6, -gk * 14)); ghost.scale.setScalar(1 - gk * .5);
      cabLed.material.emissiveIntensity = 2 + 2 * Math.sin(t * 9); }

    // Chapters 1–3: downtown
    { const [, p1, p2, p3, p4] = P;
      setLine(hopPath, seg(p1, .15, .25) * (1 - seg(p2, .05, .15)) * .9);
      const hk = seg(p1, .25, .7) * 5, n = Math.min(4, Math.floor(hk)), u = smooth(hk - n);
      const hops: [number, number][] = [O, [O[0] + 30, O[1]], [O[0] + 60, O[1]], [O[0] + 90, O[1]], [O[0] + 90, O[1] + 30], [O[0] + 90, O[1] + 60]];
      const ha = hops[n], hb = hops[Math.min(n + 1, 5)];
      hopper.visible = p1 > 0 && p2 < .1; hopper.position.set(ha[0] + (hb[0] - ha[0]) * u, 26 + Math.sin(u * Math.PI) * 4, ha[1] + (hb[1] - ha[1]) * u);
      const drop = seg(p1, .75, .88); dropBox.visible = p1 > .72 && p2 < .1; dropBox.position.set(-2, 40 - drop * 39.5, -122);
      ring.material.opacity = seg(p1, .88, .95) * (1 - seg(p2, .02, .1)) * .9; ring.position.set(0, .4, -105);
      setLine(greenRoute, seg(p2, .1, .2) * (1 - seg(p3, .05, .12)) * .9); setLine(redRoute, seg(p2, .35, .45) * (1 - seg(p3, .05, .12)) * .9);
      const route = (pts: [number, number][], k: number): V3 => { const L = pts.length - 1, f = clamp(k, 0, 1) * L, i = Math.min(Math.floor(f), L - 1), w = smooth(f - i);
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * w, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * w, Math.atan2(-(pts[i + 1][1] - pts[i][1]), pts[i + 1][0] - pts[i][0])]; };
      const g = route([O, [GX[2], GZ[4]], [GX[2], GZ[3]]], seg(p2, .15, .4)), r = route([O, [GX[0], GZ[1]], [GX[3], GZ[1]], [GX[2], GZ[3]]], seg(p2, .45, .9));
      greenCar.visible = redCar.visible = p2 > 0 && p3 < .1;
      greenCar.position.set(g[0] + 2, 0, g[1] + 2); greenCar.rotation.y = g[2]; redCar.position.set(r[0] - 2, 0, r[1] - 2); redCar.rotation.y = r[2];
      const rainAmt = seg(p3, .05, .2) * (1 - seg(p4, .05, .15)), storm = seg(p3, .7, .82);
      rain.material.opacity = rainAmt * (.35 + storm * .25);
      if (rainAmt > 0) { const arr = rainGeo.attributes.position.array, wind = .3 + storm * 2.4;
        for (let i = 0; i < RAIN; i++) { const b = i * 6; let y = arr[b + 1] - (60 + storm * 30) * dt, x = arr[b] - wind * 18 * dt;
          if (y < 0) { y += 120; x = -10 + (rnd() - .5) * 260; arr[b + 2] = arr[b + 5] = -120 + (rnd() - .5) * 260; } arr[b] = x; arr[b + 1] = y; arr[b + 3] = x + wind * .6; arr[b + 4] = y - 1.6; }
        rainGeo.attributes.position.needsUpdate = true; }
      scene.fog.near = THREE.MathUtils.lerp(260, 60, rainAmt); scene.fog.far = THREE.MathUtils.lerp(1500, 380, rainAmt);
      const spread = p3 < .7 ? 4 : 4 + storm * 26;
      scatter.forEach((s, i) => { const st = .2 + i * .08, k = seg(p3, st, st + .1); s.visible = p3 > st && p4 < .05 && (i === 0 || p3 > .45);
        const a = i * 2.4; s.position.set(GX[2] + Math.cos(a) * spread * k, 34 - k * 33.5, GZ[3] + Math.sin(a) * spread * k); s.rotation.set(t, t * .7, 0); });
      eveDrone.visible = p3 > .3 && p4 < .05; eveDrone.position.set(GX[4] + Math.sin(t * .7) * 20, 22, GZ[1] + Math.cos(t * .5) * 16);
      if (p3 > .3 && p3 < .7) { ring.material.opacity = Math.max(ring.material.opacity, seg(p3, .32, .4) * .9); ring.position.set(GX[2], .4, GZ[3]); } }

    // Chapter 4: the frame grows, Eve gets lost, the quantum lab
    { const p = P[4];
      frameI.count = Math.floor(beams.length * seg(p, .02, .6));
      lostDrone.visible = p > .3; lostDrone.position.set(SITE.x + Math.sin(t * .8) * 16, 14 + seg(p, .3, .7) * 20 + Math.sin(t * 1.3) * 6, SITE.z + Math.cos(t * .6) * 16);
      qc.rotation.y = t * .4;
      beamsQ.forEach((bq, i) => { const k = (t * .6 + i / 3) % 1, on = seg(p, .7, .78), len = 10 + k * 34;
        bq.position.set(lab.position.x - 8 - len / 2, 10 - i * 1.5, lab.position.z + i * 2 - 2); bq.scale.set(1, len, 1); bq.rotation.z = Math.PI / 2; bq.material.opacity = on * .8 * (1 - k); }); }

    // Chapter 5: the clock, the keys
    { const p = P[5];
      hand.rotation.z = -seg(p, .05, .5) * Math.PI * 1.5;
      const k = seg(p, .45, .68); keyA.visible = keyB.visible = p > .42 && p < .78;
      keyA.position.set(SQ.x - 20 + k * 18, 28 + Math.sin(k * Math.PI) * 6, SQ.z + 14); keyA.rotation.y = t;
      keyB.position.set(SQ.x + 20 - k * 18, 28 + Math.sin(k * Math.PI) * 6, SQ.z + 14); keyB.rotation.y = -t + Math.PI; }

    // ambient life: rotors, traffic
    for (const d of [courier, hopper, eveDrone, lostDrone]) d.userData.rotors.forEach((r: Any) => { r.rotation.y += dt * 40; });
    for (const tr of traffic) { tr.k = (tr.k + tr.speed * dt * 4 + 1) % 1;
      if (tr.path === "main") { const x = -225 + tr.k * 450; tr.c.position.set(tr.speed > 0 ? x : -x, 0, tr.speed > 0 ? 3.2 : -3.2); tr.c.rotation.y = tr.speed > 0 ? 0 : Math.PI; }
      else if (tr.path === "ns") { const z = -20 - tr.k * 170; tr.c.position.set(tr.lane! + (tr.speed > 0 ? 2.4 : -2.4), 0, tr.speed > 0 ? z : -210 - z); tr.c.rotation.y = tr.speed > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { const x = -85 + tr.k * 170; tr.c.position.set(tr.speed > 0 ? x : -x, 0, tr.lane! + (tr.speed > 0 ? 2.4 : -2.4)); tr.c.rotation.y = tr.speed > 0 ? 0 : Math.PI; } }

    // camera: the shot of the section in the middle of the screen, blending into the next one around the boundary
    let k = 0; for (let i = 0; i < tops.length; i++) if (mid >= tops[i]) k = i;
    const next = Math.min(k + 1, tops.length - 1);
    const blend = next === k ? 0 : smooth((mid - (tops[next] - innerHeight * .9)) / (innerHeight * 1.2));
    const pk = k >= 1 && k <= 6 ? P[k - 1] : 0, pn = next >= 1 && next <= 6 ? P[next - 1] : 0;
    const A = shots[k](pk, t), Bs = shots[next](pn, t);
    const pos = A.pos.clone().lerp(Bs.pos, blend), tgt = A.tgt.clone().lerp(Bs.tgt, blend);
    const follow = still || !camInit ? 1 : 1 - Math.exp(-dt * 6);
    camera.position.lerp(pos, follow); camTgt.lerp(tgt, follow); camInit = true;
    camera.lookAt(camTgt);
    sun.target.position.copy(camTgt); sun.position.copy(camTgt).addScaledVector(keyDir, 400);

    const w = innerWidth, h = innerHeight;
    if (camera.aspect !== w / h) {
      camera.aspect = w / h;
      // on wide screens the story pictures cover the right of the screen: shift the view so the town's action plays out on the left
      if (w >= 820) camera.setViewOffset(w, h, w * .2, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix(); renderer.setSize(w, h, false); composer.setSize(w, h);
    }
    composer.render();
  };
  document.body.prepend(canvas);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => canvas.classList.add("on"));

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); removeEventListener("themechange", onTheme);
    renderer.dispose(); canvas.remove();
  };
}
