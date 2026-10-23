import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeImage,
  Notification,
  screen,
  shell,
  systemPreferences,
  type NativeImage,
} from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { distFile, webPreferences } from "./shared";

const isMac = process.platform === "darwin";

const SETTINGS_URL = {
  // Opens "Screen & System Audio Recording" (just "Screen Recording" before macOS 15); one grant covers both.
  screen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
  notifications: isMac
    ? "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
    : "ms-settings:notifications",
};

type Saved = { completed: boolean; step: string | null };

const statePath = () => join(app.getPath("userData"), "onboarding.json");

async function load(): Promise<Saved> {
  try {
    const saved = JSON.parse(await readFile(statePath(), "utf8"));
    return { completed: saved.completed === true, step: typeof saved.step === "string" ? saved.step : null };
  } catch {
    return { completed: false, step: null };
  }
}

// System Settings accepts the .app bundle: …/KrackLoop.app/Contents/MacOS/KrackLoop → …/KrackLoop.app
const bundlePath = () => resolve(app.getPath("exe"), "../../..");

let helper: BrowserWindow | null = null;
let settingsOpened = false;
let probing: Promise<boolean> | null = null;
let icon: Promise<NativeImage> | null = null;
let dragIcon: NativeImage | null = null;
// Held so its click handler isn't garbage collected while the toast is on screen.
let notification: Notification | null = null;

// getFileIcon tops out at 32px on macOS, so prefer the Quick Look thumbnail for a crisp tile.
function bundleIcon() {
  icon ??= nativeImage
    .createThumbnailFromPath(bundlePath(), { width: 128, height: 128 })
    .then((img) => (img.isEmpty() ? Promise.reject() : img))
    .catch(() => app.getFileIcon(bundlePath(), { size: "normal" }))
    .then((img) => {
      dragIcon = img.resize({ width: 64, height: 64 });
      return img;
    });
  return icon;
}

// getMediaAccessStatus wraps CGPreflightScreenCaptureAccess, which keeps answering "denied" until
// the app restarts — that's why macOS offers "Quit & Reopen". Capture itself picks up the grant
// straight away, so once the user has been to System Settings, also check whether other apps'
// windows are visible to us. (Before that, listing windows would trigger macOS's own prompt.)
function screenGranted(): Promise<boolean> {
  if (!isMac || systemPreferences.getMediaAccessStatus("screen") === "granted") return Promise.resolve(true);
  if (!settingsOpened) return Promise.resolve(false);
  probing ??= desktopCapturer
    .getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false })
    .then((sources) => {
      const own = new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()));
      return sources.some((source) => !own.has(source.id));
    })
    .catch(() => false)
    .finally(() => (probing = null));
  return probing;
}

// While the user drags, KrackLoop's own window gets out of the way: only System Settings and
// this small floating panel (the app icon plus a looping demo) are left on screen.
function openHelper(parent: BrowserWindow) {
  if (helper) return helper.showInactive();
  bundleIcon();

  const width = 340;
  const height = 320;
  const margin = 24;
  // Bottom-right keeps clear of System Settings, which opens near the middle of the screen.
  const { workArea } = screen.getDisplayMatching(parent.getBounds());
  helper = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - margin,
    y: workArea.y + workArea.height - height - margin,
    // A non-activating panel: clicking it doesn't pull focus from System Settings.
    type: "panel",
    // Lets the very first mouse-down start the drag, instead of only focusing the panel.
    acceptFirstMouse: true,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: webPreferences(),
  });
  // "floating" keeps it above System Settings once that takes focus.
  helper.setAlwaysOnTop(true, "floating");
  helper.once("ready-to-show", () => {
    helper?.showInactive();
    parent.hide();
  });

  // The main window is hidden (and its timers throttled), so watch for the grant from here.
  const poll = setInterval(async () => {
    if (await screenGranted()) helper?.close();
  }, 1000);

  // However the panel goes away (granted, "Back", leaving the step), bring KrackLoop back.
  helper.on("closed", () => {
    clearInterval(poll);
    helper = null;
    if (parent.isDestroyed() || parent.isVisible()) return;
    parent.show();
    app.focus({ steal: true });
  });
  helper.loadFile(distFile("renderer", "drag.html"));
}

export const closeHelper = () => helper?.close();

export function registerOnboarding(getWin: () => BrowserWindow | null) {
  // `--onboarding` (see scripts/onboarding.ts) replays it from the start, ignoring saved progress.
  const replay = process.argv.includes("--onboarding");
  ipcMain.handle("onboarding:state", async () => ({
    platform: process.platform,
    ...(replay ? { completed: false, step: null } : await load()),
  }));

  ipcMain.handle("onboarding:save", (_e, saved: Saved) =>
    writeFile(
      statePath(),
      JSON.stringify({ completed: saved?.completed === true, step: typeof saved?.step === "string" ? saved.step : null }),
    ),
  );

  // Windows has no screen-capture permission, so it is always available there.
  ipcMain.handle("screen:status", async () => ((await screenGranted()) ? "granted" : "denied"));

  // Settings first, so the panel lands on top of it rather than the other way round.
  ipcMain.handle("screen:open-settings", async () => {
    if (!isMac) return;
    settingsOpened = true;
    await shell.openExternal(SETTINGS_URL.screen);
    const win = getWin();
    if (win) openHelper(win);
  });

  ipcMain.handle("screen:close-helper", () => closeHelper());

  ipcMain.handle("helper:info", async () => ({ name: app.getName(), icon: (await bundleIcon()).toDataURL() }));

  ipcMain.on("helper:start-drag", (event) => {
    if (dragIcon) event.sender.startDrag({ file: bundlePath(), icon: dragIcon });
  });

  ipcMain.handle("notifications:test", (event) => {
    if (!Notification.isSupported()) return false;
    notification = new Notification({
      title: "KrackLoop",
      body: "Notifications are on. We'll only nudge you when something needs you.",
    });
    notification.on("click", () => {
      getWin()?.show();
      getWin()?.focus();
      if (!event.sender.isDestroyed()) event.sender.send("notifications:clicked");
    });
    // On macOS the first notification is what triggers the system's permission prompt.
    notification.show();
    return true;
  });

  ipcMain.handle("notifications:open-settings", () => shell.openExternal(SETTINGS_URL.notifications));

  // macOS only applies a new Screen & System Audio Recording grant after the app restarts.
  ipcMain.handle("app:relaunch", () => {
    app.relaunch();
    app.exit(0);
  });
}
