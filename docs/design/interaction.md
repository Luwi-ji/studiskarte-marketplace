# Interaction: taps, press, haptics, scrolling, sheets

One set of rules for how the app answers a finger. Most of it is global, so a new screen gets it by using plain `<button>`, `<a>` and `<dialog>`.

## Taps

- Every tap target is at least 44 x 44 px. Icon buttons get the size from padding, not from the icon.
- `touch-action: manipulation` is set on links, buttons, selects, summaries, labels and role-based controls (and on `body`), so there is no 300 ms wait and no double-tap zoom on iOS.
- `-webkit-tap-highlight-color` is transparent everywhere. The pressed state below replaces the grey flash.
- Buttons and role-based controls (`role=button|tab|switch|menuitem`, `summary`) are `user-select: none` with no iOS copy callout. Text and inputs stay selectable.
- Use a real `<button type="button">` for actions and `<a href>` (Next `Link`) for navigation. A `div` with `onClick` is never a control.
- Disable with the `disabled` attribute, or `aria-disabled="true"` when the control must stay focusable. Both get no pressed state and no haptic.

## Press feedback

Pressed means opacity 85% and scale 98%, in 100 ms ease-out. Transform and opacity only, so nothing around the control moves.

- Automatic for `button`, `a[href]`, `[role=button]`, `[role=tab]`, `summary` and checkbox/radio labels (`globals.css`, base layer).
- `.press` (97% scale) for tab-bar items, icon links and filled buttons that want a stronger shrink. `.press-row` tints the background of a full-width row instead; it is not also dimmed.
- With `prefers-reduced-motion: reduce` there is no scale and no transition. `.press` becomes a dip in opacity.
- A utility class on the element (`active:opacity-70`) overrides the global rule.

## Haptics

`HapticsProvider` (`src/components/haptics.tsx`, mounted once in the root layout) plays a haptic on every trusted tap. Components do not call it for ordinary taps.

| Kind | When | Android | iOS 17.4+ |
| --- | --- | --- | --- |
| `tap` | buttons, links, rows, summaries, sheet openers | 8 ms | one tick |
| `select` | tabs, chips with `aria-pressed`, checkboxes, radios, switches, sliders | 12 ms | one tick |
| `success` | a send or save that worked | 10-40-16 ms | two ticks |
| `warning` | a destructive confirm | 18-50-18 ms | three ticks |

- Android uses `navigator.vibrate`. iOS has none, so `haptic()` (`src/lib/haptics.ts`) toggles a hidden, `aria-hidden`, unfocusable `input[switch]` through its label, inside the person's own event. Elsewhere it does nothing. It never throws.
- Off with `prefers-reduced-motion: reduce`. At most one haptic per 60 ms.
- Per element: `data-haptic="success|warning|select|tap|none"` on the control or an ancestor. `data-no-haptic` on a container silences everything inside it.
- For an outcome that is not a tap (a request that finished), call `haptic("success")` from the handler that ran inside the gesture. On iOS, ticks only fire inside or right after a user gesture.
- Sheets and drawers open from a click, so the tap haptic already covers them. Do not add another.
- Scrolling is silent. The exception is a scroll-snap row marked `data-haptic-scroll`: it plays `select` once when it settles on a new position after a finger moved it (`scrollend`, or a debounced `scroll` where that is missing). Use it for swipe rows and carousels with snap points; not for long lists.

## Scrolling

- The page may rubber-band. Sheets, drawers, dialogs and scroll rows use `overscroll-behavior: contain` (set globally on `dialog`, `.overflow-y-auto`, `.overflow-x-auto`, axis by axis) so a swipe at the end of a panel never drags the page or the browser chrome behind it.
- Sideways rows use `snap-x snap-mandatory`, hide the scrollbar, and pad with `scroll-px-*` so the first card lines up with the page edge.

## Sheets

- Use `BottomSheet` or `useSlideDialog`: a native `<dialog>`, slide-in at most 220 ms ease-out (none with reduced motion), Escape and tap-outside close, swipe down closes from the handle.
- A sheet's own scroll region is `min-h-0 flex-1 overflow-y-auto` with bottom padding `env(safe-area-inset-bottom)`.
- Older Safari (Tailwind 4 and Next 16 target Safari 16.4 and up; `<dialog>` and `dvh` need 15.4): a sheet's `display: flex` while open, its slide-in and its `vh` cap are plain CSS in `globals.css` (`dialog[data-slide="bottom"]`), not Tailwind's `open:` variant. `::backdrop` gets `--color-black` there, because Safari before 17.4 passes no custom properties to `::backdrop` and `backdrop:bg-black/50` would not dim (iOS 16.2 to 17.3). A sheet that sits in a sticky, blurred or transformed parent (the thread's three-dot menu in the page header) passes `portal` so it lives in `document.body`; never for a sheet whose inputs belong to a surrounding `<form>`.
- The slide cannot leave a sheet stuck: a stalled entrance animation is finished after 300 ms, a panel left off screen is put in place, a swipe whose `touchend` never came springs back at the next touch, a close the parent refuses springs back, and a dialog that does not show at all becomes a plain overlay (reported to Sentry).

## Out-of-date app

An app on the Home Screen keeps running old scripts until it is reloaded. `UpdateNotice` checks `/api/version` when the app returns to the foreground, when a page is restored from the back/forward cache, and every 5 minutes. When a newer version is found the banner "A new version is ready" stays, and the next plain tap on an in-app link loads that page from the server (a full navigation) instead of navigating in place, so the new scripts arrive with it.
