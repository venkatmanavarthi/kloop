import { rm } from "node:fs/promises";

const outdir = "dist";
const production = process.env.NODE_ENV !== "development";

await rm(outdir, { recursive: true, force: true });

const builds = await Promise.all([
  // Main process: one minified CommonJS file — the fastest thing for Electron to load.
  Bun.build({
    entrypoints: ["src/main/index.ts"],
    outdir,
    naming: "main.cjs",
    target: "node",
    format: "cjs",
    external: ["electron"],
    minify: production,
  }),
  // Preload: sandboxed, so it may only require "electron" — everything else is bundled in.
  Bun.build({
    entrypoints: ["src/preload/index.ts"],
    outdir,
    naming: "preload.cjs",
    target: "node",
    format: "cjs",
    external: ["electron"],
    minify: production,
  }),
  // Renderer: Bun bundles each HTML entry together with its CSS and TS.
  // drag.html is the floating panel used during the macOS Screen Recording step.
  Bun.build({
    entrypoints: ["src/renderer/index.html", "src/renderer/drag.html"],
    outdir: `${outdir}/renderer`,
    publicPath: "./",
    minify: production,
  }),
]);

for (const build of builds) {
  if (!build.success) {
    for (const log of build.logs) console.error(log);
    process.exit(1);
  }
}

console.log(`built ${builds.flatMap((b) => b.outputs).length} files → ${outdir}/`);
