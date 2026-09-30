# NOTES

## Day 1 — Sept 6
- Build machine has no npm / GitHub egress → went zero-dependency (tsc + node --test + Three.js from CDN). Decision, not a workaround: keep it.
- LLL bug found by tests: after a swap, Gram–Schmidt rows *after* k were stale. Fixed by refreshing rows k-1..n-1.
- `Math.round(-0.4)` is `-0`; deepEqual treats -0 ≠ 0. Coefficients are normalised with `+ 0`.
- LLL speed in Node: n=20 ≈ 150 ms, n=30 ≈ 250 ms, n=40 ≈ 0.9 s (random ±50 integer bases). Scene 4 chart is feasible live.
- Scene 4 framing corrected: LLL always *finishes*; what fails in high dimension is *quality* (secret not recovered). Chart "attack success vs dimension", not just time.
- Toy Kyber presets: `toy` (n=4,q=17) fails ~20% of the time — that is a feature to show, not a bug. `demo` (n=8,q=257) is reliable. `realShape` is ML-KEM-512-shaped and runs fine in JS.

## Day 1 evening — Scene 1
- Page shell is built from `copy.ts` by `main.ts`; each scene gets a sticky prose column + a 4:3 stage. Nav dots on the right.
- Scene 1 is plain canvas 2D. Density: 1 world unit = min(w,h)/9 px. Dots capped at 3000 (`pointsInBox`).
- Ball throw uses `closestVectorExact`; dragging re-solves the ball against the new grid so the highlight stays honest.
- Degenerate basis (|det| < 0.12) shows a warning in the readout instead of an exploding grid.
- Headless Chromium check via Playwright (scratch script) — no console errors on desktop or 390px mobile.

## Day 1 night — Scene 2
- Good basis is an *orthogonal* pair rotated ~15° ([1.2,.32],[-.32,1.2]) so Babai nearest-plane is exact with it; a merely "nearly square" pair still misses ~6% of throws, which would muddy the story.
- Bad basis = [2g1+g2, 3g1+2g2] (det 1 ⇒ same lattice). Babai misses ~60% of throws with it. "Throw 20 balls" makes the tally land in seconds.
- Shared 2-D drawing moved into `scenes/draw2d.ts` (viewport, dots, cell, arrows, ball, rings). Scene 1 still has its own copy; fold it in during polish.
- Toggling the basis re-judges existing throws so the picture stays consistent; the tally is kept per basis.

## Day 1, late — Scene 2 fixes from the user's screen recording
- Red basis only missed ~38% on the user's screen; replaced with [3g1+g2, 2g1+g2] (71% in simulation, 65% measured in-browser at 3 viewport sizes). Both arrows now fit on the canvas.
- Switching basis used to re-judge old throws (picture said "missed", tally said 0/0). Now switching clears the canvas; counts stay per basis.
- "Throw 20 balls" shows a running "x of y wrong so far" in the readout.
- Copy rule adopted from feedback: say the payoff first, then give instructions that quote the exact button names; define every term (basis) the first time it appears.

## Day 1, night — Scene 3
- First decoder design (nearest dot via Babai, compare offset to 0 vs ±half-step) LEAKED in 2D: when the eavesdropper's wrong dot differs by a lattice vector perpendicular to the half-step, the comparison still reads correctly (eavesdropper 100% at small wobble). Replaced by the honest LWE analogue: round the ball in your own coordinates, read the leftover along arrow 1. In the bad basis a tiny wobble swings coordinates by whole units → coin flip.
- Brute-forced public keys again: [4g1+g2, 3g1+g2] blinds the eavesdropper at wobble ≈0.25 (50%) while the owner's safe limit is 0.31. Uglier keys blind sooner but their arrows leave the canvas.
- Sender picks dots with the good basis purely so they spread across the window (any basis of the same lattice picks the same dots).
- Walkthrough script (scratch) checks every quoted control exists and the four promises in the text: owner 42/42 at default wobble, eavesdropper 25–75%, both 20/20 at zero wobble, owner < 100% at 0.6.

