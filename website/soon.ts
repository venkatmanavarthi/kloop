import { mountIntro, startIntro } from "../shared/intro";

// The intro plays as usual; soon.css keeps it on screen instead of fading out.
mountIntro();

// Reduced motion skips the intro, so draw the finished word still instead.
const dots = document.getElementById("dots") as HTMLCanvasElement | null;
if (dots && matchMedia("(prefers-reduced-motion: reduce)").matches) startIntro(dots, true);
