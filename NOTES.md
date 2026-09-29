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

## Skipped / deferred
- Nothing yet.

## Ideas (not in scope unless promoted)
- Scene 4: a "Grover vs Shor" one-paragraph panel explaining why quantum helps against factoring but not lattices.
- Respect `prefers-reduced-motion` (skip the 4D spin and the drop-in animations).
- Scene 4: let the reader pick how many grids per dimension, or a "run to 60D" button (LLL is fast enough now).
- Scene 5: show real ML-KEM-768 key sizes next to the toy ones for scale.
