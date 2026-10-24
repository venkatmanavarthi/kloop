// The dotted "KrackLoop" intro: dots fly in, "Krack" cracks, a shimmer sweeps across.
// Shared by the Electron app and the website.
import { FONT, GREY, WHITE } from "./theme";

// Timeline in seconds; the CSS delays in shared/intro.css are tuned to these.
const FLY = 1.0; // how long one dot takes to reach its place
const SWEEP = 0.45; // extra delay across the word, left to right
const CRACK_AT = 1.6;
const CRACK_FOR = 0.65;
const SHIMMER_AT = 2.05;
const END = 3.6;

// Jagged crack across "Krack", as [x%, y%] of its bounding box.
const CRACK: [number, number][] = [
  [-2, 55], [14, 63], [30, 47], [47, 60], [64, 41], [82, 52], [102, 38],
];

type Dot = {
  tx: number; // resting position
  ty: number;
  sx: number; // scattered start position
  sy: number;
  delay: number;
  u: number; // 0..1 across the word, drives the shimmer
  side: -1 | 0 | 1; // which half of the crack ("Loop" dots don't crack)
  color: string;
};

type Layout = {
  W: number;
  H: number;
  dpr: number;
  radius: number;
  left: number;
  capTop: number;
  capH: number;
  krackW: number;
  dots: Dot[];
};

const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function crackY(x: number, left: number, top: number, w: number, h: number) {
  const px = ((x - left) / w) * 100;
  for (let i = 1; i < CRACK.length; i++) {
    const [x0, y0] = CRACK[i - 1]!;
    const [x1, y1] = CRACK[i]!;
    if (px <= x1) return top + ((y0 + ((px - x0) / (x1 - x0)) * (y1 - y0)) / 100) * h;
  }
  return top + h / 2;
}

// Same shape as a quick jolt-and-settle: out fast, ease back to rest.
function crackAmount(t: number) {
  if (t < 0 || t > CRACK_FOR) return 0;
  const p = t / CRACK_FOR;
  return p < 0.18 ? easeOutCubic(p / 0.18) : 1 - easeOutCubic((p - 0.18) / 0.82);
}

// Sizes the canvas to the window and samples the word into dots.
function layout(canvas: HTMLCanvasElement): Layout {
  const W = innerWidth;
  const H = innerHeight;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  // Rasterise the word once off screen, then sample it on a grid to get the dots.
  // 0.13 of the width keeps the word inside narrow (phone) windows too.
  const size = Math.min(W * 0.13, 150);
  const gap = Math.max(4, Math.round(size / 26));
  const radius = gap * 0.42;
  const font = `800 ${size}px ${FONT}`;

  const ink = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const setFont = () => {
    ink.font = font;
    ink.letterSpacing = `${-size * 0.02}px`;
  };
  setFont();

  const krackW = ink.measureText("Krack").width;
  const metrics = ink.measureText("KrackLoop");
  const left = (W - metrics.width) / 2;
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const baseline = H / 2 + (ascent - descent) / 2 - size * 0.08;
  const capTop = baseline - ascent;
  const capH = ascent;

  // Only rasterise the word's box (plus padding), not the whole window: far less to read back.
  const pad = Math.ceil(size * 0.1);
  const boxW = Math.ceil(metrics.width) + pad * 2;
  const boxH = Math.ceil(ascent + descent) + pad * 2;
  ink.canvas.width = boxW;
  ink.canvas.height = boxH;
  setFont(); // resizing a canvas resets its state
  ink.fillText("KrackLoop", pad, pad + ascent);

  const pixels = ink.getImageData(0, 0, boxW, boxH).data;
  const dots: Dot[] = [];
  // Keep the sampling grid aligned to the window so dot spacing matches everywhere.
  const originX = left - pad;
  const originY = capTop - pad;
  const firstX = Math.ceil((originX - gap / 2) / gap) * gap + gap / 2;
  const firstY = Math.ceil((originY - gap / 2) / gap) * gap + gap / 2;

  for (let y = firstY; y < originY + boxH; y += gap) {
    for (let x = firstX; x < originX + boxW; x += gap) {
      const bx = Math.floor(x - originX);
      const by = Math.floor(y - originY);
      if (bx < 0 || by < 0 || pixels[(by * boxW + bx) * 4 + 3]! < 128) continue;
      const u = (x - left) / metrics.width;
      const inKrack = x < left + krackW;
      const angle = Math.random() * Math.PI * 2;
      const dist = 250 + Math.random() * 650;
      dots.push({
        tx: x,
        ty: y,
        sx: x + Math.cos(angle) * dist,
        sy: y + Math.sin(angle) * dist,
        delay: 0.1 + u * SWEEP + Math.random() * 0.12,
        u,
        side: inKrack ? (y < crackY(x, left, capTop, krackW, capH) ? -1 : 1) : 0,
        color: inKrack ? WHITE : GREY,
      });
    }
  }

  return { W, H, dpr, radius, left, capTop, capH, krackW, dots };
}

