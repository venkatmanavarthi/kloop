import { startBlanket } from "../../shared/blanket";
import { mountIntro } from "../../shared/intro";
import { drawWordmark } from "../../shared/wordmark";
import { startOnboarding } from "./onboarding";

const root = document.documentElement;

// The Electron window is created hidden and shown on first paint; mountIntro waits for that.
// It starts unskippable: on first launch the intro always plays through.
const skip = mountIntro(false);

// Once the intro has been seen, a click or key cuts it short.
function allowSkip() {
  addEventListener("pointerdown", skip, { once: true });
  addEventListener("keydown", skip, { once: true });
}

// First run shows onboarding in place of the app; the intro plays over whichever view is chosen.
window.krackloop.onboarding.state().then((state) => {
  if (state.completed) {
    root.dataset.view = "app";
    allowSkip();
    return;
  }
  root.dataset.view = "onboarding";
  // Coming back mid-onboarding (e.g. macOS's "Quit & Reopen") shouldn't replay the intro.
  if (state.step) skip();
  const wordmark = document.getElementById("wordmark") as HTMLCanvasElement | null;
  const blanket = document.getElementById("blanket") as HTMLCanvasElement | null;
  if (wordmark) drawWordmark(wordmark);
  const stopBlanket = blanket ? startBlanket(blanket) : () => {};
  startOnboarding(state, () => {
    stopBlanket();
    root.classList.add("handoff");
    root.dataset.view = "app";
  });
}).catch(() => {
  root.dataset.view = "app";
  allowSkip();
});
