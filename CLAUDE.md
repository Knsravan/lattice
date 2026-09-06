# Lattice — Project Spec

Hard deadline: **September 28, 2026**. Scope is frozen: the five scenes below, nothing more.


### Audience and tone
A curious 15-year-old, or an adult developer who has never studied cryptography. Every screen must be understandable without prior math. Short sentences. One idea per scene. No formula appears before the picture that explains it.

### Stack (fixed, do not change) — ZERO npm dependencies
- TypeScript (strict) compiled with `tsc` straight to ES modules in `dist/js`. No bundler.
- Imports inside `src/` and `tests/` use `.ts` extensions; `rewriteRelativeImportExtensions` turns them into `.js` on emit.
- Tests: Node's built-in runner (`node --test`, Node ≥ 22.18 strips types natively). `npm test`, `npm run coverage`.
- Three.js is loaded at runtime by the visitor's browser via an `<script type="importmap">` pointing at a CDN
  (`https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` and `.../examples/jsm/` for addons). Never vendored, never installed.
- Scenes 1–3 use plain 2D `<canvas>`. Scenes 4–5 use Three.js.
- No frameworks. Vanilla DOM + a small hand-written scroll/scene manager.
- Static files live in `public/` and are copied to `dist/` by `npm run build`. `npm run serve` previews `dist/` on port 5173.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main` (installs only `typescript` globally).
- Zero backend, zero accounts, zero analytics, zero external API calls other than the Three.js CDN.
- Why: the build machine has no npm/GitHub network access, and fewer moving parts = fewer surprises before the deadline.

### Repository layout
```
lattice/
  CLAUDE.md                 # this spec
  index.html
  src/
    core/                   # PURE MATH. No DOM, no Three.js imports. Fully tested.
      lattice.ts            # Lattice class: basis, points in a window, gram-schmidt
      cvp.ts                # closest-vector: exact for dim<=3 (enumeration), Babai nearest-plane for any dim
      lll.ts                # LLL reduction that yields step-by-step trace (for animation)
      lwe.ts                # toy LWE: keygen, encrypt one bit, decrypt, with noise
      kyber.ts              # toy ML-KEM over Z_q[x]/(x^n+1): n=4..16, q small; keygen/encaps/decaps
      project4d.ts          # 4D -> 3D projection (perspective + rotation in 6 planes)
      types.ts
    scenes/
      scene1-grid.ts
      scene2-basis.ts
      scene3-noise.ts
      scene4-dimensions.ts
      scene5-kyber.ts
    ui/                     # scroll manager, sliders, buttons, narration text
    main.ts
  tests/                    # mirrors src/core (node --test)
  scripts/build.mjs         # tsc + copy public/ → dist/
  scripts/serve.mjs         # local static preview
  .github/workflows/deploy.yml
  README.md
  NOTES.md                  # things tried, skipped, or deferred — plus "Ideas"
```

`src/core` is the heart. It must be importable from Node with no browser globals so tests run headless. Every function in `core` has a test. Coverage of `core` is at 100% lines; keep it above 90%.

**Status:** Day 1 (Sept 6) done — core math complete and tested. Scenes not started.

### The five scenes (frozen scope)

**Scene 1 — The grid.**
A 2D lattice of dots on canvas. Two draggable arrows from the origin are the basis vectors b1, b2. Dragging reshapes the grid live. Click anywhere to "throw a ball": the nearest lattice point lights up with a line to it. Narration teaches: lattice, basis, closest vector. No numbers on screen except optional coordinates toggle.

**Scene 2 — Good basis, bad basis.**
Same lattice. A toggle switches between a "good" basis (short, near-perpendicular) and a "bad" basis (long, skewed) that generate the identical grid — prove it visually by fading the dots to show they don't move. With the bad basis, Babai's nearest-plane algorithm visibly picks the WRONG dot when the ball is thrown; with the good basis it picks the right one. Narration teaches: the secret key is just "knowing a good basis."

**Scene 3 — Add the wobble.**
A noise slider (0 → large). Each ball throw is a lattice point plus noise. Show: with small noise and good basis, decryption always works; with bad basis it fails once noise exceeds a visible threshold. Bind this to a 1-bit LWE encrypt/decrypt from `core/lwe.ts`: a "send bit 0 / send bit 1" button, the ciphertext is the noisy point, decryption is nearest-dot with the good basis. Narration teaches: LWE (learning with errors), which is the core of Kyber.

**Scene 4 — Climb the dimensions.** (the showpiece)
- 3D lattice in Three.js with orbit controls, ball throw, nearest point highlight.
- A dimension slider 2 → 3 → 4. At 4, render the 4D lattice as a rotating 3D projection using `core/project4d.ts`; points fade with the 4th coordinate.
- A "Run the attack" button runs LLL from `core/lll.ts` and ANIMATES the trace: basis vectors visibly swap and shorten, step by step, ~100ms per step, until reduced.
- A small side chart, the punchline: as dimension climbs, the attack stops *working*. Important nuance: LLL always finishes (it runs in ~1 s at n=40 in a browser), but the basis it finds stops being good enough — the shortest vector it returns gets longer relative to the true shortest one, and Babai stops recovering the planted secret. So plot **"did the attack recover the secret?"** (success rate over a few random LWE-style lattices per dimension, 2 → ~40) and, secondarily, LLL's shortest-vector length vs. the planted one. Cap each run at 2 s; plot "gave up" past the cap.
- Narration teaches: why hundreds of dimensions defeat all known attacks, including quantum computers (one paragraph, no qubit simulation).

**Scene 5 — Kyber, for real.**
Toy ML-KEM from `core/kyber.ts` with tiny parameters (n=8, q=97 or similar — pick values where every intermediate fits on screen). User types a short message. Show the three steps as panels: keygen (public key = bad basis + noise, secret = good basis), encapsulate (shared secret + ciphertext), decapsulate (recover shared secret). Each panel has a "show it on the lattice" link that draws the corresponding operation using Scene 1–3 visuals. Message is encrypted with the shared secret via XOR just for the demo. Narration teaches: this is the same trick as the grid, and it is what your browser started using in 2024–2025.

### Design rules
- Dark background, one accent color for "the ball / ciphertext", one for "the secret / good basis", one for "the attacker / bad basis". Same three colors in every scene.
- 60 fps on a 2020 laptop. Cap lattice points rendered in a window to keep this true.
- Every interaction has an animated transition; nothing snaps.
- Works on mobile (touch drag), but desktop is the primary target.
- Narration text lives in one file (`src/ui/copy.ts`) so it can be edited without touching scene code.

### Working rules
- Work strictly in the order: core math + tests → scene 1 → 2 → 3 → 4 → 5 → polish.
- Never put math in a scene file. Scenes only call `core` and draw.
- Commit after every passing test run with a one-line message.
- When you finish a task, run the tests, run `npm run build`, and confirm the deployed URL loads before saying you're done.
- If something is taking more than 2 hours, stop, write what you tried in `NOTES.md`, and move to the next item. I will decide.
- Do not add features. If you think something is missing, write it in `NOTES.md` under "Ideas" and continue.

