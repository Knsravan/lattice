import { encode2d, decode2d, halfStepOf, safeWobble, mulberry32 } from "../core/index.ts";
import type { Basis, Vec, Sent, Read } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, easeOut, palette } from "../ui/dom.ts";
import { scene3 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing } from "./draw2d.ts";

/** Same private key as Scene 2; a slightly uglier public key so a small wobble is enough to blind it. */
const GOOD: Basis = [
  [1.2, 0.32],
  [-0.32, 1.2],
];
const g = (a: number, b: number): Vec => [a * GOOD[0][0] + b * GOOD[1][0], a * GOOD[0][1] + b * GOOD[1][1]];
const BAD: Basis = [g(4, 1), g(3, 1)]; // determinant 1 → the same lattice
const H = halfStepOf(GOOD);
const SAFE = safeWobble(H);
const MAX_WOBBLE = 0.6;
const DEFAULT_WOBBLE = 0.25;
const KEEP = 10;

interface Throw {
  sent: Sent;
  owner: Read;
  eaves: Read;
  born: number;
  mag: number; // the wobble setting when it was sent
}

export function mountScene3(root: HTMLElement): () => void {
  // ---------- DOM ----------
  const canvas = el("canvas", { class: "scene-canvas", "aria-label": "Sending a secret bit through the lattice with a wobble" });
  const readout = el("div", { class: "readout", text: copy.hint });
  const slider = el("input", { type: "range", min: "0", max: String(MAX_WOBBLE), step: "0.01", value: String(DEFAULT_WOBBLE), id: "s3-wobble", "aria-label": copy.labels.wobble });
  const sliderVal = el("span", { class: "mono", text: DEFAULT_WOBBLE.toFixed(2) });
  const tally = el("div", { class: "tally" });
  const controls = el(
    "div",
    { class: "controls" },
    el("button", { type: "button", class: "btn", text: copy.labels.send0, onClick: () => send(0) }),
    el("button", { type: "button", class: "btn", text: copy.labels.send1, onClick: () => send(1) }),
    el("button", { type: "button", class: "btn", text: copy.labels.sendMany, onClick: () => sendMany(20) }),
    el("label", { for: "s3-wobble", class: "sliderlabel" }, copy.labels.wobble + " ", slider, sliderVal),
    el("button", { type: "button", class: "btn", text: copy.labels.clear, onClick: () => { throws = []; queue = []; stats = { owner: [0, 0], eaves: [0, 0] }; } }),
  );
  const stage = el("div", { class: "stage" }, canvas, readout);
  root.append(stage, controls, tally);
  const ctx = canvas.getContext("2d")!;

  // ---------- state ----------
  let throws: Throw[] = [];
  let queue: { bit: 0 | 1; at: number }[] = [];
  let stats: { owner: [number, number]; eaves: [number, number] } = { owner: [0, 0], eaves: [0, 0] }; // [right, total]
  let time = 0;
  const rng = mulberry32(11);
  const wobble = () => parseFloat(slider.value);
  slider.addEventListener("input", () => { sliderVal.textContent = wobble().toFixed(2); });

  function send(bit: 0 | 1) {
    // Any basis of the lattice picks the same dots; we pick with the short one so the dots
    // spread evenly over the window instead of clustering along the long red arrows.
    let sent: Sent;
    for (let tries = 0; ; tries++) {
      sent = encode2d(GOOD, bit, H, wobble(), rng, 3);
      if ((Math.abs(sent.ball[0]) < 4.4 && Math.abs(sent.ball[1]) < 3.0) || tries > 40) break;
    }
    const owner = decode2d(GOOD, sent.ball);
    const eaves = decode2d(BAD, sent.ball);
    throws.push({ sent, owner, eaves, born: time, mag: wobble() });
    if (throws.length > KEEP) throws.shift();
    stats.owner[1]++; if (owner.bit === bit) stats.owner[0]++;
    stats.eaves[1]++; if (eaves.bit === bit) stats.eaves[0]++;
  }
  function sendMany(n: number) {
    for (let i = 0; i < n; i++) queue.push({ bit: rng() < 0.5 ? 0 : 1, at: time + i * 0.15 });
  }

  // ---------- drawing ----------
  function draw(dt: number) {
    time += dt;
    const { w, h, dpr } = fitCanvas(canvas);
    const vp = makeViewport(w, h, 11);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    while (queue.length && queue[0].at <= time) send(queue.shift()!.bit);

    const pts = visiblePoints(GOOD, vp);
    const r = drawDots(ctx, vp, pts);

    // the two keys, as a reminder: green short pair, red long pair (faint)
    drawArrow(ctx, vp, [0, 0], BAD[0], palette.attacker, { alpha: 0.35, width: 1.5 });
    drawArrow(ctx, vp, [0, 0], BAD[1], palette.attacker, { alpha: 0.35, width: 1.5 });
    drawArrow(ctx, vp, [0, 0], GOOD[0], palette.secret, { alpha: 0.9, width: 2 });
    drawArrow(ctx, vp, [0, 0], GOOD[1], palette.secret, { alpha: 0.9, width: 2 });

    const last = throws[throws.length - 1];
    for (const t of throws) {
      const age = time - t.born;
      const isLast = t === last;
      const fade = isLast ? 1 : 0.45;
      const drop = easeOut(age / 0.35);
      const reach = easeOut((age - 0.3) / 0.4);

      // where the ball started (dot, or dot + half step) and how far it wobbled
      const [cx, cy] = vp.toScreen(t.sent.clean);
      ctx.save();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = palette.ball; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, t.mag * vp.unit), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (isLast) {
        // the safe circle: as long as the ball stays inside, the owner can read it
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.strokeStyle = palette.secret; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, SAFE * vp.unit, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // half step marker from the sender's dot
        if (t.sent.bit === 1) drawDashedLine(ctx, vp, t.sent.dot, t.sent.clean, 1, palette.ball);
      }

      // readers
      if (reach > 0) {
        const oOK = t.owner.bit === t.sent.bit;
        const eOK = t.eaves.bit === t.sent.bit;
        drawDashedLine(ctx, vp, t.sent.ball, t.owner.dot, reach, palette.secret);
        drawDashedLine(ctx, vp, t.sent.ball, t.eaves.dot, reach, palette.attacker);
        if (reach >= 1) {
          // keep labels inside the canvas: flip to the left side when the dot is near the right edge
          const oLeft = vp.toScreen(t.owner.dot)[0] > vp.w * 0.62;
          const eLeft = vp.toScreen(t.eaves.dot)[0] > vp.w * 0.62;
          drawRing(ctx, vp, t.owner.dot, palette.secret, { r, alpha: fade, filled: oOK, label: isLast ? `${copy.labels.owner} ${copy.labels.reads} ${t.owner.bit} ${oOK ? "✓" : "✗"}` : undefined, labelBelow: false, labelLeft: oLeft });
          drawRing(ctx, vp, t.eaves.dot, palette.attacker, { r, alpha: fade, filled: eOK, label: isLast ? `${copy.labels.eaves} ${copy.labels.reads} ${t.eaves.bit} ${eOK ? "✓" : "✗"}` : undefined, labelBelow: true, labelLeft: eLeft });
        }
      }
      // the ball, tagged with the bit that was sent
      ctx.save(); ctx.globalAlpha = fade;
      drawBall(ctx, vp, t.sent.ball, drop);
      const [bx, by] = vp.toScreen(t.sent.ball);
      ctx.fillStyle = "#0b0d12"; ctx.font = "700 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (drop > 0.9) ctx.fillText(String(t.sent.bit), bx, by + 0.5);
      ctx.restore();
    }

    // readout + tally
    if (queue.length > 0) {
      readout.textContent = copy.readout.sending.replace("{o}", `${stats.owner[0]}/${stats.owner[1]}`).replace("{e}", `${stats.eaves[0]}/${stats.eaves[1]}`);
      readout.classList.remove("warn");
    } else if (last && time - last.born > 0.7) {
      const oOK = last.owner.bit === last.sent.bit, eOK = last.eaves.bit === last.sent.bit;
      readout.textContent = copy.readout.result
        .replace("{bit}", String(last.sent.bit))
        .replace("{o}", `${last.owner.bit} ${oOK ? "✓" : "✗"}`)
        .replace("{e}", `${last.eaves.bit} ${eOK ? "✓" : "✗"}`);
      readout.classList.toggle("warn", !oOK);
    } else {
      readout.textContent = wobble() === 0 ? copy.readout.zero : wobble() > SAFE ? copy.readout.tooMuch : copy.hint;
      readout.classList.toggle("warn", wobble() > SAFE);
    }
    tally.innerHTML = "";
    tally.append(
      el("span", { class: "pill good", text: `${copy.labels.owner}: ${stats.owner[0]} / ${stats.owner[1]} ${copy.labels.right}` }),
      el("span", { class: "pill bad", text: `${copy.labels.eaves}: ${stats.eaves[0]} / ${stats.eaves[1]} ${copy.labels.right}` }),
    );
  }

  const stop = runWhileVisible(stage, draw);
  return () => { stop(); root.innerHTML = ""; };
}
