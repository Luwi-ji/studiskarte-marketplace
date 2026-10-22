# Audit: create, messages, thread, notifications, transactions

Screens: `post-new`, `messages`, `thread`, `notifications`, `transactions`, light and dark. Rules: `docs/design/principles.md` (P1 to P24) and `docs/design/brand.md`. Seen in the 360 px screenshots and checked against the source. In the thread screenshot the top of the first reservation card is hidden by the capture's sticky header, so that card is read from `offer-card.tsx`.

### S1. Thread: nothing in the thread says "do not pay before the handover is agreed", and two lines push the other way
Both light and dark. The reservation card says "Agree a time and place first. Then the slot is secured by payment." (`payment-steps.tsx:101`), and later steps say "Paying secures the slot: after that it can't be cancelled." (`payment-steps.tsx:179`) next to an "I've paid" button. There is no safety line in the thread, no "meet in a public place", no "check your GCash Transactions tab, not a screenshot" on "Payment received" (`payment-steps.tsx:145-152`), and no warning when someone asks to move to another app. The only safety line on the way in, "Meet in a public place, and pay in person." (`src/app/messages/new/page.tsx:55`), disappears once the chat exists. This breaks P16, P6 and P15 and the brand voice rule "safety copy leads with the scam that matters".
Fix: put one fixed, always-visible line at the top of the reservation card, in plain words: "Do not pay before you both agree on a time and place. Pay in person, or check your GCash app, not a screenshot." Reword "secured by payment" to say what actually locks the slot. Show the GCash line right above "Payment received" and "I received the cash". Files: `payment-steps.tsx:101,145,179`, `handover-panel.tsx:126` (top of the panel).

### S2. Thread: the next step is not the primary button, and Cancel sits next to it looking identical
Both. On the reservation card "Propose a time and place" and "Cancel reservation" are two full-width, outlined, same-height buttons stacked with an 8 px gap (`handover-panel.tsx:192-195` uses the outline `button` style; `offer-card.tsx:218`). The thing the student must do next has the same weight as the destructive option. This breaks P20 (primary action largest, destructive apart from confirming) and the brand components rule.
Fix: make "Propose a time and place" the filled brand button (`bg-brand`, as "Agree" already is at `handover-panel.tsx:154`); turn "Cancel reservation" into a small red text button placed under a divider, not directly under the primary. Files: `handover-panel.tsx:23,193`, `offer-card.tsx:218`, `payment-steps.tsx:23` (the shared `button` constant).

### S2. Thread: the reservation card buries what to do under four paragraphs
Both. Top to bottom: "You", product row, "Reserve at ₱350", "Accepted! It is reserved for you.", "Reserved · Updated 2 min ago" (12 px grey), a divider, "No time and place yet. If none is agreed within 7 days...", "Payment · ₱350 in all / Takes: Cash", "Agree a time and place first...", then the button. The card is about 420 px tall at 360 px wide, and with the sticky header, Transactions bar and composer it nearly fills the screen, so the button is the last thing seen. The state ("Reserved") is 12 px grey text, not a visible status. This breaks P20 and the brand rule "say what happens next".
Fix: after the title add one bold line, "Next: agree a time and place. If you do not, the reservation is cancelled in 7 days", then the button, then the details (payment, ways to pay) below it. Merge the two "agree a time and place" sentences into one, and show the state as a pill. Files: `offer-card.tsx:150-164`, `handover-panel.tsx:127-138`, `payment-steps.tsx:91-101`.

### S2. Thread: two green cards for one reservation, and the first one explains the UI
Both. After a reservation is accepted, the offer's own card stays in the chat (green border, product row, "Reserve request") with the text "This reservation moves down the chat with every update. See its latest card below." (`offer-card.tsx:152-153`), and the live card appears again further down with the same product row and the same green border. That is a card for the app's own mechanics, a repeated product row, and two bordered boxes for one deal. This breaks the brand rule on cards ("do not wrap plain text in a card to decorate it") and P6 (one thread, one clear state).
Fix: when `pointer` is true, render a one-line system message ("Reservation accepted. Latest update below.") with no border and no product row. Files: `offer-card.tsx:143-153`, `chat.tsx:171`.

