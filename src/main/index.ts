import { app, BrowserWindow, Menu } from "electron";
import { join } from "node:path";

// Matches --bg in styles.css so the window never flashes white before the first paint.
const BACKGROUND = "#0a0a0a";

// A second launch should focus the existing window, not boot another app.
if (!app.requestSingleInstanceLock()) app.exit(0);

// Skip building the default menu; it costs time on every launch.
Menu.setApplicationMenu(null);

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: BACKGROUND,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // Reveal only once the first frame is painted, so the intro starts on a ready surface.
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => (win = null));
  // Bun inlines __dirname at build time, so resolve from the app root instead.
  win.loadFile(join(app.getAppPath(), "dist", "renderer", "index.html"));
}

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
