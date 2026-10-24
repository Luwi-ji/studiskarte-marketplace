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

## Profile, My posts, and Notifications

- Profile Showcase/Wishlist tabs stay directly below the safe-area page header. Keep the bio intact and use a compact gap between profile details and listing tabs.
- My posts keeps type tabs and horizontally scrolling status filters together in one sticky strip below the header; the open-slot summary scrolls with the list.
- Nonempty, complete profile and My posts lists end with “You've seen everything” and the shared scroll-to-top arrow (instant with reduced motion). Do not show the completion message for a capped public profile or before the feed's final pagination cursor is exhausted.
- Profile listing Withdraw/Delete closes the action menu before opening one shared confirmation sheet, never a browser confirm or stacked sheets. Cancel/Escape dismiss without changing the post; the existing server action runs only on confirmation and failures stay visible for retry.
- Notifications places accessible mark-all-read and device-alert controls in the page header. Keep pending feedback and actionable errors visible; device alerts continue to use the existing notification settings sheet.
- Hearts (`CardHeart`, `HeartButton`) show the change at once with `useOptimistic` and take the server's state after `setHeartAction` revalidates the app, so the feed, a listing, and Hearted posts agree. A refused or failed heart rolls back.

## Sheets

- Use `BottomSheet` or `useSlideDialog`: a native `<dialog>`, slide-in at most 220 ms ease-out (none with reduced motion), Escape and tap-outside close, swipe down closes from the handle.
- A sheet's own scroll region is `min-h-0 flex-1 overflow-y-auto` with bottom padding `env(safe-area-inset-bottom)`.
- Older Safari (Tailwind 4 and Next 16 target Safari 16.4 and up; `<dialog>` and `dvh` need 15.4): a sheet's `display: flex` while open, its slide-in and its `vh` cap are plain CSS in `globals.css` (`dialog[data-slide="bottom"]`), not Tailwind's `open:` variant. `::backdrop` gets `--color-black` there, because Safari before 17.4 passes no custom properties to `::backdrop` and `backdrop:bg-black/50` would not dim (iOS 16.2 to 17.3). A sheet that sits in a sticky, blurred or transformed parent (the thread's three-dot menu in the page header) passes `portal` so it lives in `document.body`; never for a sheet whose inputs belong to a surrounding `<form>`.
- The slide cannot leave a sheet stuck: a stalled entrance animation is finished after 300 ms, a panel left off screen is put in place, a swipe whose `touchend` never came springs back at the next touch, a close the parent refuses springs back, and a dialog that does not show at all becomes a plain overlay (reported to Sentry).

## Post drafts

- Showcase and Wishlist each keep their own draft on this device. Save draft and leave preserves it; Continue restores it.
- Start over and Discard delete the current post type's saved draft and reset the form, including cached values. Pending autosaves cannot restore the deleted draft.
- Reopening Create a post after either reset starts blank, without a saved-draft prompt. The other post type's draft is unchanged.

## Help and support

- Settings has two sections for it: Help and support (FAQs, Report a listing, Report a user, Report a bug, Send feedback, Contact us) and Follow Studiskarte (Facebook and Instagram buttons, Leave a review on Facebook). Addresses and routes live in `src/lib/support/config.ts`.
- Report a listing takes the listing's link (a full address, `/posts/<id>` or the id) and Report a user takes a username. Both go through the same `reportPost` / `reportStudent` as the report sheets, so limits, the hide-at-3 rule and the admin queue are shared. A confirmation replaces the form and never shows the owner of a listing.
- Bug, feedback and contact go by email to `SUPPORT_EMAIL` with the sender's handle, role and account email, and `Reply-To` set to that email. They share the 96-a-day mail quota, so each student is limited to 5 an hour and 10 a day. A message that could not be sent keeps what was typed and is never shown as sent.
- The Facebook review prompt (`ReviewPrompt`) opens after a post goes live and after a handover completed in the last 48 hours. At most once per 14 days per device, once per post or deal, never after Don't ask again, and not for 90 days after Leave a review was opened. State is in `localStorage` (`studiskarte:review-prompt:v1`); rules and tests are in `src/lib/support/review-prompt.ts`.

## Out-of-date app

An app on the Home Screen keeps running old scripts until it is reloaded. `UpdateNotice` checks `/api/version` when the app returns to the foreground, when a page is restored from the back/forward cache, and every 5 minutes. When a newer version is found the banner "A new version is ready" stays, and the next plain tap on an in-app link loads that page from the server (a full navigation) instead of navigating in place, so the new scripts arrive with it.
