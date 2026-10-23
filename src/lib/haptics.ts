/**
 * Haptic feedback for taps, in one place.
 *
 *  - Android Chrome: `navigator.vibrate(ms)`.
 *  - iOS Safari has no Vibration API. Since iOS 17.4 it plays a light haptic when an `<input type="checkbox" switch>`
 *    is toggled from a user gesture, so a hidden switch is created once and its label is clicked synchronously
 *    inside the person's own event.
 *  - Everywhere else (desktop, older iOS, server rendering): nothing happens.
 *
 * `haptic()` never throws and does nothing with `prefers-reduced-motion: reduce`. Call it from a user event; the
 * delegated listener in `components/haptics.tsx` already covers ordinary taps, so call it directly only for an
 * outcome (a send that worked, a destructive confirm).
 */
export type HapticKind = "tap" | "select" | "success" | "warning";

/** Vibration patterns in milliseconds (odd entries are pauses) for browsers that have `navigator.vibrate`. */
const VIBRATION: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [10, 40, 16],
  warning: [18, 50, 18],
};

/** Delays, in ms, of each tick for the iOS switch (one tick per entry; 0 is now, inside the gesture). */
const IOS_TICKS: Record<HapticKind, number[]> = {
  tap: [0],
  select: [0],
  success: [0, 90],
  warning: [0, 70, 140],
};

let iosLabel: HTMLLabelElement | null = null;

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One switch, created on first use, kept out of the way: not rendered, not announced, not focusable. */
function switchLabel(): HTMLLabelElement | null {
  if (iosLabel?.isConnected) return iosLabel;
  const parent = document.body ?? document.documentElement;
  if (!parent) return null;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.setAttribute("data-no-haptic", "");
  // iOS ignores `display:none` controls for switch haptics. Keep it rendered but fully clipped and unreachable.
  Object.assign(label.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    pointerEvents: "none",
  });
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  parent.appendChild(label);
  iosLabel = label;
  return label;
}

function iosTick() {
  switchLabel()?.click();
}

/** Plays a haptic. Call it inside a user event handler. */
export function haptic(kind: HapticKind = "tap"): void {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined" || reducedMotion()) return;
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATION[kind]);
      return;
    }
    // Only iOS needs the switch; Safari desktop ignores it, so it costs nothing there.
    for (const delay of IOS_TICKS[kind]) {
      if (delay === 0) iosTick();
      else window.setTimeout(iosTick, delay);
    }
  } catch {
    // Feedback is a nicety; a browser that refuses it must never break a tap.
  }
}
