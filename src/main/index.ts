import { app, BrowserWindow, Menu, screen } from "electron";
import { closeHelper, registerOnboarding } from "./onboarding";
import { BACKGROUND, distFile, webPreferences } from "./shared";

// A second launch should focus the existing window, not boot another app.
if (!app.requestSingleInstanceLock()) app.exit(0);

// Skip building the default menu; it costs time on every launch.
Menu.setApplicationMenu(null);

// Windows only delivers toasts for apps with an AppUserModelID; in dev the exe path stands in.
if (process.platform === "win32") app.setAppUserModelId(app.isPackaged ? "com.krackloop.app" : process.execPath);

let win: BrowserWindow | null = null;

function createWindow() {
  // Fill the work area (screen minus dock and menu bar) of the display the user is on.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win = new BrowserWindow({
    ...workArea,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: BACKGROUND,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: webPreferences(),
  });

  // Reveal only once the first frame is painted, so the intro starts on a ready surface.
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => {
    win = null;
    closeHelper();
  });
  win.loadFile(distFile("renderer", "index.html"));
}

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

registerOnboarding(() => win);
app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
