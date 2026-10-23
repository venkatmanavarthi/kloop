import { startBlanket } from "../shared/blanket";
import { mountIntro } from "../shared/intro";
import { drawWordmark } from "../shared/wordmark";

const skip = mountIntro();
// On the web, scrolling is the other obvious way to say "get on with it".
addEventListener("wheel", skip, { once: true, passive: true });

// Put the visitor's platform first as the primary download; everyone else sees macOS first.
const downloads = document.getElementById("downloads");
const windows = downloads?.querySelector<HTMLElement>('[data-os="windows"]');
const mac = downloads?.querySelector<HTMLElement>('[data-os="mac"]');
if (windows && mac && /Windows/.test(navigator.userAgent)) {
  downloads!.prepend(windows);
  windows.classList.replace("btn--ghost", "btn--primary");
  mac.classList.replace("btn--primary", "btn--ghost");
}

const wordmark = document.getElementById("wordmark") as HTMLCanvasElement | null;
if (wordmark) drawWordmark(wordmark);

// The blanket is fixed behind the whole page, so it is always on screen.
const blanket = document.getElementById("blanket") as HTMLCanvasElement | null;
if (blanket) startBlanket(blanket);
