import {
  KYBER_PRESETS, kyberKeygen, kyberEncaps, kyberDecaps, kyberDecryptBits, sealMessage, openMessage, toHex,
  encode2d, decode2d, halfStepOf, mulberry32, center,
} from "../core/index.ts";
import type { Poly, PolyVec, EncapsResult, Sent, Read, Vec } from "../core/index.ts";
import { el, fitCanvas, runWhileVisible, easeOut, reducedMotion, palette } from "../ui/dom.ts";
import { scene5 as copy } from "../ui/copy.ts";
import { makeViewport, visiblePoints, drawDots, drawArrow, drawBall, drawDashedLine, drawRing } from "./draw2d.ts";
import { GOOD, BAD } from "./scene3-noise.ts";

const P = KYBER_PRESETS.scene;
const H = halfStepOf(GOOD);
const WOBBLE = 0.2; // picture wobble for "show it on the lattice" (Scene 3's owner reads it perfectly)
type Mode = "keygen" | "encaps" | "decaps";

export function mountScene5(root: HTMLElement): () => void {
  // ---------- state ----------
  let keySeed = 1;
  let lockCount = 0;
  let keys = kyberKeygen(P, mulberry32(keySeed));
  let enc: EncapsResult | null = null;
  let dec: { sharedSecret: Uint8Array; ok: boolean; m: (0 | 1)[]; raw: number[] } | null = null;
  let mode: Mode = "keygen";
  let modeBorn = 0;
  let clockBorn = 0;
  let time = 0;
  let pictures: { sent: Sent; read: Read }[] = []; // one ball per bit of m, for the lattice picture

  // ---------- DOM ----------
  const canvas = el("canvas", { class: "scene-canvas", "aria-label": copy.lattice.canvas });
  const readout = el("div", { class: "readout", text: copy.lattice.keygen });
  const stage = el("div", { class: "stage short" }, canvas, readout);
  const input = el("input", { type: "text", class: "msg-input", maxlength: "40", value: "meet me at the lattice", placeholder: copy.labels.placeholder, "aria-label": copy.labels.message });
  const msgRow = el("label", { class: "msg-row" }, el("span", { text: copy.labels.message }), input);
  const body1 = el("div", { class: "kbody" });
  const body2 = el("div", { class: "kbody" });
  const body3 = el("div", { class: "kbody" });
  const lockBtn = el("button", { type: "button", class: "btn", text: copy.labels.encapsBtn, onClick: () => lock() });
  const unlockBtn = el("button", { type: "button", class: "btn", text: copy.labels.decapsBtn, onClick: () => unlock() });
  const panel = (title: string, btn: HTMLButtonElement, m: Mode, body: HTMLElement) =>
    el(
      "div",
      { class: "kpanel" },
      el("div", { class: "khead" },
        el("h3", { text: title }),
        btn,
        el("button", { type: "button", class: "linklike", text: copy.labels.show, onClick: () => show(m) }),
      ),
      body,
    );
  const clock = el("canvas", { class: "clock-canvas", "aria-label": copy.labels.diff });
  root.append(
    stage,
    msgRow,
    panel(copy.labels.keygen, el("button", { type: "button", class: "btn", text: copy.labels.keygenBtn, onClick: () => newKeys() }), "keygen", body1),
    panel(copy.labels.encaps, lockBtn, "encaps", body2),
    panel(copy.labels.decaps, unlockBtn, "decaps", body3),
  );
  const ctx = canvas.getContext("2d")!;
  const cctx = clock.getContext("2d")!;

  // ---------- actions (all math lives in core) ----------
  function newKeys() {
    keys = kyberKeygen(P, mulberry32(++keySeed));
    enc = null;
    dec = null;
    pictures = [];
    renderAll();
    show("keygen", false);
  }
  function lock() {
    enc = kyberEncaps(keys.pk, mulberry32(keySeed * 1000 + ++lockCount));
    dec = null;
    const rng = mulberry32(keySeed * 7 + lockCount);
    pictures = enc.m.map((bit) => {
      let sent: Sent;
      for (let tries = 0; ; tries++) {
        sent = encode2d(GOOD, bit, H, WOBBLE, rng, 3);
        if ((Math.abs(sent.ball[0]) < 4.6 && Math.abs(sent.ball[1]) < 2.6) || tries > 40) break;
      }
      return { sent, read: decode2d(GOOD, sent.ball) };
    });
    renderAll();
    show("encaps", false);
  }
  function unlock() {
    if (!enc) return;
    const d = kyberDecaps(keys.sk, keys.pk, enc.ciphertext);
    dec = { ...d, raw: kyberDecryptBits(keys.sk, enc.ciphertext).raw };
    clockBorn = time;
    renderAll();
    show("decaps", false);
  }
  function show(m: Mode, scroll = true) {
    mode = m;
    modeBorn = time;
    readout.textContent = copy.lattice[m];
    if (scroll) stage.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  }
  input.addEventListener("input", () => renderMessages());

  // ---------- panels ----------
  const centered = (p: Poly) => p.map((x) => center(x, P.q));
  function row(label: string, values: (number | string)[], cls: string, delay0 = 0): HTMLElement {
    return el(
      "div",
      { class: "krow" },
      el("span", { class: "klabel", text: label }),
      el("span", { class: "kcells " + cls }, ...values.map((v, i) => el("span", { class: "kc", style: `animation-delay:${(delay0 + i) * 18}ms`, text: String(v) }))),
    );
  }
  const sub = (i: number) => "₀₁₂₃₄₅₆₇₈₉"[i];
  /** "s (secret)" → "s₁ (secret)" on the first row, "s₂" after that. */
  const label = (full: string, index: string, first: boolean) => {
    const [name, ...rest] = full.split(" ");
    return name + index + (first && rest.length ? " " + rest.join(" ") : "");
  };
  const rows = (full: string, vec: PolyVec, cls: string, small = false) =>
    vec.map((p, i) => row(label(full, sub(i + 1), i === 0), small ? centered(p) : p, cls, i * 8));
  const text = (label: string, value: string, cls: string) =>
    el("div", { class: "krow" }, el("span", { class: "klabel", text: label }), el("span", { class: "ktext fadein " + cls, text: value }));
  const keyHex = (k: Uint8Array) => toHex(k).slice(0, 16) + "…";

  let sealedEl: HTMLElement | null = null;
  let openedEl: HTMLElement | null = null;
  function renderAll() {
    const { pk, sk, e } = keys;
    body1.replaceChildren(
      ...pk.A.flatMap((r, i) => r.map((p, j) => row(label(copy.labels.A, `${sub(i + 1)}${sub(j + 1)}`, i + j === 0), p, "muted", (i * 2 + j) * 8))),
      ...rows(copy.labels.s, sk.s, "secret", true),
      ...rows(copy.labels.e, e, "muted", true),
      ...rows(copy.labels.t, pk.t, "public"),
    );
    lockBtn.disabled = false;
    unlockBtn.disabled = !enc;
    if (!enc) {
      body2.replaceChildren(el("p", { class: "kwait", text: copy.labels.waitEncaps }));
      body3.replaceChildren(el("p", { class: "kwait", text: copy.labels.waitEncaps }));
      sealedEl = openedEl = null;
      return;
    }
    sealedEl = el("span", { class: "ktext fadein ball wrap" });
    body2.replaceChildren(
      row(copy.labels.m, enc.m, "ink"),
      text(copy.labels.key, keyHex(enc.sharedSecret), "secret"),
      ...rows(copy.labels.u, enc.ciphertext.u, "ball"),
      row(copy.labels.v, enc.ciphertext.v, "ball", 16),
      el("div", { class: "krow" }, el("span", { class: "klabel", text: copy.labels.sealed }), sealedEl),
    );
    if (!dec) {
      body3.replaceChildren(el("p", { class: "kwait", text: copy.labels.waitDecaps }));
      openedEl = null;
    } else {
      const same = toHex(dec.sharedSecret) === toHex(enc.sharedSecret);
      openedEl = el("span", { class: "ktext fadein " + (same ? "ink" : "public") });
      body3.replaceChildren(
        el("div", { class: "krow" }, el("span", { class: "klabel", text: copy.labels.diff }), clock),
        row(copy.labels.bits, dec.m.map((b, i) => (b === enc!.m[i] ? `${b}` : `${b}✗`)), "ink"),
        text(copy.labels.key, `${keyHex(dec.sharedSecret)}  ${same ? copy.labels.match : copy.labels.noMatch}`, same ? "secret" : "public"),
        el("div", { class: "krow" }, el("span", { class: "klabel", text: copy.labels.opened }), openedEl),
      );
    }
    renderMessages();
  }
  function renderMessages() {
    if (!enc || !sealedEl) return;
    const sealed = sealMessage(enc.sharedSecret, input.value);
    sealedEl.textContent = toHex(sealed) || "—";
    if (dec && openedEl) openedEl.textContent = openMessage(dec.sharedSecret, sealed) || "—";
  }
  renderAll();

  // ---------- the 97-hour clock: v slides to v − s·u ----------
  function drawClock() {
    if (!dec || !enc || !clock.isConnected) return;
    const { w, h, dpr } = fitCanvas(clock);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 24;
    const ang = (x: number) => (x / P.q) * Math.PI * 2 - Math.PI / 2; // 0 o'clock at the top
    // the two reading zones: near 0 → 0 (top), near the far side → 1 (bottom)
    const zone = (from: number, to: number, color: string) => {
      cctx.strokeStyle = color; cctx.lineWidth = 10; cctx.globalAlpha = 0.22;
      cctx.beginPath(); cctx.arc(cx, cy, R, ang(from), ang(to)); cctx.stroke(); cctx.globalAlpha = 1;
    };
    zone(-P.q / 4, P.q / 4, palette.secret);
    zone(P.q / 4, (3 * P.q) / 4, palette.ball);
    cctx.fillStyle = palette.muted; cctx.font = "12px system-ui, sans-serif"; cctx.textAlign = "center"; cctx.textBaseline = "middle";
    cctx.fillText(copy.labels.zero, cx, cy - R - 16);
    cctx.fillText(copy.labels.one, cx, cy + R + 16);
    const k = easeOut((time - clockBorn - 0.3) / 1.4);
    enc.ciphertext.v.forEach((v, i) => {
      // the dots cluster at 0 and at the far side — that clustering IS the decryption, so no labels
      const target = dec!.raw[i];
      let d = (((target - v) % P.q) + P.q) % P.q; // animate the short way round the clock
      if (d > P.q / 2) d -= P.q;
      const x = v + d * k;
      const a = ang(x);
      const px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
      cctx.fillStyle = k >= 1 ? (dec!.m[i] ? palette.ball : palette.secret) : palette.dotBright;
      cctx.beginPath(); cctx.arc(px, py, 5, 0, Math.PI * 2); cctx.fill();
    });
  }

  // ---------- "show it on the lattice": Scene 2–3 visuals ----------
  const keyDot: Vec = [GOOD[0][0] * 2 - GOOD[1][0], GOOD[0][1] * 2 - GOOD[1][1]];
  const keyBall: Vec = [keyDot[0] + 0.3, keyDot[1] - 0.24];
  function drawLattice() {
    const { w, h, dpr } = fitCanvas(canvas);
    const vp = makeViewport(w, h, 7);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const r = drawDots(ctx, vp, visiblePoints(GOOD, vp));
    const age = time - modeBorn;
    const grow = easeOut(age / 0.5);
    const redAlpha = mode === "keygen" ? 0.9 : 0.3;
    drawArrow(ctx, vp, [0, 0], [BAD[0][0] * grow, BAD[0][1] * grow], palette.attacker, { alpha: redAlpha, width: 1.8 });
    drawArrow(ctx, vp, [0, 0], [BAD[1][0] * grow, BAD[1][1] * grow], palette.attacker, { alpha: redAlpha, width: 1.8 });
    drawArrow(ctx, vp, [0, 0], GOOD[0], palette.secret, { alpha: 0.95, width: 2.2 });
    drawArrow(ctx, vp, [0, 0], GOOD[1], palette.secret, { alpha: 0.95, width: 2.2 });

    if (mode === "keygen") {
      // t = a dot of the grid plus a wobble
      drawRing(ctx, vp, keyDot, palette.attacker, { r, alpha: grow, label: copy.lattice.lockedDot, labelBelow: false });
      if (age > 0.5) drawDashedLine(ctx, vp, keyDot, keyBall, easeOut((age - 0.5) / 0.4), palette.attacker);
      if (age > 0.8) {
        drawBall(ctx, vp, keyBall, easeOut((age - 0.8) / 0.3), palette.attacker);
        const [bx, by] = vp.toScreen(keyBall);
        ctx.fillStyle = palette.attacker; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(copy.lattice.lockedBall, bx + 12, by + 4);
      }
      return;
    }
    pictures.forEach(({ sent, read }, i) => {
      const t = age - i * 0.12;
      if (t <= 0) return;
      const drop = easeOut(t / 0.35);
      if (sent.bit === 1) drawDashedLine(ctx, vp, sent.dot, sent.clean, drop, palette.ball);
      drawBall(ctx, vp, sent.ball, drop);
      const [bx, by] = vp.toScreen(sent.ball);
      ctx.fillStyle = palette.bg; ctx.font = "700 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (drop > 0.9) ctx.fillText(String(sent.bit), bx, by + 0.5);
      if (mode === "decaps") {
        const reach = easeOut((t - 0.4) / 0.4);
        if (reach > 0) drawDashedLine(ctx, vp, sent.ball, read.dot, reach, palette.secret);
        if (reach >= 1) drawRing(ctx, vp, read.dot, palette.secret, { r, filled: read.bit === sent.bit, label: `${read.bit} ${read.bit === sent.bit ? "✓" : "✗"}`, labelBelow: true, labelLeft: vp.toScreen(read.dot)[0] > vp.w * 0.7 });
      }
    });
  }

  // one loop for the whole column: the lattice picture and the clock share the clock `time`
  const stop = runWhileVisible(root, (dt) => { time += dt; drawLattice(); drawClock(); });
  return () => { stop(); root.innerHTML = ""; };
}
