import type { Api } from "../preload";

declare global {
  interface Window {
    krackloop: Api;
  }
}
