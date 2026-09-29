/**
 * Scene 4's chart sweep, off the main thread so the 3D view keeps 60 fps.
 * Receives { dims, trials, seed, budgetMs } and posts one message per attack, then { done: true }.
 */
import { sweepTrial } from "./scene4-sweep.ts";
import type { SweepRequest } from "./scene4-sweep.ts";

onmessage = (e: MessageEvent<SweepRequest>) => {
  const { dims, trials, seed, budgetMs } = e.data;
  for (const dim of dims) for (let t = 0; t < trials; t++) postMessage(sweepTrial(dim, t, seed, budgetMs));
  postMessage({ done: true });
};
