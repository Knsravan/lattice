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

## Skipped / deferred
- Nothing yet.

## Ideas (not in scope unless promoted)
- Hero: put the slowly shearing lattice from the placeholder behind the title (polish week).
- Scene 4: a "Grover vs Shor" one-paragraph panel explaining why quantum helps against factoring but not lattices.
- Scene 5: show real ML-KEM-768 key sizes next to the toy ones for scale.
