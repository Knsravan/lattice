# Lattice

**An explorable explanation of the math that is replacing the internet's locks.**

Quantum computers will break the encryption most of the internet uses today. The replacement — lattice-based cryptography, standardised as ML-KEM (Kyber) — is built on a puzzle almost nobody outside the field understands: *find the nearest dot in a grid that has hundreds of dimensions.* This site lets you play with that grid until it clicks.

Five scenes, one page, nothing to install:

1. **The grid** — drag the basis arrows, throw a ball, find the nearest dot.
2. **Good basis, bad basis** — the same grid described two ways; only one makes "nearest" easy. That difference *is* the secret key.
3. **Add the wobble** — noise turns nearest-dot into Learning With Errors, the heart of Kyber.
4. **Climb the dimensions** — 2D → 3D → 4D, run the LLL attack live, and watch it stop working as the dimension rises.
5. **Kyber, for real** — a toy ML-KEM running in your browser, every value on screen, encrypting a message you type.

## Run it locally

Requires Node ≥ 22.18 and TypeScript (`npm i -g typescript`). No other dependencies.

```
npm test          # core math tests (Node's built-in runner)
npm run coverage  # same, with coverage
npm run build     # tsc → dist/js, copies public/ → dist/
npm run serve     # preview dist/ at http://localhost:5173
```

## Layout

- `src/core/` — pure math, no DOM: lattices, Gram–Schmidt, Babai, LLL (with animation trace), LWE, 4D projection, toy Kyber/ML-KEM, SHA-256.
- `src/scenes/` — one file per scene (in progress).
- `public/` — static page shell.
- `tests/` — mirrors `src/core`.

## Status

Day 1 of a 22-day build (Sept 6 → 28, 2026). Core math done and tested; scenes in progress.

## License

MIT
