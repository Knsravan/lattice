# Lattice — Project Spec

**Name.** The project and site are called **Lattice**. The user's conference paper about it is titled **"Beyond the Lock: An Interactive Explanation of Lattice-Based Post-Quantum Cryptography"** (user decision, Sept 30): use that title only when writing about the paper, not on the site.

Hard deadline: **September 28, 2026**. Scope is frozen: the five scenes below, nothing more.


### Audience and tone
A curious 15-year-old, or an adult developer who has never studied cryptography. Every screen must be understandable without prior math. Short sentences. One idea per scene. No formula appears before the picture that explains it.

### Stack (fixed, do not change) — ZERO npm dependencies
- TypeScript (strict) compiled with `tsc` straight to ES modules in `dist/js`. No bundler.
- Imports inside `src/` and `tests/` use `.ts` extensions; `rewriteRelativeImportExtensions` turns them into `.js` on emit.
- Tests: Node's built-in runner (`node --test`, Node ≥ 22.18 strips types natively). `npm test`, `npm run coverage`.
- Three.js is loaded at runtime by the visitor's browser via an `<script type="importmap">` pointing at a CDN
  (`https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js` and `.../examples/jsm/` for addons). Never vendored, never installed.
- Scenes 1–3 and 5 use plain 2D `<canvas>`. Scene 4 and the page-wide 3D stage use Three.js (the stage falls back to the flat hero lattice if Three.js can't load). The stage also loads a few add-ons from the same CDN (RoomEnvironment, bloom, RoundedBoxGeometry); it has no asset files.
- No frameworks. Vanilla DOM + a small hand-written scroll/scene manager.
- Static files live in `public/` and are copied to `dist/` by `npm run build`. `npm run serve` previews `dist/` on port 5173.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main` (installs only `typescript` globally).
- Zero backend, zero accounts, zero analytics, zero external API calls other than the Three.js CDN.
- Why: the build machine has no npm/GitHub network access, and fewer moving parts = fewer surprises before the deadline.

### Repository layout
```
lattice/
  CLAUDE.md                 # this spec
  README.md
  NOTES.md                  # things tried, skipped, or deferred — plus "Ideas"
  package.json              # scripts only: test, coverage, build, serve (no dependencies)
  tsconfig.json
  public/
    index.html              # page shell: styles, colour tokens, Three.js import map
    voice/                  # narration clips + manifest.json (57 MP3 clips in "BNP Brand Voice")
  src/
    core/                   # PURE MATH. No DOM, no Three.js imports. Fully tested.
      index.ts              # re-exports everything below
      types.ts              # Vec, Basis, Rng
      vec.ts                # vector/matrix helpers: dot, combine, determinant, inverse, coordinates
      rng.ts                # seeded PRNG (mulberry32), randInt, centred-binomial noise
      lattice.ts            # Gram–Schmidt, points in a ball/box, same-lattice test, skewing a basis
      cvp.ts                # closest vector: Babai nearest-plane and rounding (any dim); exact via LLL + search (dim ≤ 4); nearbyPoints
      lll.ts                # LLL with incremental Gram–Schmidt; optional step trace (for animation) and time budget
      attack.ts             # Scene 4: LWE-style q-ary lattices, LLL + Babai attack, Kannan embedding, showcase bases
      lwe2d.ts              # Scene 3: geometric LWE in 2D (encode = dot + bit·halfStep + wobble, decode)
      lwe.ts                # toy modular LWE (Regev): keygen, encrypt/decrypt one bit
      kyber.ts              # toy ML-KEM over Z_q[x]/(x^n+1): presets (scene: n=8, q=97), keygen/encaps/decaps, byte sizes
      hash.ts               # pure-TS SHA-256, XOR keystream
      project4d.ts          # 4D -> 3D projection (perspective + rotation in 6 planes), unrotate
    scenes/                 # draw only; all math comes from core
      draw2d.ts             # shared 2-D canvas drawing (viewport, dots, arrows, ball, rings)
      story-draw.ts         # story picture painters: people, envelope, padlock, key, browser bar, chip; prog/loop timing
      chapter0-problem.ts   # Chapter 0 story (no maths)
      chapter1-grid.ts      # Chapter 1 story (the grid, the question)
      chapter2-basis.ts     # Chapter 2 story (green vs red arrows, the finder right vs wrong)
      chapter3-wobble.ts    # Chapter 3 story (0 on a dot, 1 halfway, the shake, 10 bits, too much shake)
      chapter4-dimensions.ts # Chapter 4 story (LLL's moves, hundreds of directions, the live chart, quantum)
      chapter5-kyber.ts     # Chapter 5 story (97-hour clock, keys, lock, the clock split, same key)
      scene1-grid.ts        # Chapter 1 "Try it yourself" playground
      scene2-basis.ts       # Chapter 2 "Try it yourself" (exports its GOOD/BAD pair for the story)
      scene3-noise.ts       # Chapter 3 "Try it yourself" (exports GOOD/BAD)
      scene4-dimensions.ts  # Three.js view (loaded from the CDN on demand), LLL animation
      scene4-chart.ts       # the success-vs-dimension chart (own canvas, or paint() into a story)
      scene4-sweep.ts       # runs the chart's attacks: module worker, main-thread fallback
      scene4-worker.ts
      scene5-kyber.ts       # panels, 97-hour clock, "show it on the lattice", for-scale box
    ui/
      copy.ts               # ALL narration and on-screen text
      dom.ts                # el/$, canvas sizing, run-while-visible, easing, reduced-motion check, palette
      hero.ts               # flat shearing lattice behind the title (fallback when the 3D stage can't load)
      signal.ts             # the 3D stage: one orb of light and one pool of glowing dots that travel down the page and rebuild into each chapter's piece; aurora, dust, a ribbon of optical fibre
      glass.ts              # liquid glass: cursor sheen, magnetic controls, scroll-speed lean, Chromium lens refraction for the control bar
      smooth.ts             # the page's own scroll feel: eased wheel/keyboard/nav-link scrolling (mouse/trackpad only)
      reveal.ts             # elements appear as they scroll into view; top progress line (scrollbars are hidden)
      story.ts              # scroll-story engine: sticky picture, steps, active-step clock, sound cues, voice per step
      sound.ts              # Voice / Sound-effects switches; Web Audio effects; plays public/voice clips
    types/
      three.d.ts            # minimal types for the parts of Three.js Scene 4 uses
    main.ts                 # builds the page from copy.ts, mounts hero + scenes, nav dots
  tests/                    # node --test, one file per area of src/core
    lattice.test.ts  lll_cvp.test.ts  attack.test.ts  lwe2d.test.ts  crypto.test.ts  project4d.test.ts
  scripts/build.mjs         # tsc + copy public/ → dist/
  scripts/serve.mjs         # local static preview
  scripts/voice.mjs         # npm run voice: record every story step with a running Voicebox → public/voice/
  .github/workflows/deploy.yml
```

`src/core` is the heart. It must be importable from Node with no browser globals so tests run headless. Every function in `core` has a test. Coverage of `core` is at 100% lines; keep it above 90%.

**Status:** Day 1 (Sept 6) — core math complete and tested. Scenes 1, 2 and 3 shipped the same day. Day 2 (Sept 29) — Scene 4 shipped (`core/attack.ts` + worker-driven chart), then Scene 5, then polish (spec audit, animated resets/clears, phone fixes, a11y). The user then promoted every item in NOTES.md "Ideas": hero shearing lattice, prefers-reduced-motion, ML-KEM-768 sizes (Scene 5), Grover vs Shor panel and chart settings — grids per dimension, climb to 60D (Scene 4). All deployed; 70 tests, 100% line coverage of `core`. Open: confirm 60 fps on a real 2020 laptop and the Three.js CDN on the live site. Then the user found the site hard to follow for a 15-year-old and chose a rebuild as a scroll story (see "Format" below): Chapter 0 (new) and Chapter 1 done, 71 tests. User feedback on 0–1: the padlock step and "trip from the centre" step were confusing → split the padlock into 4 steps and replaced the trip with addresses (3, 2), (−1, 2), no half steps; added Voice (clips recorded by the user with `npm run voice`) and synthesized sound effects. Then Chapters 2–5 rebuilt as stories too, and the sound effects redesigned to sound natural and fit each animation. 57 story steps. Sept 30: the user switched the voice engine from VoiceStudio to Voicebox, voice profile "BNP Brand Voice". All 57 clips recorded by the user (clean voice, no effects; MP3, 3.5 MB) and deployed. Then the user asked for a complete polish (see "Look and scroll" below): no scrollbars, the page's own scroll feel with reveal effects, and a 3D backdrop behind everything that follows the story as you scroll. Sept 30: the user asked to replace the ribbon backdrop with a realistic 3D town ("Lattice Town", one continuous town, each chapter's real-world situation acted out, day = light theme, night = dark theme) and chose the real-asset route: A = real HDR skies (Poly Haven CC0), the Khronos "Car Concept" car (CC BY 4.0, credit Eric Chadwick) and Lantern (CC0), town layout in code — prototyped as an artifact; B = `npm run assets` on the user's laptop for photographed facades/ground textures and props. The user ran `npm run assets` (after two fixes to its search/matching) and pushed the downloads; they were shrunk for the web (50 MB → 4.7 MB) and the town replaced the ribbons, with the light theme. Real video footage (Pexels clips scrubbed by scroll) was tried and dropped by the user the same day; instead the town got a realism pass: suburbs on their own streets, farmland and woods out to the hills, dark roofs, lit shopfronts, ambient occlusion (dropped automatically, with other costly looks, if the frame rate can't keep up), natural trees, a calmer night with stars. Then the user found the town repeated the diagrams' scenarios and asked for a unique, realistic background that matches the concepts without explaining them, with the liquid-glass UI and scroll feel of the StringTune site (tune.fiddle.digital). Prototyped as an artifact ("Lattice Signal"), approved ("blown away"), built in: the town, its assets and `npm run assets` are removed. Then the user dropped the Day theme (dark only) and the chapter 0 fibre piece became a real fibre-optic cable (it had looked like a paper strip spilling into the heading). Next: user reviews on a real laptop (60 fps check).

### Format: a scroll story (user decision, Sept 29)
Each chapter is told as a scroll story: the picture stays pinned while short text steps (one or two sentences each) scroll past, and the picture animates to match the step in view (`src/ui/story.ts`). The story starts from a problem the reader already knows and adds one idea per step. The same three people run through every chapter: **Alex** sends, **Sam** receives, **Eve** snoops. Interactive playgrounds come after a chapter's story as "Try it yourself".

All six chapters (0–5) are told this way; each of Chapters 1–5 ends with its original interactive scene as "Try it yourself".

**Sound (user decision, Sept 29).** Two switches pinned in the corner, both OFF until the visitor turns them on (remembered on their device):
- *Voice* reads each story step aloud. Clips are pre-recorded with Voicebox (the user's choice of engine, Sept 30; it replaced VoiceStudio) in the user's "BNP Brand Voice" profile by `npm run voice`, which sends each step's text from `copy.ts` to the user's running Voicebox (`http://127.0.0.1:17493`: `POST /generate`, wait on `/generate/{id}/status`, download `/audio/{id}`) and writes `public/voice/<chapter>-s<step>.mp3` (or `.wav` when ffmpeg isn't installed) + `manifest.json`. The page only plays a clip whose recorded text still matches the step, and the Voice switch is greyed out while the manifest is empty. Voicebox can't run in the cloud sandbox (its models download from Hugging Face, which is blocked there), so the user records the clips on their own machine.
- *Sound effects* are synthesized in the browser with Web Audio (`src/ui/sound.ts`): no files, no network. Each is modelled on a real sound (a small bell for arrivals, a metal click for the padlock, footsteps for the walker, air for things travelling), shares one small room echo, varies slightly each time, and is shaped to its animation: chapters call `frame.cue(at, name, { pan, dur, pitch })` so a sound starts when the thing moves, lasts as long as the movement, and travels left↔right with it.

**Look and scroll (user decision, Sept 30).**
- No scrollbars anywhere; a thin progress line along the top shows how far you are.
- The page's own scroll feel (`ui/smooth.ts`): wheel, keyboard and in-page links glide with an ease instead of jumping; it still moves the real window, so sticky pictures and story steps work as before. Touch screens keep their native scrolling; reduced motion turns it off.
- Reveal effects (`ui/reveal.ts`): headings rise word by word, story pictures and playgrounds zoom up out of a blur, story steps slide in, paragraphs rise one after another. Each element appears once.
- The 3D stage (`ui/signal.ts`, user decision Oct 1, approved from the "Lattice Flow" reference; it replaced one fixed piece per chapter, which replaced Lattice Town and the ribbons): the camera never moves; one orb of light (the sphere) and one pool of glowing dots travel down the page and rebuild themselves into each chapter's piece, each piece held by a slot beside its heading ([data-slot], in page order) and tilting toward the cursor. Title = the wave: a sheet of lattice dots rippling under the floating sphere; scrolling pushes the sphere down through it, the sheet parts where it passes and its halves slide out of the page left and right. Ch. 0 = only the sphere flies on; the halves slide back in from the sides, join as they parted and curl into a globe of points and arcs of light round it (one arc red), inside glass. Ch. 1 = the sphere stays behind; the dots float down as threads and lay themselves along a cube's edges, which becomes glass rods and steel joints. Ch. 2 = the same cube, carried down by the threads, its rods leaning as you read. Ch. 3 = the threads gather into a ball of dots, tumble for a second, and a liquid glass sphere grows from the middle; everything trembles more as you read. Ch. 4 = dots and sphere travel together: the dots ring round gold plates (a quantum computer) and the sphere lands under them as the flat glowing chip, pulses fading as you read. Ch. 5 = only the sphere goes on and becomes the glowing heart while glass plates fly in from the page's left and right edges and close round it, seams turning green. Chapters are long, so each piece waits by its heading and the journey to the next takes the last stretch (at most 1.5 screens) before the next heading reaches mid-screen; a piece left far above is moved to just above the top edge for that journey, so what travels always comes into view. Behind it all: backdrop A "Aurora" (user choice Oct 1): far teal and violet curtains of light with a warm glow following the sphere, dust drifting at many depths, and fine optical fibres running the whole page as one wide ribbon carrying pulses of light. Each chapter opens with its heading card and its piece side by side, sides alternating; on phones the piece sits above the heading. No people, no story events (those belong to the diagrams).
- Liquid glass (`ui/glass.ts` + index.html): the control bar (Voice, Sound effects) is one glass pill at the top (in Chromium it also bends the page behind it like a lens); the chapter dots, hero card, chapter heads, story steps, playground prose and cards, and footer are glass panes: blur and saturate, a bright rim stronger at the top-left, a sheen that follows the cursor. Headings rise letter by letter (words never break); the controls lean toward the cursor; cards lean slightly with scroll speed and settle. System fonts only (no font downloads: the spec allows no calls but the Three.js CDN).
- The diagrams match the stage (user request Sept 30, "make all these match to our 3D background"): the story pictures and playgrounds sit on panes of dark glass (the stage shows through, blurred); in the shared painters (`scenes/draw2d.ts`, `scenes/story-draw.ts`) dots are glass beads (pre-rendered sprites, so thousands stay cheap), arrows are beams of light with a spark running tail to tip, the ball is a glowing orb, rings and dashed lines glow, wires carry flowing light, computers/bubbles/label pills are glass panes, people and objects glow in their colour, the walker is an orb of white light. Scene 4's Three.js view matches too (`scenes/scene4-dimensions.ts`): bead sprites for dots (still sized by distance and faded along w in 4D), beam arrows (coloured core, white centre, soft halo, glowing head, a spark running tail to tip), an amber orb ball, a pulsing ring of green light on the nearest dot. The dots fill the whole box (user request): in 2D the whole face-on view, in 3D/4D a larger cloud (radius 5.8 / 3.4 around the core of 3.0 / 2.4) that runs past the edges and fades with distance; the ball, its line and the ring draw on top so they never get lost. Colours and meanings are unchanged; playground buttons, toggles, pills and inputs are small glass pills. Sparks and flows hold still under reduced motion.
- One theme: dark (user decision Sept 30: "we don't actually need Day theme"; the Day/Night switch and `ui/theme.ts` are gone). The 3D stage is a dark studio. Phones get fewer fibres and lighter geometry. If the frame rate stays low the stage renders at 1× sharpness, then 0.75×, and drops the glow (bloom) only as a last resort (user decision Sept 30: "keep the glow, drop sharpness first").

**Chapter 0 — The problem.** (added by the user, Sept 29; no maths)
Alex sends Sam "meet at 5"; it hops through computers; Eve copies it; locking needs a key they can't share; the padlock trick in four steps (Sam's padlock + key, key stays home → the open padlock travels, Eve's copy "can only lock" → Alex clicks it shut → the locked box travels, Eve's copy stays shut, Sam opens it); that is the browser padlock; today's padlocks rest on multiplying vs. going back (37 × 53 = 1,961); a quantum computer goes back fast and Eve's saved copies open; so: a new puzzle, about dots. Story in `scenes/chapter0-problem.ts`.

