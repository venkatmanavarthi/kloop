import { FONT, GREY, WHITE } from "./theme";

// Draws "KrackLoop" as dots, sized to the canvas's CSS height. Static, so it costs one frame.
export function drawWordmark(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const size = canvas.clientHeight * 1.25;
  const gap = Math.max(1.6, size / 13);
  const radius = gap * 0.4;

  const ink = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const setFont = () => {
    ink.font = `800 ${size}px ${FONT}`;
    ink.letterSpacing = `${-size * 0.02}px`;
  };
  setFont();
  const metrics = ink.measureText("KrackLoop");
  const krackW = ink.measureText("Krack").width;
  const ascent = metrics.actualBoundingBoxAscent;
  const w = Math.ceil(metrics.width);
  const h = Math.ceil(ascent + metrics.actualBoundingBoxDescent);
  ink.canvas.width = w;
  ink.canvas.height = h;
  setFont(); // resizing a canvas resets its state
  ink.fillText("KrackLoop", 0, ascent);
  const pixels = ink.getImageData(0, 0, w, h).data;

  const dpr = devicePixelRatio || 1;
  canvas.style.width = `${w}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.scale(dpr, dpr);
  const top = (canvas.clientHeight - h) / 2;

  for (const [color, from, to] of [[WHITE, 0, krackW], [GREY, krackW, w]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < to; x += gap) {
        if (x < from || pixels[(Math.floor(y) * w + Math.floor(x)) * 4 + 3]! < 128) continue;
        ctx.moveTo(x + radius, top + y);
        ctx.arc(x, top + y, radius, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}