### S2. Thread: the header shows no person, only a "Transactions" bar
Both. The header is just "Mika Reyes". Under it the sticky bar spends its space on the textbook thumbnail and the word "Transactions / 2 listings". There is no school, no stars with count, no items sold, no "typically replies within" (only shown if data exists, `page.tsx:86`), no badge state, and no "New" for a new seller. This breaks P1, P2 and P3 on the screen where the student decides whether to hand over money or goods. The bar is also about 55 px of permanent chrome next to the 44 px composer and 56 px header.
Fix: replace the bar's left side with a seller line under the name: "TUP Manila · ★ 4.8 (12) · 9 sold · replies within a day · School email checked" (or "New · School email checked"). Move Transactions to a small header action or a chip. Files: `src/app/messages/[id]/page.tsx:82-88`; add school, rating, sold and badge to `Person` in `src/lib/messaging/read.ts:21`.

### S2. Thread, Transactions: listing titles are cut mid-word in cards that carry the deal
Both. "Casio fx-991ES Plus calc..." and "Engineering Mathematics text..." in the "You asked about" card and the reservation card (`product-card.tsx:19`, one line `truncate`), and again "Engineering Mathematics text..." on the Transactions page (`me/transactions/page.tsx:74`). The part that tells a student which item they are paying for is exactly the part that is cut ("calculator" versus "calculus").
Fix: use `line-clamp-2` for the title in `ProductCard` (both compact and normal) and on the Transactions row; keep the price line on its own row. Files: `product-card.tsx:19-20`, `me/transactions/page.tsx:74`.

### S2. Thread: block and report is a grey caption that does not look tappable
Both. "Block or report Mika Reyes" is 12 px grey text (`text-xs text-zinc-500`) in a `<details>` with no chevron (`page.tsx:91`), scrolls away with the page, and sits above the first message. Nothing marks it as a control and it is the only safety exit in the thread. This breaks P6 (make leaving and reporting easy) and the 12 px minimum.
Fix: move it into a "⋯" action in the page header (44 px) that opens a sheet with Report and Block; keep 14 px text. File: `page.tsx:82,89-97` (`PageHeader` has an `action` slot).

### S2. Notifications: alerts toggle is 32 px high and the banner takes the whole first screen
Both. The switch is `h-8 w-14` (32 px tall, `alerts-toggle.tsx:119`); the 44 px row around it is not the button. The banner is a blue-bordered card with a 4-line paragraph plus an underlined 12 px link ("Me > Settings > Alerts on this device") that points to the place the student already is, and it sits above the single notification. This breaks P20 (44 px targets) and P18 (ask with a reason, not as the first thing on load).
Fix: make the whole banner row a 44 px button or give the switch a 44 px hit area (`before:` pseudo-element or padding); cut the copy to "Get a phone alert for handover times and payments." and drop the settings link and "You can change this any time" line. Files: `alerts-toggle.tsx:99-122,142-144`.

### S2. Create a post: the form shows everything at once, not the shortest listing
Both. One long page: type, photos, title, 5-row description, category, price, quantity with "Ongoing / No limit", handover with place, payment with 3 checkboxes, who can buy, availability pickers with day chips. About 2,000 px tall at 360 px (the screenshot is 2,494 device px at 1.25). P7 says the shortest listing is one photo, a title, a price and a category with safe defaults for the rest, and under a minute for a first-time seller (P21).
Fix: keep Type, Photos, Title, Category, Price visible, then a "More details (optional)" section closed by default holding Description, quantity, handover, payment, who can buy and availability, each with a stated default ("1 available, meet-up, cash, every day"). Sticky Post button stays. File: `src/app/posts/post-form.tsx:293-491` (wrap in a `<details>` or step).

### S2. Create a post: photo step is a small dashed tile with no guidance
Both. "+ Add photos" is a single square one third of the width (`post-form.tsx:247`) and the only hint is "The first photo is the cover. Location data is removed from every photo." (`:254`). Nothing says use daylight, show the whole item first, show any damage (P8). The photo is the first and most important field, and it is the smallest target on the page. No file size shown before upload (P8).
Fix: make the empty state a full-width tile with an icon and 3 short lines: "Start with the whole item in daylight. Add a close-up of any scratch or mark." Keep the grid after the first photo. File: `post-form.tsx:206-254`.

### S3. Create a post: field and checkbox borders are too faint in both modes
Both. Input borders are `zinc-300` (`#c9d2df`) on white, about 1.5:1, and `zinc-700` (`#353f50`) on the dark page, about 1.8:1. Unchecked checkboxes, the dashed photo tile and the empty Title/Description boxes nearly disappear in dark mode. WCAG 1.4.11 asks for 3:1 for field boundaries. The same borders are used on the composer (`composer.tsx:101,117`) and the card buttons.
Fix: use `zinc-400` (`#94a0b4`) for field borders in light and a lighter step (about `#5d6b83`) in dark through one token. Files: `globals.css:37-48`, `post-form.tsx:72-73`, `availability-picker.tsx:25-27`, `composer.tsx`.

