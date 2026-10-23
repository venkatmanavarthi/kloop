import { startBlanket } from "../shared/blanket";
import { mountIntro } from "../shared/intro";
import { drawWordmark } from "../shared/wordmark";

const skip = mountIntro();
// On the web, scrolling is the other obvious way to say "get on with it".
addEventListener("wheel", skip, { once: true, passive: true });

const wordmark = document.getElementById("wordmark") as HTMLCanvasElement | null;
if (wordmark) drawWordmark(wordmark);

// Only swing the blanket while the hero is on screen.
const blanket = document.getElementById("blanket") as HTMLCanvasElement | null;
if (blanket) {
  let stop: (() => void) | null = null;
  new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) stop ??= startBlanket(blanket);
    else {
      stop?.();
      stop = null;
    }
  }).observe(blanket);
}
