// Renders the "Cracked Loop" app icon into assets/: icon.png, icon.icns and icon.ico.
// Run after changing the design: `bun scripts/icon.ts`. Needs rsvg-convert (brew install librsvg);
// the .icns step also needs macOS's iconutil. The outputs are committed, so builds don't need either.
import { $ } from "bun";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FG = "#f5f5f5";
const GREY = "#8a8a8a";
const BODY = "#141414";
const EDGE = "#262626";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Fewer, bigger dots as the icon shrinks so the ring still reads at 16 px.
function optical(size: number) {
  if (size <= 16) return { rings: 1, pitch: 0.14, small: true };
  if (size <= 32) return { rings: 1, pitch: 0.11, small: true };
  if (size <= 64) return { rings: 2, pitch: 0.075, small: false };
  if (size <= 128) return { rings: 2, pitch: 0.065, small: false };
  return { rings: 3, pitch: 0.05, small: false };
}

// `design` picks the optical size; `px` is the output resolution (they differ for @2x).
function svg(design: number, px: number) {
  const { rings, pitch: p, small } = optical(design);
  const S = px;
  const pad = S * 0.0977;
  const body = S * 0.8047;
  const cx = S / 2;
  const R = S * 0.25;
  const pitch = S * p;
  const d = pitch * 0.6;
  const gap = 38;
  const gapStart = 14;
  const gapEnd = gapStart + gap;

  const dots: string[] = [];
  const put = (r: number, deg: number, size: number, fill: string, opacity: number) => {
    const t = (deg * Math.PI) / 180;
    dots.push(
      `<circle cx="${r2(cx + r * Math.sin(t))}" cy="${r2(cx - r * Math.cos(t))}" r="${r2(size / 2)}" fill="${fill}" fill-opacity="${r2(opacity)}"/>`,
    );
  };

  // The loop: brightens clockwise from the crack back round to it.
  for (let i = 0; i < rings; i++) {
    const r = R + (i - (rings - 1) / 2) * pitch;
    const n = Math.max(8, Math.round((2 * Math.PI * r) / pitch));
    for (let j = 0; j < n; j++) {
      const deg = (j * 360) / n;
      if (deg > gapStart && deg < gapEnd) continue;
      const progress = ((deg - gapEnd + 360) % 360) / (360 - gap);
      put(r, deg, d, FG, 0.28 + 0.72 * progress);
    }
  }

  // Fragments knocked out of the ring at the crack.
  const mid = (gapStart + gapEnd) / 2;
  const outer = R + ((rings - 1) / 2) * pitch;
  const frags = small
    ? [[mid, 0.9, 0.9]]
    : [[mid - gap * 0.18, 0.9, 0.85], [mid + gap * 0.12, 1.7, 0.6], [mid + gap * 0.3, 0.35, 0.7]];
  for (const [deg, out, k] of frags) put(outer + out! * pitch, deg!, d * k!, GREY, 1);

  const edge = Math.max(1, S / 512);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<rect x="${r2(pad + edge / 2)}" y="${r2(pad + edge / 2)}" width="${r2(body - edge)}" height="${r2(body - edge)}" rx="${r2(body * 0.2237)}" fill="${BODY}" stroke="${EDGE}" stroke-width="${r2(edge)}"/>
${dots.join("\n")}
</svg>`;
}

async function png(design: number, px: number, out: string) {
  const src = `${out}.svg`;
  await Bun.write(src, svg(design, px));
  await $`rsvg-convert -w ${px} -h ${px} -o ${out} ${src}`.quiet();
  await rm(src);
}

// ICO allows PNG-compressed entries (Vista+), so it's a header, a directory, then the PNGs.
async function ico(files: { size: number; path: string }[], out: string) {
  const images = await Promise.all(files.map((f) => Bun.file(f.path).bytes()));
  const header = Buffer.alloc(6 + 16 * files.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(files.length, 4);
  let offset = header.length;
  files.forEach(({ size }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i]!.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i]!.length;
  });
  await Bun.write(out, Buffer.concat([header, ...images]));
}

const assets = "assets";
await mkdir(assets, { recursive: true });
const work = await mkdtemp(join(tmpdir(), "krackloop-icon-"));

try {
  // icon.png is what the dev build shows in the Dock and window chrome.
  await png(1024, 1024, join(assets, "icon.png"));

  if (process.platform === "darwin") {
    const set = join(work, "icon.iconset");
    await mkdir(set);
    for (const size of [16, 32, 128, 256, 512]) {
      await png(size, size, join(set, `icon_${size}x${size}.png`));
      await png(size, size * 2, join(set, `icon_${size}x${size}@2x.png`));
    }
    await $`iconutil -c icns ${set} -o ${join(assets, "icon.icns")}`.quiet();
  } else {
    console.warn("skipped icon.icns: iconutil is macOS-only");
  }

  const icoFiles = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    const path = join(work, `ico-${size}.png`);
    await png(size, size, path);
    icoFiles.push({ size, path });
  }
  await ico(icoFiles, join(assets, "icon.ico"));

  console.log(`wrote icons → ${assets}/`);
} finally {
  await rm(work, { recursive: true, force: true });
}
