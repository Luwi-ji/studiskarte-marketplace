"use client";

import { useEffect } from "react";
import { haptic, type HapticKind } from "@/lib/haptics";

/**
 * One delegated listener gives every tap in the app the same haptic, so no button needs its own call.
 *
 *  - Which elements: button, a[href], [role=button|tab|switch|menuitem...], summary, label, and checkbox / radio / range
 *    inputs, unless disabled, `aria-disabled="true"`, or inside an element with `data-no-haptic`.
 *  - Which haptic: tabs, checkboxes, radios, switches and `aria-pressed` / `aria-checked` toggles play 'select'; all
 *    else plays 'tap'. `data-haptic="success|warning|select|tap|none"` on the element (or an ancestor) overrides.
 *  - Sheets and drawers open from a click, so the same listener covers them: do not call `haptic` for that as well.
 *  - Scrolling is silent except in a scroll-snap row marked `data-haptic-scroll`, which plays 'select' once when the
 *    row settles on a new position after a finger moved it (not when code scrolls it).
 *  - At most one haptic per 60 ms, so a label and the input it forwards to count once.
 */

const INTERACTIVE =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="menuitemradio"], [role="option"], summary, label, input[type="checkbox"], input[type="radio"], input[type="range"]';
const SELECT_ROLES: Record<string, true> = { tab: true, switch: true, checkbox: true, radio: true, menuitemradio: true, option: true };
const OVERRIDES: Record<string, HapticKind | "none"> = { tap: "tap", select: "select", success: "success", warning: "warning", none: "none" };
const SELECT_INPUTS: Record<string, true> = { checkbox: true, radio: true, range: true };
const MIN_GAP_MS = 60;
/** How long a snap row must be still before it counts as settled, in browsers without `scrollend`. */
const SETTLE_MS = 120;
/** Less than this many pixels from where the finger landed is not a new position. */
const MOVED_PX = 2;

function isDisabled(el: Element): boolean {
  return el.matches(':disabled, [aria-disabled="true"]') || el.closest("fieldset:disabled") !== null;
}

/** The haptic for a tap on this element, or null for none. */
function kindFor(target: EventTarget | null): HapticKind | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(INTERACTIVE);
  if (!el || el.closest("[data-no-haptic]") || isDisabled(el)) return null;

  const override = OVERRIDES[el.closest("[data-haptic]")?.getAttribute("data-haptic") ?? ""];
  if (override) return override === "none" ? null : override;

  // A label stands for the control it forwards to; a label with none is plain text and stays silent.
  let subject: Element = el;
  if (el instanceof HTMLLabelElement) {
    if (!el.control || isDisabled(el.control)) return null;
    // Tapping a text field must only focus it: a haptic here would take the focus (and the keyboard) away.
    if (el.control instanceof HTMLTextAreaElement || el.control instanceof HTMLSelectElement) return null;
    if (el.control instanceof HTMLInputElement && !SELECT_INPUTS[el.control.type] && el.control.type !== "file") return null;
    subject = el.control;
  }
  if (subject instanceof HTMLInputElement && SELECT_INPUTS[subject.type]) return "select";
  const role = subject.getAttribute("role");
  if ((role && SELECT_ROLES[role]) || subject.hasAttribute("aria-pressed") || subject.hasAttribute("aria-checked")) return "select";
  return "tap";
}

export function HapticsProvider() {
  useEffect(() => {
    let last = 0;
    function play(kind: HapticKind) {
      const now = performance.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      haptic(kind);
    }

    // Trusted clicks only: the hidden switch's own click and scripted `.click()` calls must not count.
    function onClick(event: MouseEvent) {
      if (!event.isTrusted) return;
      const kind = kindFor(event.target);
      if (kind) play(kind);
    }

    // Snap rows marked `data-haptic-scroll`: where the finger landed, and who is waiting for a settle.
    const touchStart = new WeakMap<Element, number>();
    const timers = new WeakMap<Element, number>();
    let touching = false;
    const position = (el: Element) => el.scrollLeft + el.scrollTop;

    function onTouchStart(event: TouchEvent) {
      touching = true;
      const row = event.target instanceof Element ? event.target.closest("[data-haptic-scroll]") : null;
      if (row) touchStart.set(row, position(row));
    }
    function onTouchEnd() {
      touching = false;
    }
    function settled(row: Element) {
      const from = touchStart.get(row);
      if (from === undefined) return;
      touchStart.delete(row);
      if (Math.abs(position(row) - from) > MOVED_PX) play("select");
    }
    function onScrollEnd(event: Event) {
      if (event.target instanceof Element && event.target.matches("[data-haptic-scroll]")) settled(event.target);
    }
    // Without `scrollend` (older Safari): the row has settled when scroll events stop and no finger is down.
    function onScroll(event: Event) {
      const row = event.target;
      if (!(row instanceof Element) || !row.matches("[data-haptic-scroll]")) return;
      window.clearTimeout(timers.get(row));
      const check = () => {
        if (touching) timers.set(row, window.setTimeout(check, SETTLE_MS));
        else settled(row);
      };
      timers.set(row, window.setTimeout(check, SETTLE_MS));
    }

    const passive = { capture: true, passive: true } as const;
    const settleEvent = "onscrollend" in window ? "scrollend" : "scroll";
    const onSettle = settleEvent === "scrollend" ? onScrollEnd : onScroll;
    document.addEventListener("click", onClick, true);
    // A touchstart listener also makes iOS apply :active styles to every element.
    document.addEventListener("touchstart", onTouchStart, passive);
    document.addEventListener("touchend", onTouchEnd, passive);
    document.addEventListener("touchcancel", onTouchEnd, passive);
    document.addEventListener(settleEvent, onSettle, passive);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("touchstart", onTouchStart, passive);
      document.removeEventListener("touchend", onTouchEnd, passive);
      document.removeEventListener("touchcancel", onTouchEnd, passive);
      document.removeEventListener(settleEvent, onSettle, passive);
    };
  }, []);

  return null;
}
