import { WHITE } from "./theme";

// A sheet of dots hung from the top edge. It swings like a pendulum, with the swing
// lagging further down so it travels through the cloth, and soft folds catch the light.
// Returns a stop function.
export function startBlanket(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const GAP = 14;
  const SIZE = 2.4;
  const BUCKETS = 8; // alpha levels; dots are batched per level so each frame is a few fills
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0;
  let H = 0;
  let raf = 0;
  const start = performance.now();
  const paths: Path2D[] = [];

  function resize() {
    const dpr = devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(now: number) {
    const t = (now - start) / 1000;
    ctx!.clearRect(0, 0, W, H);
    for (let i = 0; i < BUCKETS; i++) paths[i] = new Path2D();

    // Overdraw the edges so the swinging sheet never shows a gap at the sides.
    for (let gy = 0; gy <= H + GAP; gy += GAP) {
      const s = gy / H; // 0 at the hem it hangs from, 1 at the bottom
      const phase = t * 0.7 - s * 1.8;
      const sway = Math.sin(phase) * 46 * s ** 1.4;
      // Swinging out lifts the lower part of the sheet a little, like a real pendulum.
      const lift = Math.abs(Math.sin(phase)) * 14 * s * s;

      for (let gx = -GAP * 4; gx <= W + GAP * 4; gx += GAP) {
        const f = gx * 0.011 + sway * 0.02 + t * 0.35;
        const g = gx * 0.024 - t * 0.5 + s * 2.2;
        const fold = Math.sin(f) + 0.45 * Math.sin(g);
        // Slope of the folds stands in for how much light each patch catches.
        const light = 0.5 + 0.5 * (Math.cos(f) + 0.45 * Math.cos(g)) / 1.45;

        const x = gx + sway + fold * 5 * s;
        const y = gy - lift + fold * 3 * s;
        if (x < -SIZE || x > W + SIZE || y < -SIZE || y > H + SIZE) continue;

        const level = Math.min(BUCKETS - 1, Math.floor(light * (0.6 + 0.4 * s) * BUCKETS));
        const r = (SIZE / 2) * (0.7 + 0.3 * light);
        paths[level]!.moveTo(x + r, y);
        paths[level]!.arc(x, y, r, 0, Math.PI * 2);
      }
    }

    ctx!.fillStyle = WHITE;
    for (let i = 0; i < BUCKETS; i++) {
      ctx!.globalAlpha = 0.12 + (i / (BUCKETS - 1)) * 0.43;
      ctx!.fill(paths[i]!);
    }
    ctx!.globalAlpha = 1;

    if (!still) raf = requestAnimationFrame(draw);
  }

  function redraw() {
    cancelAnimationFrame(raf);
    resize();
    raf = requestAnimationFrame(draw);
  }

  // Don't spend frames while the window is hidden or minimised.
  function onVisibility() {
    if (document.visibilityState === "visible") redraw();
    else cancelAnimationFrame(raf);
  }

  addEventListener("resize", redraw);
  document.addEventListener("visibilitychange", onVisibility);
  redraw();

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", redraw);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