**Chapter 1** is Scene 1 below, told as a story first (`scenes/chapter1-grid.ts`: arrow A → row of dots → arrow B → rows stack into a grid → "lattice", "basis" → every dot has an address: a walker hops 3 × A then 2 × B with a step counter → (3, 2) → backwards: (−1, 2) → no half steps (✗) → drop a ball → measure → the question), then the Scene 1 playground as "Try it yourself".

### The five scenes (frozen scope, plus Chapter 0 above)

**Scene 1 — The grid.**
A 2D lattice of dots on canvas. Two draggable arrows from the origin are the basis vectors b1, b2. Dragging reshapes the grid live. Click anywhere to "throw a ball": the nearest lattice point lights up with a line to it. Narration teaches: lattice, basis, closest vector. No numbers on screen except optional coordinates toggle.

**Scene 2 — Good basis, bad basis.**
Same lattice. A toggle switches between a "good" basis (short, near-perpendicular) and a "bad" basis (long, skewed) that generate the identical grid — prove it visually by fading the dots to show they don't move. With the bad basis, Babai's nearest-plane algorithm visibly picks the WRONG dot when the ball is thrown; with the good basis it picks the right one. Narration teaches: the secret key is just "knowing a good basis."

**Scene 3 — Add the wobble.** (shipped)
Geometric LWE from `core/lwe2d.ts`: ball = dot + bit·halfStep + wobble; readers round the ball in their own basis and look at the leftover along the first arrow. Two readers per ball (owner with the good basis, eavesdropper with the bad one), a wobble slider, "Send 0 / Send 1 / Send 20 bits", scores per reader. Zero wobble ⇒ both read 100% (the wobble is the secret's protection); moderate ⇒ owner 100%, eavesdropper ~50%; past |halfStep|/2 ⇒ owner fails too. Narration teaches: LWE, the heart of Kyber. (`core/lwe.ts` — the modular Regev scheme — is kept for Scene 5.)

**Scene 4 — Climb the dimensions.** (the showpiece, shipped)
- 3D lattice in Three.js with orbit controls, ball throw, nearest point highlight.
- A dimension slider 2 → 3 → 4. At 4, render the 4D lattice as a rotating 3D projection using `core/project4d.ts`; points fade with the 4th coordinate.
- A "Run the attack" button runs LLL from `core/lll.ts` and ANIMATES the trace: basis vectors visibly swap and shorten, step by step, ~100ms per step, until reduced.
- A small side chart, the punchline: as dimension climbs, the attack stops *working*. Important nuance: LLL always finishes (it runs in ~1 s at n=40 in a browser), but the basis it finds stops being good enough — the shortest vector it returns gets longer relative to the true shortest one, and Babai stops recovering the planted secret. So plot **"did the attack recover the secret?"** (success rate over a few random LWE-style lattices per dimension, 2 → ~40) and, secondarily, LLL's shortest-vector length vs. the planted one. Cap each run at 2 s; plot "gave up" past the cap.
- Narration teaches: why hundreds of dimensions defeat all known attacks, including quantum computers (one paragraph, no qubit simulation).

**Scene 5 — Kyber, for real.** (shipped, preset `scene`: n=8, q=97)
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

