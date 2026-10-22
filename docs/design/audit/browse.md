# Browse screens audit (feed, search, post, profiles)

Screens: feed, search, post-calc, post-reserved, post-wish, profile-seller, profile-me. Light and dark checked for each. Capture artifacts (dev "N" button, mid-page sticky bars) ignored. Source checked for the file and line of each fix.

### S1. Post (calc, reserved, wish): the safety message "do not pay before the handover is agreed" does not exist
Both modes. The only money copy is "The app never handles the money. You pay each other directly." in 12 px grey (`text-xs text-zinc-500`) under "Payment". It reads as an invitation to pay the stranger directly, and nothing near Message / Make offer / Reserve warns about the main scam. A search of `src/` finds no "do not pay before" text anywhere on the browse path. Breaks principle 16 and the brand voice rule "safety copy leads with the scam that matters".
Fix: replace that line with a visible notice (amber tint like the reserved banner, 14 px, not grey): "Don't pay until you and the seller have agreed where and when to meet. Pay at the handover." Keep it in the Payment section and repeat it as one line above the sticky action bar. For wishlist, say the same to the person supplying it.
File: `src/app/posts/[id]/page.tsx:144-148` (and the sticky bar at `:221-245`).

### S2. Post (calc, wish): seller card lacks the trust cues principles 1 and 2 ask for
Both modes. Seller row shows name, "School email" badge, handle and school; below it a plain grey "No reviews yet". There is no items sold, no "typically replies within", and a new seller shows "No reviews yet" instead of "New". The seller sits last, below Description, Meet-up, Payment and Available, so it is below the fold at 360 px. Breaks principles 1, 2 and brand rule "A new seller shows New".
Fix: move the seller block directly under the price/title/chips (before Description), and show one compact line: school, stars (count) or a "New" pill, "Sold 3", "Replies within a day". The profile page already computes sold and reply time (`src/app/u/[handle]/page.tsx:91-107`); extend `getPostDetail` (`src/lib/posts/detail.ts`) with them. In `src/components/stars.tsx:5` return a "New" pill when `average === null`.
File: `src/app/posts/[id]/page.tsx:166-205`.

### S2. Feed, post, profile, search: school name is cut mid-name, which hides which school it is
Both modes. Feed and profile cards show "Technological University ..." (truncate, `text-xs`); the post seller row shows "@ui_seller · Technological University o…". The part that tells TUP from "Technological University of Davao" is cut away, and the school is the main density cue (principle 13).
Fix: use a short school name or code (TUP) on cards and in the seller row, with the full name on the profile and post detail. On the post seller row put the school on its own wrapped line instead of sharing a `truncate` line with the handle.
File: `src/components/post-card.tsx:22`, `src/app/posts/[id]/page.tsx:184-187`; the same pattern in `src/app/(tabs)/search/page.tsx:129-131`.

### S2. Post, profile, search: the back arrow always goes to the feed and throws away the student's place
Both modes. `PageHeader back="/"` on the post, profile and search pages sends the student to a fresh feed, not to where they came from. After "Show more", a filter or a search, one tap on a card and Back loses the loaded cards, filters and scroll. Seller profile then Back skips the post they were reading. Breaks principle 20 (quick, low-data on 2 GB phones: the feed is reloaded).
Fix: make the back control `router.back()` (client component) with `"/"` only as the fallback when there is no history.
File: `src/app/posts/[id]/page.tsx:31`, `src/app/u/[handle]/page.tsx:34`, `src/app/(tabs)/search/page.tsx:30`, `src/components/page-header.tsx:13-16`.

### S2. Feed (and profile grid): a wishlist card looks like an item for sale, and "Showcase" repeats on every card
Both modes. The wishlist card shows a bare "₱800" with the sale-card layout; only the grey 12 px "Wishlist · @ui_seller" line tells it apart. The post page says "Budget ₱800", so card and page disagree. Every other card spends its first meta line on the word "Showcase", which carries no information and pushes the school onto its own clipped line. Breaks brand "stars/meaning never rely on colour alone" and principle 12 (price on the card must be readable at a glance).
Fix: wishlist cards get "Budget ₱800" and a small "Wanted" pill on the photo; drop the "Showcase" label (show `kindLabel` only for wishlist).
File: `src/components/post-card.tsx:16-21`.