### S3. Create a post: copy and layout details
Both. (1) Type options read "Showcase (I offer)" and "Wishlist (I seek)", which is jargon; use "I'm selling or giving" and "I'm looking for" (`post-form.tsx:193,198`; also the JSX breaks "Showcase\n(I offer)" onto two lines). (2) "How many are available" input is meant to be 112 px (`w-28`) but renders full width because `field` already sets `w-full` (`post-form.tsx:397`), so the number box and the checkbox look unrelated. (3) "Others" under payment (`src/lib/payment.ts:4`) is vague; say "Other (say how in the note)". (4) Title and Description have no placeholder or example (a defect, the edition, the year).

### S3. Thread: type and wording below the rules
Both. Message times are 11 px (`chat.tsx:175`, under the 12 px floor). The date divider reads "Oct 23, 2026" (`chat.tsx:38`, brand format is "Oct 23" and "Sat, Oct 17"). The "Payment · ₱350 in all" and "Takes: Cash" lines are terse, 12 px and 14 px with no gap (`payment-steps.tsx:93-94`): "Seller accepts: Cash". The photo remove "×" in the composer is 28 px (`composer.tsx:76`, the post form's version at `post-form.tsx:220` already uses a 44 px target). In dark mode the disabled Send button (`opacity-40` on blue, `composer.tsx:123`) is almost the same as the background.

### S3. Messages, Transactions, Notifications: one word for three things, and uneven shapes
Both. The inbox row says "2 transactions" where the item name would help (`(tabs)/messages/page.tsx:71`), the thread bar says "Transactions / 2 listings", and the Transactions page lists reservations only: three meanings for one word. The preview "You: Reserve request" reads like a system label (`messages/page.tsx:53`). Notification rows say "Your offer was accepted" for a reservation (`lib/notifications/text.ts:53`), with no name and no next step ("Agree a time and place"). Page gutters differ (`px-4` on Create, `px-3` elsewhere) and cards differ (Transactions row `rounded-xl border-zinc-200`, thread card `rounded-2xl border-zinc-300`).
Fix: call a listing in a chat "a deal" or "an item" everywhere and keep "Transactions" for the Me page; show the listing title in the inbox row; change the notification headline to name the item and the action; pick one card radius and border colour.

### S3. Transactions: empty and loading states
Both. The empty state is one grey sentence with no button (`me/transactions/page.tsx:37`), unlike Messages and Notifications which have "Browse the feed". The brand rule says an empty state has one button. The loading fallback is plain "Loading…" text on all three list screens (`messages/page.tsx:24`, `notifications/page.tsx:26`, `me/transactions/page.tsx:25`), so the page jumps when rows arrive (brand: reserve space). Fix: add a "Browse the feed" button and a 3-row skeleton.

### S3. Seeded images
Both. The Textbook and Calculator thumbnails are flat navy and blue tiles with a tiny, unreadable word, so the 44 px thumbnails in the thread bar and Transactions rows carry no information; the navy tile nearly merges with the dark page. This is seed data, not code: seed real photos of an item in daylight so these screens can be judged properly.

## What already works well

- The messages list is clean and fast to scan: avatar initial, name, time, one preview line, 72 px rows, an unread count that is a number not just colour. Empty state has one button.
- The thread composer is solid: 44 px attach, text and Send; a clear "Could not send. Check your connection and try again." error that keeps the text.
- Confirm steps in the offer card ("Accept and reserve it for Mika?" / "Yes, accept"; "Keep it" / "Yes, cancel") are two 44 px buttons with the red one only on the cancel confirmation.
- The Transactions page groups by state ("Waiting for an answer", "In progress", "Completed") and each row already says what to do next ("Reserved · agree a time and place"). Keep that.
- The post form's controls are 44 px (checkbox rows, photo remove and move, day chips), the Post button is 48 px, sticky and the largest thing on the screen, and the "For your safety, choose a busy public spot on campus" hint is the right wording.
- Dark mode is consistent across all five screens: no white boxes, text and green/amber borders keep contrast, the brand blue links switch to the lighter `brand-text`.