// Plays the intro once on the canvas. A resize mid-intro re-lays out the word
// without restarting the timeline. Pass `finished` to draw only the final frame.
export function startIntro(canvas: HTMLCanvasElement, finished = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let L = layout(canvas);
  let done = false;
  // Once finished, a resize redraws the final frame so a word left on screen stays sharp.
  const onResize = () => {
    if (!canvas.isConnected) return removeEventListener("resize", onResize);
    L = layout(canvas);
    if (done) requestAnimationFrame(frame);
  };
  addEventListener("resize", onResize);

  const start = performance.now() - (finished ? END * 1000 : 0);

  function frame(now: number) {
    if (!canvas.isConnected) return removeEventListener("resize", onResize);
    const { W, H, dpr, radius, left, capTop, capH, krackW, dots } = L;
    const t = (now - start) / 1000;
    const ct = t - CRACK_AT;
    const crack = crackAmount(ct);

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);

    // A short decaying shake when the word cracks.
    if (ct > 0 && ct < 0.32) {
      const k = 1 - ct / 0.32;
      ctx!.translate(Math.sin(ct * 90) * 3 * k, Math.cos(ct * 70) * 1.5 * k);
    }

    const shimmer = (t - SHIMMER_AT) / 0.6;
    let fill = "";

    for (const d of dots) {
      const p = clamp01((t - d.delay) / FLY);
      if (p === 0) continue;
      const e = easeOutExpo(p);

      let x = d.sx + (d.tx - d.sx) * e;
      let y = d.sy + (d.ty - d.sy) * e;
      if (d.side && crack) {
        x += d.side * 4 * crack;
        y += d.side * (d.side < 0 ? 7 : 6) * crack;
      }

      let r = radius * (0.35 + 0.65 * e);
      if (shimmer > 0 && shimmer < 1.4) {
        const g = Math.exp(-((d.u - (shimmer * 1.2 - 0.1)) ** 2) / 0.004);
        r *= 1 + 0.25 * g;
      }

      if (fill !== d.color) ctx!.fillStyle = fill = d.color;
      ctx!.globalAlpha = Math.min(1, p * 3);
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    // The crack itself: a white jagged line that streaks across "Krack" and fades.
    if (ct > 0 && ct < 0.55) {
      const [firstX] = CRACK[0]!;
      const [lastX] = CRACK[CRACK.length - 1]!;
      const head = firstX + (lastX - firstX) * clamp01(ct / 0.14);
      const at = (px: number, py: number) =>
        [left + (px / 100) * krackW, capTop + (py / 100) * capH] as const;

      ctx!.globalAlpha = ct < 0.14 ? 1 : 1 - (ct - 0.14) / 0.41;
      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 2;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      ctx!.moveTo(...at(...CRACK[0]!));
      for (let i = 1; i < CRACK.length; i++) {
        const [x0, y0] = CRACK[i - 1]!;
        const [x1, y1] = CRACK[i]!;
        if (head <= x0) break;
        const f = Math.min(1, (head - x0) / (x1 - x0));
        ctx!.lineTo(...at(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f));
      }
      ctx!.stroke();
    }

    ctx!.globalAlpha = 1;
    if (t < END) requestAnimationFrame(frame);
    else done = true;
  }

  requestAnimationFrame(frame);
}

// Wires up the #intro overlay (see intro.css): plays once the page is visible, removes
// itself when done, and any click or key skips it unless `skippable` is false. Returns
// skip() for pages that need to jump past it themselves.
export function mountIntro(skippable = true) {
  const root = document.documentElement;
  const intro = document.getElementById("intro");
  const canvas = document.getElementById("dots") as HTMLCanvasElement | null;

  // A window or tab can open hidden, so start only once it is actually visible —
  // otherwise the first frames play off screen.
  function play() {
    if (root.classList.contains("play")) return;
    root.classList.add("play");
    if (canvas) startIntro(canvas);
  }

  function skip() {
    play();
    root.classList.add("skip");
  }

  if (intro && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (document.visibilityState === "visible") play();
    else document.addEventListener("visibilitychange", play, { once: true });

    intro.addEventListener("animationend", (event) => {
      if (event.target === intro && event.animationName === "intro-out") intro.remove();
    });

    if (skippable) {
      window.addEventListener("pointerdown", skip, { once: true });
      window.addEventListener("keydown", skip, { once: true });
    }
  }

  return skip;
}