### S2. Feed, profile grid: a reserved post looks open on the card
Both modes. The reserved textbook (₱350) has no "Reserved" mark in the feed or on @ui_seller's profile; the student only learns it on the post page. The owner's own grid already shows a status pill (`own-posts.tsx:55-57`), but the public card data has no status field (`FeedItem` in `src/lib/discovery/feed.ts:9-21`, `PostCardData` in `src/lib/discovery/cards.ts:7`).
Fix: add `status` to the card data and show a "Reserved" pill on the photo and dim it like `own-posts.tsx:54`. Saves a wasted tap and a wasted message.
File: `src/components/post-card.tsx:14`.

### S2. Feed: no school scope is visible, so the density cue (principle 13) is missing
Both modes. The feed shows every school mixed (the seeded TUP items sit next to "Block Polytechnic" and "testschool.edu.ph" items). The only school control is inside the Filters sheet, and the Filters button has no active-state hint until something is set. Principle 13 asks for the student's own school as the default with the school filter kept visible.
Fix: add a one-line chip row under the search box: "My school · All schools" (default own school), and a "Showcase · Wishlist" toggle in the same row, since the two kinds are mixed in one grid.
File: `src/app/(tabs)/page.tsx:36-48`.

### S2. Profile (seller): Report and Block are as large as Follow and push the listings below the first screen
Both modes. Follow, "Report this student" and "Block" are three full-width 44 px buttons; the Showcase/Wishlist tabs start about 575 px (css) down, so on a 360 x 640 phone no listing is visible without scrolling. Report and Block have the same weight as the main action. Breaks principle 20 (primary action largest, destructive apart) and puts a rare action first.
Fix: keep Follow as the only button; move Report and Block into a "⋯" menu in the header or into one text row at the bottom of the page.
File: `src/app/u/[handle]/page.tsx:121-127`.

### S2. Profile (seller and me): no bio, no "New", and jargon counters
Both modes. The profile has avatar, name, handle, badge, school, "No reviews yet", "Sold 0", "Granted 0" and a follower count, and no bio line at all (`bio` appears nowhere in `src/`). Principle 2 wants a one or two line bio and a "New" state; "Granted" is unclear to a student (it means given away free) and "Sold 0 / Granted 0" shown as underlined links to empty lists looks like a dead end on a new account. No "typically replies" line appears here for the seeded user.
Fix: add a short bio field (edit in Settings, prompt on own profile: "Add a line: course, year, what you sell or look for"); show a "New" pill while there are no deals; rename "Granted" to "Given free"; hide a zero count link or make it plain text.
File: `src/app/u/[handle]/page.tsx:86-107`, `src/components/stars.tsx:5`.

### S2. Post (calc, wish): three equal-width buttons and "Reserve" as the only primary action
Both modes. Message, Make offer and Reserve are three equal 48 px buttons, with Reserve in blue. In a chat-led market with a safety rule that the handover is agreed first (principles 5, 6, 16), the first step for a stranger is a message, and a one-tap "Is this still available?" is what principle 5 asks for. Reserve as the blue button invites committing the seller's item before talking. "Supply it" (wish) is also unclear wording.
Fix: Message is the primary button and wider (`flex-[2]`), with a quick opener; Make offer and Reserve are secondary, or Make offer moves into the chat. Rename "Supply it" to "I have this".
File: `src/app/posts/[id]/page.tsx:228-242`; labels in `src/lib/deals/rules.ts` (`offerLabels`).

### S2. Post (reserved): the banner does not say it is the student's own reservation or what happens next
Both modes. The textbook post, seen by the buyer, shows an amber "Reserved – someone has a deal on this." The viewer is that someone. No next step (handover date, place, "do not pay yet") is shown on the page; only the sticky "See reservation" button leads there. Breaks brand voice ("say what happens next") and principle 15 and 16.
Fix: when `myTransaction` exists say "You reserved this. Next: agree the meet-up in your messages. Don't pay before it is agreed."
File: `src/app/posts/[id]/page.tsx:83-88`, `src/app/posts/[id]/buyer-shortcuts.tsx:56-65`.

