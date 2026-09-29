import { plantedInstance, runAttack, mulberry32 } from "../core/index.ts";
import type { AttackResult } from "../core/index.ts";

/** Shared by the worker and the main-thread fallback: one attack on one random grid, with a time cap. */
export interface SweepRequest {
  dims: number[];
  trials: number;
  seed: number;
  budgetMs: number;
}

export interface TrialMessage {
  result: AttackResult;
  ms: number;
}

export function sweepTrial(dim: number, trial: number, seed: number, budgetMs: number): TrialMessage {
  const inst = plantedInstance(dim, mulberry32(seed * 7919 + dim * 101 + trial));
  const start = performance.now();
  const result = runAttack(inst, () => performance.now() - start > budgetMs);
  return { result, ms: performance.now() - start };
}

/**
 * Run the sweep in a module worker, or in small main-thread slices if workers are unavailable.
 * Returns a cancel function.
 */
export function startSweep(
  req: SweepRequest,
  onTrial: (m: TrialMessage) => void,
  onDone: () => void,
  onFallback: () => void,
): () => void {
  try {
    const worker = new Worker(new URL("./scene4-worker.js", import.meta.url), { type: "module" });
    let cancel = () => worker.terminate();
    worker.onmessage = (e: MessageEvent<TrialMessage | { done: true }>) => {
      if ("done" in e.data) { onDone(); worker.terminate(); } else onTrial(e.data);
    };
    worker.onerror = () => { worker.terminate(); cancel = mainThread(); };
    worker.postMessage(req);
    return () => cancel();
  } catch {
    return mainThread();
  }

  function mainThread(): () => void {
    onFallback();
    const jobs: [number, number][] = [];
    for (const d of req.dims) for (let t = 0; t < req.trials; t++) jobs.push([d, t]);
    let timer = 0;
    const tick = () => {
      const job = jobs.shift();
      if (!job) { onDone(); return; }
      onTrial(sweepTrial(job[0], job[1], req.seed, req.budgetMs));
      timer = window.setTimeout(tick, 0);
    };
    timer = window.setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }
}