## Day 2 (Sept 29) — Scene 4
- LLL rewritten with the textbook incremental Gram–Schmidt updates (O(n) per step, no row recompute). q-ary n=32 went from 2.5 s to ~8 ms; n=40 ~15 ms. The 2 s cap is kept (`shouldStop`) but never fires on a laptop. Trace recording is now optional (`trace: false` for sweeps).
- Attack lattice (`core/attack.ts`): q-ary [I | A ; 0 | qI], q = 97, k = n/2, wobble uniform in ±3. Brute-tuned: LLL+Babai recovers the secret ~90% at n ≤ 12, ~60% at 24, ~25% at 30, ~0–5% at 40. Success = Babai lands on a point at least as close as the planted one (at n = 2 the wobble sometimes makes another dot nearer; counting that as a miss made the chart dip at 2D).
- Secondary chart line uses Kannan's embedding: LLL's shortest vector ÷ |(error, 1)|. Rises from ~1.0 to ~1.15 by n = 40. Small effect; kept small on the chart.
- Chart sweep runs in a module worker (`scene4-worker.ts`), 20 grids × dims 2,4,…,40, ~1 s total; bars are revealed one per 90 ms. Main-thread fallback if module workers fail.
- Three.js is imported dynamically so a CDN failure only disables the 3D view (message in the readout); scenes 1–3 and the chart keep working. `src/types/three.d.ts` declares only what Scene 4 uses (no @types/three).
- Sandbox can't reach the jsDelivr CDN; tested in headless Chromium by routing the CDN URLs to `npm pack three@0.170.0` in a scratch dir (not in the repo). Desktop + 390 px: no console errors, throws work in 2D/3D/4D, attack animates (3/8/11 steps). FPS under SwiftShader is 22 — software GL, not meaningful; needs a check on a real 2020 laptop.
- 3D camera sits at (-5, 3.2, 5.8): from the (+,+,+) side the bad arrows pointed at the camera and looked like stubs.

