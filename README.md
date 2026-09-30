# Lattice

**An explorable explanation of the math that is replacing the internet's locks.**

Quantum computers will break the encryption most of the internet uses today. The replacement — lattice-based cryptography, standardised as ML-KEM (Kyber) — is built on a puzzle almost nobody outside the field understands: *find the nearest dot in a grid that has hundreds of dimensions.* This site lets you play with that grid until it clicks.

**Live:** https://knsravan.github.io/lattice/

Five scenes, one page, nothing to install:

1. **The grid** — drag the basis arrows, throw a ball, find the nearest dot.
2. **Good basis, bad basis** — the same grid described two ways; only one makes "nearest" easy. That difference *is* the secret key.
3. **Add the wobble** — noise turns nearest-dot into Learning With Errors, the heart of Kyber.
4. **Climb the dimensions** — 2D → 3D → 4D, run the LLL attack live, and watch it stop working as the dimension rises. A chart repeats the attack on random grids up to 40 or 60 dimensions (you pick how many grids), and a short panel explains why Shor's algorithm breaks today's locks but Grover's doesn't break grids.
5. **Kyber, for real** — a toy ML-KEM running in your browser, every value on screen, encrypting a message you type — with its sizes next to real ML-KEM-768 for scale.

A slowly shearing lattice sits behind the title. The page follows the system "reduce motion" setting: transitions jump to their end and the background and 4D view hold still.

## Run it locally

Requires Node ≥ 22.18 and TypeScript (`npm i -g typescript`). No other dependencies.

```
npm test          # core math tests (Node's built-in runner)
npm run coverage  # same, with coverage
npm run build     # tsc → dist/js, copies public/ → dist/
npm run serve     # preview dist/ at http://localhost:5173
```

## Voice narration

The scroll stories can read every step aloud. The clips are recorded with [Voicebox](https://github.com/jamiepine/voicebox), in its "BNP Brand Voice" profile:

```
# with the Voicebox app open on this computer
npm run voice                     # records new/changed steps into public/voice/
npm run voice -- --only c0-s0     # record one step (to test, or redo a clip)
npm run voice -- --list           # show your Voicebox voice profiles
npm run voice -- --voice "<name>" # use another profile
npm run voice -- --force          # re-record everything
```

Voicebox makes WAV files; if `ffmpeg` is installed, each clip is saved as a small MP3 instead.

Commit `public/voice/` and deploy. Visitors turn Voice and Sound effects on with the switches in the corner (both start off).

## Real video footage behind the page

The background can be real filmed footage: one clip per chapter, which plays forward and backward as you scroll, with day clips in the light theme and night clips in the dark one. The clips come from [Pexels](https://www.pexels.com/license/) (free to use). Fetch them on your own computer. You need `ffmpeg` and a free API key from https://www.pexels.com/api/:

```
set PEXELS_API_KEY=your-key                  # Windows (macOS/Linux: export PEXELS_API_KEY=your-key)
npm run footage -- --dry-run                 # show which clips it would use; writes footage-candidates.html
npm run footage                              # download and prepare all 14 clips into public/footage/
npm run footage -- --pick grid-day=1234567   # swap one clip (ids are in footage-candidates.html)
npm run footage -- --pick grid-day=1234567,shake-night=7654321   # swap several at once
npm run footage -- --only grid --force       # redo one chapter
```

Commit `public/footage/` and deploy. The 3D town below keeps showing until every chapter has a clip.

## Real-world textures and models for the 3D town

The 3D town behind the chapters can use real photographed textures and scanned props (all CC0). Download them on your own computer:

```
npm run assets                  # into public/town/: facades, bricks, roof tiles, asphalt, paving, grass, concrete (ambientCG) + street props (Poly Haven)
npm run assets -- --dry-run     # just list what it would download
npm run assets -- --only facade --force   # redo one set
```

The originals land in `public/town/textures` and `public/town/models` (not committed); the site uses the web-sized copies in `public/town/web/`, made from them with gltf-transform and sharp. `public/town/assets.json` records where each file came from.

## Layout

- `src/core/` — pure math, no DOM: lattices, Gram–Schmidt, Babai, LLL (with animation trace), LWE, the Scene 4 attack, 4D projection, toy Kyber/ML-KEM, SHA-256.
- `src/scenes/` — one file per scene, plus `draw2d.ts` (shared 2-D drawing) and Scene 4's chart and worker.
- `src/ui/` — `copy.ts` (all narration text), `dom.ts` (DOM helpers, animation easing, reduced-motion check), `hero.ts` (flat title lattice, the last fallback), `footage.ts` (real video background, scrubbed by scroll), `town.ts` (the 3D town behind the page), `theme.ts` (light = day, dark = night), `smooth.ts` (glide scrolling), `reveal.ts` (scroll reveal effects, progress line).
- `src/types/three.d.ts` — minimal types for the parts of Three.js Scene 4 uses (Three.js itself loads from the CDN at runtime).
- `public/` — static page shell.
- `tests/` — mirrors `src/core`.

## Status

Complete: all five scenes, polish, and every idea from `NOTES.md` are live on GitHub Pages. 70 core tests, 100% line coverage of `src/core`.

Scene 4 needs Three.js from jsDelivr — if it can't load, only the 3D view is disabled and the rest of the page works. Still to confirm on a real 2020-class laptop: 60 fps in Scene 4.

`NOTES.md` has what was tried, decided and deferred along the way.

## License

MIT
