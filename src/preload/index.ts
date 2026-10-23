import { contextBridge, ipcRenderer } from "electron";

export type ScreenStatus = "not-determined" | "granted" | "denied" | "restricted" | "unknown";
export type OnboardingState = { platform: string; completed: boolean; step: string | null };

const api = {
  onboarding: {
    state: (): Promise<OnboardingState> => ipcRenderer.invoke("onboarding:state"),
    save: (step: string | null, completed = false): Promise<void> =>
      ipcRenderer.invoke("onboarding:save", { step, completed }),
  },
  screen: {
    status: (): Promise<ScreenStatus> => ipcRenderer.invoke("screen:status"),
    openSettings: (): Promise<void> => ipcRenderer.invoke("screen:open-settings"),
    closeHelper: (): Promise<void> => ipcRenderer.invoke("screen:close-helper"),
  },
  notifications: {
    test: (): Promise<boolean> => ipcRenderer.invoke("notifications:test"),
    openSettings: (): Promise<void> => ipcRenderer.invoke("notifications:open-settings"),
    onClick: (callback: () => void) => ipcRenderer.on("notifications:clicked", () => callback()),
  },
  // Used by the floating drag panel (drag.html).
  helper: {
    info: (): Promise<{ name: string; icon: string }> => ipcRenderer.invoke("helper:info"),
    startDrag: () => ipcRenderer.send("helper:start-drag"),
    close: (): Promise<void> => ipcRenderer.invoke("screen:close-helper"),
  },
  relaunch: (): Promise<void> => ipcRenderer.invoke("app:relaunch"),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("krackloop", api);