### S3. Search (empty state): a grey sentence and nothing to tap
Both modes. The empty search shows only "Search for a post, a person by handle or name, or a school." in grey, under an auto-focused field, with the keyboard open on a phone. Brand rule: empty states say what to do next and have one button. The default browser focus ring is black (light) and white (dark), not the brand blue (no focus style in `src/app/globals.css`). In dark mode the selected "Posts" segment differs from the unselected ones only by a slightly lighter grey.
Fix: show recent searches and 4 to 6 category or school chips (tap to search); add a brand focus ring (`outline-brand`) and a clearer selected segment in dark (`dark:bg-zinc-700`).
File: `src/app/(tabs)/search/page.tsx:40-42,61,69`, `src/app/globals.css`.

### S3. Post (all): the page repeats five look-alike sections, and the bottom has dead space
Both modes. Description, How to get it, Payment, Available and Seller are all the same uppercase grey 14 px heading plus rule, so nothing stands out, which feels form-like and generic. The bottom of the page has about 170 px of blank (main `pb-[5rem]` plus the report wrapper `pb-24`). Dates use "Oct 23, 2026" with the year, while the brand uses "Oct 17".
Fix: group Meet-up, Payment and Available under one "Handover" block with the safety line on top; drop the extra `pb-24`; drop the year for dates in the current year.
File: `src/app/posts/[id]/page.tsx:26,39-46,73,215`.

### S3. Feed, post: tiny badges and missing age cue
Both modes. The unread-count badges use 10 px text (`bottom-nav.tsx:72`, `notification-bell.tsx:17`) and the owner pills 10 to 11 px (`own-posts.tsx:56`, `page.tsx:256`), under the 12 px floor in brand. Cards show no "listed 2d ago" cue (principle 12) and no condition, so old and new posts look the same.
Fix: raise badges to 12 px (`h-5 min-w-5`); add "2d ago" to the card meta.
File: as listed; card age needs `listedAt` (already in `FeedItem`) passed to `PostCardData`.

### S3. All three: loading and seed images
Both modes. Loading states are a bare "Loading…" line (`(tabs)/page.tsx:18`, `u/[handle]/page.tsx:36`, `posts/[id]/page.tsx:32`), so the grid jumps in when data arrives; brand says photos reserve their space. The five seeded listings use flat colour tiles with a word ("Lamp", "Calculator"); they are legible but make the feed look like a placeholder in demos.
Fix: grey skeleton squares (two rows of cards) as the fallback; use real item photos in the seed.

### S3. Post (reserved): "Cancel reservation" sits next to "See reservation"
Both modes. The destructive action is the left, same-size neighbour of the primary one. A confirm step exists, which limits the harm; brand says destructive actions should be apart from confirming ones.
Fix: make "See reservation" full width, and show "Cancel reservation" as a text link on the line below, or inside the reservation page only.
File: `src/app/posts/[id]/buyer-shortcuts.tsx:57-65`.

## What already works well
- Photo is first on the post page, and price (bold 24 px) and the title are both on the first screen at 360 px; the price is also on every card.
- Tap targets are at 44 px or more everywhere checked: back, bell, heart, search field, Filters, tabs, segment control, Follow, sticky buttons.
- Dark mode holds up: text, badges, borders and the amber reserved banner all stay readable, and no white boxes appear. The "School email" badge says exactly what was checked.
- Money, times and the "Philippine time." note follow the brand format (₱1,200, 9:00 AM – 10:00 AM, Every Monday). Voice is plain, with no "oops" or blame.
- Own-profile empty state is good: one sentence, one blue "Create a post" button, and the "0 of 20 open posts used" cue.
- Wishlist post uses the right words in context ("Budget", "How they will pay", "Posted by", "Wants:").
