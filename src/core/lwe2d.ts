import type { Basis, Vec, Rng } from "./types.ts";
import { add, scale, norm, combine, coordinates } from "./vec.ts";
import { randInt } from "./rng.ts";

/**
 * A picture-sized version of Learning With Errors, for Scene 3.
 *
 *  encode(bit):  ball = (random lattice dot)  +  bit · halfStep  +  wobble
 *                halfStep is half of the owner's first arrow, so a "1" sits exactly between two dots.
 *
 *  decode(ball): write the ball in the coordinates of the basis you hold,
 *                round to the nearest whole numbers (that is the dot you think is nearest),
 *                and look at the leftover along the first arrow:
 *                  near 0   → bit 0,   near ±½ → bit 1.
 *
 * With the private (good) basis the wobble barely moves the coordinates, so the bit survives
 * any wobble shorter than |halfStep|/2. With the public (bad) basis the arrows are long and
 * nearly parallel, so even a tiny wobble swings the coordinates by whole units and the reading
 * becomes a coin flip. With ZERO wobble the coordinates are exact in ANY basis, so anyone can
 * read the bit — the wobble is what makes the public key useless.
 */

export interface Sent {
  bit: 0 | 1;
  dot: Vec; // the lattice dot the sender picked
  clean: Vec; // dot + bit·halfStep, before the wobble
  ball: Vec; // what is actually transmitted
  wobble: Vec; // the noise that was added
}

/** Random wobble: uniform over a disc of the given radius. */
export function randomWobble(magnitude: number, rng: Rng): Vec {
  const a = rng() * Math.PI * 2;
  const r = magnitude * Math.sqrt(rng());
  return [Math.cos(a) * r + 0, Math.sin(a) * r + 0];
}

export function encode2d(publicBasis: Basis, bit: 0 | 1, halfStep: Vec, magnitude: number, rng: Rng, coeffRange = 3): Sent {
  const coeffs = publicBasis.map(() => randInt(rng, -coeffRange, coeffRange));
  const dot = combine(publicBasis, coeffs);
  const clean = bit ? add(dot, halfStep) : dot;
  const wobble = randomWobble(magnitude, rng);
  return { bit, dot, clean, ball: add(clean, wobble), wobble };
}

export interface Read {
  bit: 0 | 1;
  dot: Vec; // the dot this reader thinks is nearest (coordinates rounded)
  coords: Vec; // the ball in this reader's coordinates
  /** leftover along the first arrow, in (-0.5, 0.5]; |leftover| > 0.25 reads as 1 */
  leftover: number;
}

export function decode2d(basis: Basis, ball: Vec): Read {
  const coords = coordinates(basis, ball);
  const rounded = coords.map((c) => Math.round(c) + 0);
  const leftover = coords[0] - rounded[0];
  return { bit: Math.abs(leftover) > 0.25 ? 1 : 0, dot: combine(basis, rounded), coords, leftover };
}

/** The largest wobble the owner can tolerate: a quarter of the first arrow, i.e. half of the half-step. */
export function safeWobble(halfStep: Vec): number {
  return norm(halfStep) / 2;
}

export const halfStepOf = (goodBasis: Basis): Vec => scale(goodBasis[0], 0.5);
