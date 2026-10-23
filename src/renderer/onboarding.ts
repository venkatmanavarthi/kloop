import type { OnboardingState } from "../preload";

const api = window.krackloop;

type StepId = "screen" | "notifications";
type State = "off" | "wait" | "on";

// Each step wires up its own buttons on enter and tears down whatever it started on leave.
type Step = { enter(): void; leave(): void };

export function startOnboarding(state: OnboardingState, done: () => void) {
  const isMac = state.platform === "darwin";
  // Windows needs no permission to capture the screen, so it only gets the notifications step.
  const order: StepId[] = isMac ? ["screen", "notifications"] : ["notifications"];
  let index = Math.max(0, order.indexOf(state.step as StepId));

  const sections = new Map(
    order.map((id) => [id, document.querySelector<HTMLElement>(`.step[data-step="${id}"]`)!]),
  );
  if (!isMac) document.querySelector<HTMLElement>('.step[data-step="screen"]')!.hidden = true;
  const progress = document.getElementById("progress")!;
  progress.replaceChildren(...order.map(() => document.createElement("li")));
  if (order.length < 2) progress.hidden = true;

  const steps: Partial<Record<StepId, Step>> = {
    // A saved step means macOS just restarted us after the permission was granted ("Quit & Reopen").
    screen: isMac ? screenStep(sections.get("screen")!, state.step === "screen") : undefined,
    notifications: notificationsStep(sections.get("notifications")!, isMac),
  };

  let current: StepId | null = null;

  function show(next: number) {
    if (current) steps[current]!.leave();
    index = next;
    current = order[index]!;
    for (const [stepId, el] of sections) {
      const at = order.indexOf(stepId);
      el.classList.toggle("is-active", at === index);
      el.classList.toggle("is-past", at < index);
      el.inert = at !== index;
    }
    [...progress.children].forEach((dot, i) => dot.classList.toggle("is-done", i <= index));
    steps[current]!.enter();
    api.onboarding.save(current);
  }

  function advance() {
    if (index < order.length - 1) return show(index + 1);
    if (current) steps[current]!.leave();
    api.onboarding.save(null, true);
    done();
  }

  for (const [id, el] of sections) {
    el.addEventListener("click", (event) => {
      if (id !== current) return;
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "next" || action === "skip") advance();
    });
  }

  show(index);
}

function setStatus(section: HTMLElement, state: State, text: string) {
  const status = section.querySelector<HTMLElement>("[data-status]")!;
  status.dataset.state = state;
  status.textContent = text;
}

function button(section: HTMLElement, action: string) {
  return section.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
}

function screenStep(section: HTMLElement, resumed: boolean): Step {
  const open = button(section, "screen-open");
  const next = button(section, "next");
  const relaunch = button(section, "relaunch");
  const skip = button(section, "skip");
  const hint = section.querySelector<HTMLElement>("[data-hint]")!;
  const mock = section.querySelector<HTMLElement>(".mock")!;
  let timer = 0;
  let sentToSettings = false;

  function render(granted: boolean) {
    mock.classList.toggle("is-done", granted);
    open.hidden = granted;
    next.hidden = !granted;
    skip.hidden = granted;
    // For anyone who picked "Later" on macOS's prompt: the grant may need a restart to register.
    relaunch.hidden = granted || !sentToSettings;
    hint.hidden = granted;
    if (granted) setStatus(section, "on", resumed ? "You're all set: recording is on" : "Screen & system audio recording is on");
    else if (sentToSettings) setStatus(section, "wait", "Waiting for you to switch it on…");
    else setStatus(section, "off", "Not enabled yet");
  }

  async function check() {
    const granted = (await api.screen.status()) === "granted";
    render(granted);
    // The main process closes the drag panel and brings the window back on its own.
    if (granted) clearInterval(timer);
  }

  open.addEventListener("click", () => {
    sentToSettings = true;
    hint.textContent =
      "Drag the KrackLoop icon from the floating panel into the list and switch it on (if it's already listed, just flip the switch). When macOS asks, choose Quit & Reopen.";
    render(false);
    api.screen.openSettings();
  });
  relaunch.addEventListener("click", () => api.relaunch());

  return {
    enter() {
      check();
      timer = window.setInterval(check, 1000);
    },
    leave() {
      clearInterval(timer);
      api.screen.closeHelper();
    },
  };
}

function notificationsStep(section: HTMLElement, isMac: boolean): Step {
  const test = button(section, "notify-test");
  const next = button(section, "next");
  const settings = button(section, "notify-settings");
  const skip = button(section, "skip");
  const hint = section.querySelector<HTMLElement>("[data-hint]")!;
  const corner = isMac ? "top-right" : "bottom-right";
  hint.textContent = isMac
    ? "macOS will ask once whether KrackLoop can send notifications. Choose Allow."
    : "If nothing shows up, check that notifications and Focus assist allow KrackLoop.";

  function sent() {
    test.hidden = true;
    next.hidden = false;
    settings.hidden = false;
    skip.hidden = true;
  }

  test.addEventListener("click", async () => {
    if (!(await api.notifications.test())) {
      setStatus(section, "off", "Notifications aren't supported on this system");
      return sent();
    }
    setStatus(section, "wait", `Sent — look in the ${corner} corner of your screen`);
    hint.textContent = "Didn't see it? Turn on notifications for KrackLoop in settings, then try again.";
    sent();
  });

  settings.addEventListener("click", () => api.notifications.openSettings());

  api.notifications.onClick(() => {
    setStatus(section, "on", "Notifications are working");
    hint.hidden = true;
  });

  return { enter() {}, leave() {} };
}
