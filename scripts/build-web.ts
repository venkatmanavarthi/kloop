import { rm } from "node:fs/promises";

// The marketing website: plain static files, deployable to any static host.
const outdir = "dist-web";

await rm(outdir, { recursive: true, force: true });

const build = await Bun.build({
  entrypoints: ["website/index.html"],
  outdir,
  minify: true,
});

if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

console.log(`built ${build.outputs.length} files → ${outdir}/`);