## Day 2 (Sept 29) — Scene 5
- New `scene` preset n=8, q=97, k=2, eta=1: every number ≤ 2 digits. Worst leftover wobble over 5000 keys is 13 of the 24 allowed, so it never fails on screen. `kyberKeygen` now also returns `e` so the panel can show t = A·s + e.
- "Pushed half way round" is 49, not 48 (round(97/2)); copy says 49.
- Deviation from the Stack line "Scenes 4–5 use Three.js": Scene 5 uses plain 2-D canvas only. Its spec asks for "show it on the lattice" with Scene 1–3 visuals, which are 2-D, and nothing in it needs 3-D. The user approved; the Stack line now reads "Scenes 1–3 and 5 use plain 2D `<canvas>`. Scene 4 uses Three.js."
- Three panels (Make keys / Lock / Unlock), numbers fade in staggered. Unlock shows a 97-hour clock: the 8 values of v slide the short way round to v − s·u and cluster at 0 and at the far side. No index labels on the clock — they collided exactly because the values cluster.
- "show it on the lattice" switches the 2D canvas above the panels to Scene 2/3 visuals (Scene 3's GOOD/BAD, now exported), driven by the real 8 bits of m: keys = green/red arrows + A·s wobbled to t; lock = 8 balls; unlock = the owner's reading of each ball.
- Shared key shown as the first 16 hex digits. The message is XOR-sealed with the shared key (demo only, as the spec says).
- Tested headless (desktop + 390 px): full flow recovers the bits, keys match, typed message opens; no errors except the deliberately blocked CDN.

## Day 2 — Polish (pass 1)
- Scene 1 now draws with `draw2d.ts` (253 → 165 lines); pixels match the old code (same sizes, colours, alphas).
- "Nothing snaps" audit: Scene 1 "Reset arrows" glides back over 0.5 s and keeps the ball, re-solving it as the grid moves; Scenes 2–3 "Clear" fades the throws out over 0.3 s; Scene 4 chart re-run shrinks the old bars instead of blanking. `draw2d` helpers now multiply the current globalAlpha (was: overwrite) so a caller can fade a whole layer; identical output when the base alpha is 1.
- Readouts wrap on phones (≤ 520 px) instead of ending in "…".
- QA pass, headless Chromium, desktop + 390 px, all five scenes driven: no console errors, no horizontal scroll.
- README updated for five shipped scenes.

## Day 2 — Polish (pass 2): spec audit
- Scene 1 broke "no numbers on screen except optional coordinates toggle": the readout always showed coefficients and distance. Now it says "The nearest dot lights up…" and shows the numbers only with “Show coordinates” on.
- Narration rule: user-facing strings that lived in scene files (Scene 1 readout, canvas aria-labels, Scene 2 "b₁/b₂", Scene 5 "A·s" / "t = A·s + e") moved to `copy.ts`.
- Colours: Scene 4's nearest-dot highlight was white; now green like the nearest dot in Scenes 1–3.
- Accessibility: `aria-pressed` on the Good/Bad and 2D/3D/4D toggles, group labels, visible keyboard focus rings.
- Inline SVG favicon (the page used to request /favicon.ico and get a 404).

## Day 2 — Hero (promoted from Ideas by the user)
- `src/ui/hero.ts`: the Day-1 placeholder's shearing lattice, rebuilt on `draw2d`. b₁ = (1, 0) fixed, b₂ = (0.9·sin t, 1) swinging at ~0.22 rad/s; faint dots plus the two green arrows. Origin sits right of the title on desktop, low-centre on phones; a CSS radial mask fades it out under the text. aria-hidden; runs only while the hero is on screen.
- Full-bleed needs a 100vw canvas; `body { overflow-x: clip }` stops the scrollbar-width overflow without breaking `position: sticky` (which `hidden` would).
- QA: no horizontal scroll, sticky prose still sticks, no console errors (desktop + 390 px).

## Day 2 — Reduced motion (promoted from Ideas by the user)
- `reducedMotion()` in `ui/dom.ts` reads `prefers-reduced-motion` live. Under it `easeOut` jumps (0 before start, 1 after — so sequencing like "line after the ball lands" is kept), `approach` returns the target, and the new `pulse()` holds still. Every scene gets this for free through those helpers.
- Continuous motion stops: the hero shows a still, already-sheared grid (t starts at 0.7 for everyone now); the 4D view stops spinning; Scene 4's highlight ring stops turning. Scene 5's "show it on the lattice" scrolls instantly. CSS: no smooth scroll, fades/transitions cut to 1 ms.
- LLL attack still steps (one step per ~120 ms) — each step jumps instead of gliding, so the trace stays readable.
- Tested with Playwright `reducedMotion: "reduce"` vs `"no-preference"`: hero and 4D frames identical 1.5 s / 1 s apart only under reduce; attack runs all 11 steps in both; no errors.

## Day 2 — ML-KEM-768 sizes (promoted from Ideas by the user)
- Core: `mlkemSizes()` computes FIPS 203 byte sizes from (k, du, dv): public key = 384k + 32, ciphertext = 32(du·k + dv). Tested against all three sets (512: 800/768, 768: 1184/1088, 1024: 1568/1568). `toyKemSizes()` counts exactly what Scene 5 shows at 7 bits per number: 42 B public key (A in full + t), 21 B ciphertext, 32 B shared key — the test cross-checks it against a real keygen/encaps.
- Scene 5 "For scale" box under the three panels: toy vs ML-KEM-768, one pair of bars per row in the meaning colours (public key red, ciphertext orange, shared key green). Bars grow when the box first scrolls into view (IntersectionObserver); instant under reduced motion.
- Copy notes the two honest differences: real ML-KEM sends a 32-byte seed instead of A, and compresses the ciphertext.

## Day 2 — Grover vs Shor panel (promoted from Ideas by the user)
- Scene 4, under the chart: two cards. Shor finds hidden repeating patterns → RSA / elliptic curves broken (red verdict). Grover only square-roots blind guessing (a million guesses → a thousand); grids have no pattern for Shor and Grover-style search trims the attack only a little → grids safe, just a bit bigger (green verdict). Text in `copy.ts` (`scene4.quantum`); the narration's single quantum paragraph is unchanged, as the spec asks.
- Cards sit side by side on desktop, stacked on phones. No numbers or formulas beyond "a million → a thousand".

## Day 2 — Chart settings (promoted from Ideas by the user)
- Under the Scene 4 chart: "Grids per dimension" 5 / 20 / 50 (default 20) and "Climb to" 40D / 60D (default 40). Picking either re-runs the chart at once (the 3D attack is untouched).
- Measured in Node before adding 60D: slowest single attack at n = 60 ≈ 130 ms (cap is 2 s); 20 grids × 2…60 ≈ 13.5 s total, 50 grids ≈ 35 s — all in the worker, chart fills in as it goes. Success is 0/20 from 44D up; the shortest-arrow ratio keeps climbing to ≈ 1.66 at 60D.
- Chart adapts: x-axis ticks every 10 up to the top dimension, ratio scale 0.8–1.8 when climbing to 60 (0.8–1.3 at 40).
- No core changes — same `plantedInstance` / `runAttack`, just different dims and trial counts.

## Day 2 — Rebuild as a scroll story (user feedback: "not understandable for a 15-year-old")
- User chose: add Chapter 0 (the problem first), named characters (Alex sends, Sam receives, Eve snoops), and roll out Chapters 0 + 1 first for review before touching 2–5.
- `ui/story.ts`: sticky picture + one-or-two-sentence steps. The step crossing a trigger band becomes active and its animation clock restarts (replays on scroll-back). Band = middle of the screen on desktop; on phones the pinned picture covers the top half, so the band sits at ~72% where the text actually is (first try used the middle and the animated step was hidden under the picture).
- `scenes/story-draw.ts`: painters (person, bubble, computer, envelope, padlock, key, browser bar, quantum chip) + `prog()`/`loop()` timing that jump to the end under reduced motion.
- Chapter 0 (10 steps, no maths): message hops through computers → Eve copies → lock it → but the key? → padlock dance (Sam's open padlock out, locked box back, Eve holds a locked copy) → browser padlock → 37 × 53 = 1,961 easy vs. guessing backwards → quantum chip goes back fast, padlock breaks, Eve's saved copies open → dots.
- Chapter 1 (9 steps): arrow A → a walker leaves a row of dots → arrow B → rows slide out along B → "lattice"/"basis" with a ripple → a trip 3 × A + 2 × B (camera glides to follow it, it ran off the tall picture otherwise) → ball → measure lines to the 5 nearest dots (new `core.nearbyPoints`, tested) → zoom out. Same arrows as the playground that follows.
- Scene 1 playground now labels arrows A and B (was b₁, b₂) to match the story; Scenes 2–5 renamed "Chapter 2–5" only.
- Checked every step at 1280 × 860 and 390 × 844 via screenshots; no console errors.

## Day 2 — Clearer padlock + addresses; voice and sound effects (user feedback)
- Padlock step split into four, each playing once and stopping on its end picture (no more looping): (a) Sam's padlock + key, "stays with Sam"; (b) the OPEN padlock travels to Alex, Eve's copy says "can only lock ✓"; (c) Alex's box, the padlock clicks shut; (d) the locked box travels, Eve's copy "no key!", Sam's key opens it. The missing idea was said out loud: a padlock can only lock.
- "Trip from the centre" → "every dot has an address": a walker hops 3 × A then 2 × B with a live step counter; the dot lights up "(3, 2)". Then backwards "(−1, 2)", then half a step → red ✗ "no dot here". Camera pulls back during the long walk (it ran off the edge).
- Sound effects: Web Audio synthesis in `ui/sound.ts` (pop, blip, hop, tick, whoosh, snap, click, unlock, ding, buzz, nope, zap, crack, shimmer). Chapters fire them with `frame.cue(at, name[, period])` from the animation timeline, so they line up with what moves.
- Voice: VoiceStudio (user's pick). Tried to run it in the sandbox: its OmniVoice model downloads from Hugging Face, which is blocked here (403), as are hf-mirror/modelscope and GitHub release downloads; no GPU either. So `scripts/voice.mjs` (`npm run voice`) records the clips against the user's own running VoiceStudio (its OpenAI-compatible /v1/audio/speech, as its bundled skill documents), writing public/voice/*.mp3 + manifest.json with each clip's text. Tested end-to-end against a stand-in server: all 24 clips, re-run skips unchanged steps, unreachable server gives a clear message, the page requests the right clip per step and stops when Voice is off.
- `public/voice/manifest.json` ships as `{}` so there is no 404; the Voice switch is greyed out ("recordings haven't been added yet") until clips exist.
- Both switches start OFF (browsers block sound before a click anyway); the choice is remembered in localStorage. On phones they shrink to two icons in the picture's top-right corner — at the bottom they covered long step text.

## Day 2 — Chapters 2–5 as stories; natural sound effects
- Chapter 2 (8 steps): green pair → red pair → swap, dots don't move ("same dots") → short green walk to (1,1) vs red walk (−1, 2) in red steps → finder (Babai, core) with green: right; with red: wrong dot 1.8 away, real one next to the ball → Sam private / Eve public. Ball (0.4, 0.5) found by searching with core. Uses Scene 2's pairs (exported) so the playground below matches.
- Chapter 3 (9 steps): 0 on a dot, 1 exactly halfway (encode2d with no shake), Eve reads both → shake → Sam reads right, Eve wrong → 10 bits (seed 1735: Sam 10/10, Eve 5/10) → too much shake (seed 934, 0.62: Sam 5/10, Eve 5/10). All from core encode2d/decode2d.
  - Correction found while picking examples: Eve's rounded dot is never "whole dots" away — over 10k cases it lands within 0.82 of the ball (median 0.59). What goes wrong is that it's the wrong *neighbouring* dot, so her leftover is nonsense. Copy says that now; the example (seed 1595) shows Sam's and Eve's dots clearly different.
- Chapter 4 (8 steps): LLL's real 2-D trace, one labelled move at a time ("shorten"/"swap") → tidy, Eve opens the padlock → "500 directions" burst → the live chart (the real attack in the worker, 10 grids × 2…40; the chart now has `paint()` so it draws inside the story) → "Eve finds the secret" vs "safe" → real padlocks 500–1,000 → → quantum: finds the repeating pattern in today's puzzle, finds none in the grid.
- Chapter 5 (8 steps): the 97-hour clock wrapping 96 → 0 → Sam's secret → jumble, shake, padlock → Alex's key, 1s → 49, sent → Eve sees a mess → the clock splits the eight numbers into 0s and 1s, "Sam reads" = Alex's key → same key ✓. All numbers from core kyber with fixed seeds.
- Playgrounds renamed "Chapter N · Try it yourself", text cut to the buttons; Scene 3's "Owner/Eavesdropper" → Sam/Eve.
- Sound effects redone: modelled on real sounds (bell partials for arrivals, a metallic click + thunk for the padlock, a key-turn for unlock, footsteps for the walker, rising air for travel, a woodblock for counting, a shutter for Eve's copies), a shared small-room reverb, soft low-pass, ±2.5% random detune, stereo pan that follows the object (`frame.pan(x)`), and durations matched to each animation (`dur`). Checked in the browser: every chapter fires its effects (20–94 sounds per chapter while scrolling), placed left/centre/right; no errors.
- Phones: nothing important in the picture's top-right corner (the sound switches live there).

## Skipped / deferred
- Nothing yet.

## Ideas (not in scope unless promoted)

## Day 3 — Voice engine: Voicebox (user decision, Sept 30)
- The user installed VoiceStudio on their Windows laptop (CPU only, no NVIDIA card), made an "Education" profile, then chose to drop VoiceStudio for Voicebox (jamiepine/voicebox) with their "BNP Brand Voice" profile.
- Clips are recorded without the profile's saved effects (`effects_chain: []`): the user's profile had Echo Chamber on, and Voicebox applies a profile's effects whenever the request doesn't send its own list.
- `scripts/voice.mjs` now talks to Voicebox's own REST API (read from its source): `GET /profiles` (profile found by name or id), `POST /generate` {profile_id, text, language, seed, engine}, then the `/generate/{id}/status` event stream until completed/failed, then `GET /audio/{id}` (WAV). A profile's own engine (preset/designed voices) is sent explicitly, because the request's engine defaults to "qwen". Fixed seed 7.
- Voicebox only returns WAV (~10× larger than MP3). If ffmpeg is on the user's PATH each clip is converted to 64 kbps mono MP3; otherwise the WAV is kept (the page plays either). The VoiceStudio-only `--samples`/`--design` modes were removed; `--only c0-s0,…` added to test or redo single clips.
- Tested against a stand-in Voicebox server: list, one step, all 57, re-run skips all, unknown profile and closed app give clear messages, MP3 path (fake ffmpeg) replaces the WAV and updates the manifest.

- All 57 clips recorded on the user's laptop (CPU, 33–187 s per clip, ~70 min) and pushed as branch voice-clips. Checked here: every manifest entry matches its step's text in copy.ts, every file is MP3, 3.5 MB total; in the browser the Voice switch is enabled and each step requests its own clip, no errors.

## Day 3 — Complete polish: no scrollbar, own scroll feel, 3D backdrop (user request, Sept 30)
- Scrollbars hidden everywhere (`scrollbar-width: none` + `::-webkit-scrollbar`), with a 2 px progress line in the three colours instead.
- Glide scrolling (`ui/smooth.ts`) animates `window.scrollTo`, rather than moving the page with a transform, so `position: sticky` (the story pictures) keeps working. Mouse/trackpad only; touch keeps native. Wheel events a scene already handled (the Scene 4 3D view's zoom calls preventDefault) are left alone, as are ctrl-zoom and elements that scroll by themselves. Nav-dot trips follow the section's live position, because the page can grow while travelling (they first stopped 57 px short).
- Reveal effects set once per element with IntersectionObserver; `.reveal-ready` is only added by JS, so without it nothing is hidden. Reduced motion makes every transition instant (checked: 0 hidden elements on screen).
- 3D backdrop: first try with 11³ points looked like dust; 9³, wider spacing, and each chapter's camera nearly along an axis (so the dots line up into rows) read as a lattice. The title was also caught a third of the way into the Chapter 0 morph because the title section is short: morphs now run from 0.3 to 1.05 screen heights around each chapter's start. A text glow keeps the title readable over the dots. On phones the pinned picture is solid, because frosted glass showed the step text sliding under it as a blur.
- Fallback: with the CDN blocked, the flat 2D hero lattice mounts instead (checked). No errors at 1280×820 or 390×844.
- To check on a real laptop: 60 fps with the backdrop plus the frosted panels (the blur is recomputed every frame over the moving backdrop). If it stutters, drop the backdrop-filter first.

