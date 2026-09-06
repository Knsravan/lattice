# NOTES

## Day 1 — Sept 6
- Build machine has no npm / GitHub egress → went zero-dependency (tsc + node --test + Three.js from CDN). Decision, not a workaround: keep it.
- LLL bug found by tests: after a swap, Gram–Schmidt rows *after* k were stale. Fixed by refreshing rows k-1..n-1.
- `Math.round(-0.4)` is `-0`; deepEqual treats -0 ≠ 0. Coefficients are normalised with `+ 0`.
- LLL speed in Node: n=20 ≈ 150 ms, n=30 ≈ 250 ms, n=40 ≈ 0.9 s (random ±50 integer bases). Scene 4 chart is feasible live.
- Scene 4 framing corrected: LLL always *finishes*; what fails in high dimension is *quality* (secret not recovered). Chart "attack success vs dimension", not just time.
- Toy Kyber presets: `toy` (n=4,q=17) fails ~20% of the time — that is a feature to show, not a bug. `demo` (n=8,q=257) is reliable. `realShape` is ML-KEM-512-shaped and runs fine in JS.

## Skipped / deferred
- Nothing yet.

## Ideas (not in scope unless promoted)
- Scene 4: a "Grover vs Shor" one-paragraph panel explaining why quantum helps against factoring but not lattices.
- Scene 5: show real ML-KEM-768 key sizes next to the toy ones for scale.
