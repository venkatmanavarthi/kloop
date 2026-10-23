// Replays onboarding from the start.
//
// On macOS the app is launched through `open` so that it asks for permissions as itself: started
// from a terminal, it would inherit the terminal's Screen Recording grant and the permission step
// would already show as done. And because macOS's "Quit & Reopen" relaunches the bundle without
// any arguments, the project is linked in as Electron's default app (Resources/app) so the
// relaunch comes back as KrackLoop rather than Electron's placeholder window.
import { lstat, symlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
// The electron package's main export is the path to its binary.
const electron = require("electron") as unknown as string;

let cmd: string[];
if (process.platform === "darwin") {
  const bundle = resolve(electron, "../../..");
  const link = resolve(bundle, "Contents/Resources/app");
  if (!(await lstat(link).catch(() => null))) await symlink(root, link);
  cmd = ["open", "-n", "-W", bundle, "--args", "--onboarding"];
} else {
  cmd = [electron, root, "--onboarding"];
}

const proc = Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"] });
process.exit(await proc.exited);
