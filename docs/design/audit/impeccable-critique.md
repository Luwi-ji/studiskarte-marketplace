⚠️ DEGRADED: single-context (design review only: the Impeccable detector binary is not installed, and no isolated second assessment was run)

# Impeccable critique: Studiskarte Marketplace, task-based

Surface mode: **Operate** (app UI, task completion first). Method: five first-time-student tasks walked through the 360 px "after" screenshots and the source. Findings already fixed in `browse.md`, `create-chat.md` and `account-legal.md` are not repeated. Anything I did not see or read is marked `[INFERENCE]`.

What the after-polish pass already fixed and I confirmed in the screenshots: the "Do not pay before you agree a time and place" notice on the post page and in the reservation card, the "Next: agree a time and place within 7 days" line, the filled "Propose a time and place" button with Cancel as a red text link, the seller line in the thread header ("New", "School email"), the "⋯" Report and Block sheet, "I'm selling or giving / I'm looking for" in the post form, a full-width photo tile with guidance, a collapsed "More details (optional)" block, "My school / All schools" chips, Reserved and Wishlist pills on cards.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | The deal states are clear (pill, "Updated 18 min ago", "Next: ..."). Gaps: nothing confirms "your post is live" after Post (`post-form.tsx:211` only `router.push`es to `/me?tab=...`); Block ends with a silent jump to the feed (`block-button.tsx:19`); Report ends with "Thanks. We will review it." and no timing. |
| 2 | Match System / Real World | 2 | "Wishlist" collides with the heart (saved items): in Shopee or Lazada a wishlist is what you saved, here it is what you want, and the app also has "Hearted". "Showcase", "Transactions" (a bank word for a chat deal), "Handle", "Perks", "Reserve" vs "Make offer" with no one-line difference. The post form already moved to plain words; the feed, profile and About did not. |
| 3 | User Control and Freedom | 3 | Cancel is apart and confirmed; Block is reversible in Settings; Back works. Gaps: after "Cancel reservation" or Block there is no undo and no "what now"; consent steps before the feed cannot be skipped (legal need, acceptable). |
| 4 | Consistency and Standards | 2 | One thing, four names: Showcase / "Selling or giving" / "Offer" / "listing" / "item"; Wishlist / "I'm looking for" / "Wanted" / "supply". Offer verbs flip to "Offer a price" / "I have this" on wishlist posts but the thread title says "Offers to supply it". Bottom nav is "Create" (a verb) next to nouns; "Me" opens Settings, not the profile. |
| 5 | Error Prevention | 3 | Public-place hint, 6 AM to 8 PM window, consent unticked by default, confirm on accept and cancel. Gap: "Paying, or agreeing to pay cash in person, locks the reservation: after that it can't be cancelled" sits right under the safety notice and invites a student to lock a deal with a stranger before meeting. |
| 6 | Recognition Rather Than Recall | 3 | Labelled five-tab nav, chips with active state, "Next:" lines. Gap: Messages and Transactions both show the same deal in different places; the thread bar says "2 items", which is not obviously a link to the deals. |
| 7 | Flexibility and Efficiency | 2 | No opener chips such as "Is this still available?" (P5), no "post another like this" (P10), no way to save a search (P12). Acceptable for a launch, weak for the dorm-clearing seller who has ten items. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, one accent colour, uncluttered. The reservation card is still the densest object in the app (state pill, next line, button, amber notice, payment, ways to pay, lock line, cancel). |
| 9 | Error Recovery | 3 | Good copy where seen ("Could not send. Check your connection and try again." keeps the text; "Nothing was deleted. Try again"). Gap: the wrong empty state on "My school" (issue 3) and the report with no follow-up. |
| 10 | Help and Documentation | 2 | No "how it works" anywhere inside the app; About is the only place the words Showcase and Wishlist are defined, and only signed-out visitors are sent there. Safety help lives only in legal pages. |
| **Total** | | **26/40** | **Acceptable (upper band)**: the deal screens are good, the words and the first minute are not |

## Design Specificity Verdict

**Authored for this product in the places that matter, generic in the places a student sees first.**

- Authored: the reservation card with its "Do not pay before..." amber rule, a 7-day clock, a seller line with "School email" (not "verified"), the 6 AM to 8 PM meet-up window, "The app never handles the money", the "I'm selling or giving" form with daylight photo guidance. No other marketplace says these things; they come from the Philippine scam research and show.
- Interchangeable: the feed. A two-column photo grid with a search bar, chips and a five-tab bar could be any marketplace template. Nothing on it says "student", "your school", "meet on campus" or "no money here". The first screen a new member sees carries none of the product's reasons to exist.
- Category words imported unchanged: Wishlist, Perks, Transactions, Showcase.

Deterministic scan: not run (detector not installed).

## Overall Impression

The hard part is done well: once two students are in a thread, the app tells each of them what to do next and warns about the main scam. The weak part is everything before the thread. A first-year student lands on a grid of photos with five labels she may not decode, no hint that posting takes under a minute, and a school filter that can lead to a wrong "no posts match these filters" message. The single biggest opportunity is the first 60 seconds and the vocabulary: say in plain words what each tab and chip does, and make the first action obvious.

## What's Working

1. **The safety copy sits at the decision point.** The post page puts the amber "Do not pay before you and the other person have agreed a time and place" notice inside Payment; the reservation card repeats it directly under "Propose a time and place". Operate-mode rule: put the warning where the action is. This is the best thing in the app.
2. **The deal flow tells the student the next step.** "Next: agree a time and place within 7 days, or the reservation is cancelled." in bold, one filled button, destructive text link apart, a status pill instead of grey 12 px text. A first-timer cannot be lost here.
3. **The post form is nearly the shortest listing.** Photo tile, title, category, price visible; description and place after; "More details (optional)" with its defaults stated ("1 available, meet-up, cash, every day"); a sticky 48 px Post button. This follows P7 and the Impeccable rule "collect minimal information, smart defaults".

## Priority Issues

### 1. [P1] The five words a student must understand are not their words, and two of them clash

Where: feed chips (`src/app/(tabs)/page.tsx:82-87` "Showcase", "Wishlist"), profile tabs (`u/[handle]/page.tsx:28-31`), About (`(public)/about/page.tsx:33`), filter sheet (`feed/filter-sheet.tsx:97-99`), card pill "Wishlist", bottom nav "Perks", Me "Transactions" (`me/settings/page.tsx:75`), welcome "Handle" (`welcome-form.tsx:40`), offer cards "Offers to supply it" (`messages/[id]/offer-card.tsx:116-121`).
- "Wishlist" is read by a Filipino shopper as the saved list (Shopee, Lazada). This app also has hearts ("Hearted"), so the app has two things that both sound like a wishlist and the wrong one has the word. A student tapping "Wishlist" expects her saved items and gets other people's requests.
- "Showcase" is a portfolio word, not "for sale". "Transactions" means money moving, but the app holds none and the page lists reservations. "Handle" is social-media jargon. "Supply" is formal English.
- The post form already uses "I'm selling or giving" and "I'm looking for", so the same idea has three names across three screens (breaks heuristic 4; P21 asks for plain words).
Why it matters: ESL first-year students will not ask what a chip means; they will skip it. The main discovery filter and the safety-critical deal list are the screens with the unfamiliar words.
Fix: one glossary, applied everywhere. Showcase becomes **"For sale or free"** (chip, profile tab, filter), Wishlist becomes **"Wanted"** (chip, tab, card pill, About), Transactions becomes **"My deals"** (Me row, page title, inbox row, thread chip "2 deals"), Handle becomes **"Username"**, "Offers to supply it" becomes "Says they have this". Keep "Perks" only if the tab shows a one-line subtitle on first visit (see issue 5). Keep "Reserve"/"Make offer" but add a single line under the two buttons on the post page: "Reserve: ask the seller to hold it at the asking price. Make offer: suggest a different price." Do not rename "Hearted" ("Saved" is clearer, optional).
Command: `$impeccable clarify` (copy and terminology), with `$impeccable document` to put the glossary in `docs/design/brand.md`.

### 2. [P1] The reservation card tells a first-timer that paying locks the deal, right under "do not pay yet"

Where: `src/app/messages/[id]/payment-steps.tsx:101,125,163,179` and the line "Paying, or agreeing to pay cash in person, locks the reservation: after that it can't be cancelled." visible in `thread.png`.
- The amber notice says do not pay before the time and place are agreed. Four lines later the card says paying or agreeing to cash "locks" the deal and removes the exit. For a 16 year old or a cautious buyer, "agreeing to pay cash in person" reads as a promise made in the app before meeting, with no way out. It also says "The slot is secured" when no one has met.
- The sequence the student actually needs: agree place and time, meet in public, check the item, then hand over cash. The lock sentence appears before the place and time exist.
Why it matters: this is the highest-stakes moment in the app (safety principle 4 and 16, heuristic 5). A line meant to prevent no-shows reads as pressure.
Fix: hide the "locks the reservation" sentence and the "I'll pay in cash" step until a time and place are agreed (`deal.handover` exists). Before that, show only "Propose a time and place". After it, replace the lock line with: "After you both agree, the reservation stays until the meet-up. Cancel before then if you feel unsure." (confirm the real rule with the owner first; if the lock is real, say plainly what it locks and for whom). Keep the amber notice as the only text above the button.
Command: `$impeccable clarify` and `$impeccable distill` (cut the card to state, next, button, then details behind "Show details").

### 3. [P1] A new school shows a wrong empty state, and a brand-new member lands on a feed that does not say what to do

Where: `src/app/(tabs)/page.tsx:90-105`, `src/app/welcome/actions.ts:33` (redirect to `/`), `PageHeader title="Studiskarte" logo`.
- Empty feed with no filter: "Nothing posted yet. Be the first." plus a button. Good. But tapping "My school" is a filter (`active > 0` is `[INFERENCE]` true for a school chip, based on the "Filters" counter design; I did not read `activeFilterCount`), so on a campus with no posts the student gets "No posts match these filters." and "Clear filters". She did not set a filter; she tapped a school chip. Launch is campus by campus, so this will be the first thing many students see.
- With a full feed (screenshot `feed.png`) the first screen is the grid. There is no one-line explanation of the product, and the only clue to posting is the plus in the nav. Welcome ends with `redirect("/")` and nothing welcomes the member by name.
Why it matters: aha moment is "I see what others sold on my campus" or "I posted my first item in under a minute". Neither is made explicit. Heuristic 9 and 1.
Fix: on `school` chip with zero results, show "No one at {school} has posted yet. Be the first, or look at all schools." with two buttons (Post an item, All schools). See the first-run plan at the end for the first-session strip.
Command: `$impeccable onboard`.

### 4. [P2] Report and Block end without telling the student what happens

Where: `src/app/safety/report-button.tsx:20` ("Thanks. We will review it."), `block-button.tsx:18-19` (`window.confirm` then `router.push("/")`), post page "Report this post" at the bottom, student profile and thread "⋯" sheet.
- Report confirms with one grey line: no time ("we read reports within 24 hours" is promised in PRODUCT.md and in the child-safety page), no "you do not need to do anything else", no note that the other person is not told, no pointer to "Block" or to leaving the meet-up if the danger is now.
- Block uses the browser's `confirm()` dialog (fine copy, but unstyled, and in an installed PWA it shows the site's address). After confirm the app drops the student on the feed with no message, so she cannot tell whether it worked; the "Blocked students" page is the only proof.
- The "Report" reason is a `select` ("What is wrong?" / "Choose") with a hidden list; a worried student cannot see "Someone is under 18 and being pressured" or "Asked me to pay first" as choices without opening it. `[INFERENCE]` on exact reason labels (`lib/safety/report.ts:26-34` not read).
Why it matters: someone who feels unsafe is already stressed; every unexplained step reads as "nothing happened" (heuristic 1, 9).
Fix: after Report show a bordered confirmation: "Report sent. The owner reads reports within 24 hours. The other student is not told. If you are in danger now, leave the place and call 911." with a "Block this student" button. After Block go back to the previous screen and show one line at the top of Messages or the feed: "Blocked @name. Undo" for 8 seconds. Replace `window.confirm` with the same bottom-sheet dialog the "⋯" menu already uses (`messages/[id]/thread-menu.tsx`). Show 5 reasons as radio rows, with "Asked me to pay first or leave the app" and "Under 18 or a child at risk" on top.
Command: `$impeccable clarify` and `$impeccable harden`.

### 5. [P2] The bottom nav spends one of five slots on a tab that is empty at launch, and "Me" opens Settings

Where: `src/components/bottom-nav.tsx:7-13`, `perks/page.tsx:89`, `me/settings/page.tsx:75`.
- "Perks" is 20 percent of the primary navigation and shows "No perks near your school yet. Partner shops are being added." for most schools. A new student taps it, finds nothing, and learns the tab is a dead end.
- "Me" goes to `/me/settings`, a list of buttons; the profile (my posts, my reviews, what I sold) is one button deeper. Notifications are only reachable from the bell on the feed header and from Me. `[INFERENCE]` that the bell appears only on Feed (seen on `feed.png`; not checked on other tabs).
- "Create" is the only verb in the bar (it works: it is the filled centre button; keep it).
Why it matters: nav teaches the model of the product; an empty tab misleads it and wastes thumb space (cognitive-load rule of ≤5 and each must carry value).
Fix: show Perks as a tab only when the school has at least one perk, otherwise put "Perks" as a row in Me (same pattern as Transactions). Fourth tab becomes "My posts" (the student's own items, the seller's home screen) or "Activity" with the bell. "Me" opens the profile; Settings is a gear in its header.
Command: `$impeccable layout`.

## Persona Red Flags

### First-year student seller clearing a dorm room ("Casey" and "Jordan" mix: mobile, one-handed, first time)

- Feed: nothing says "you can sell here". The only invitation is the plus in the nav and, on an empty feed, a button. A dorm-clearing student with ten items has to guess that the centre plus is "sell".
- Create a post: photo tile and guidance are good, but after the first post she lands on `/me?tab=...` with no "Your post is live" line (`post-form.tsx:211`) and no "Post another" button, so item two means tapping Create and starting from nothing (P10). Ten items means ten empty forms.
- The type radio reads "I'm selling or giving" on the form, but the feed calls it "Showcase" and her profile tab says "Showcase": she cannot tell that the post she just made is a Showcase.
- Limit: PRODUCT.md says one open Showcase without an ID check; the own-profile cue in the audit says "0 of 20". `[INFERENCE]` The student meets the limit only when the second post fails. Show "1 of 1 free posts used. Add an ID check to post more" on the form before she fills it in.
- The first buyer message is a stranger asking "Is this still available?" with no template reply and no "typically replies" for her; nothing coaches her through replying.

### Cautious buyer (Riley-style edge tester with trust concerns)

- Post page: the seller block is in the right place and the amber notice is there, good. But "School email" is the only trust cue for a new seller; "New" appears in the thread header yet the post screenshot shows no "New" pill or items sold on the post page seller row `[INFERENCE: cut off by the sticky bar in post-calc.png]`.
- Buttons: Message, Make offer, Reserve. Reserve at the asking price from a stranger with no chat is the riskiest tap, yet it is as large as Message. She cannot see what Reserve commits her to without tapping.
- Thread: "locks the reservation" copy (issue 2); no line that says "never move to another app" or "never send money before meeting" appears in the chat itself apart from the card `[INFERENCE: not seen in thread.png]`.
- Report path after a bad meeting: "Report what happened" closes the reservation and tells "the other person" (`payment-steps.tsx:296`); the student is not told whether her report also reaches the owner of the service or goes only to the other student. Unclear who sees her words.

### Parent or guardian worried about a 16 year old

- The 16 and 17 year old consent: the age checkbox and `UNDER_18_NOTICE` are in a long sentence next to Terms (`welcome-form.tsx:93-103`); a guardian reading over the shoulder finds no plain statement on the feed or profile of "Meet in daylight on campus only, 6 AM to 8 PM; the app never handles money; reports are read within 24 hours".
- The 24 hour promise lives only in the Child Safety legal page, which in the installed app is a long page; the in-app Report confirmation does not say it (issue 4).
- Under-18 members are not marked to other members and there is no setting such as "only message students from my school" `[INFERENCE: not found in the files read]`. The 6 AM to 8 PM rule is enforced in the form but not stated on the post page near "Where to meet".
- Sign-in order: email code, password, profile, two separate checkboxes, then the feed. A guardian cannot see the rules before the account exists unless she opens Terms in a new tab (links use `target="_blank"`, which leaves the installed app).

## Minor Observations

- **Bottom bar hides on scroll** (`bottom-nav.tsx:15-35`). On a one-handed phone this removes the nav exactly when the student is browsing; the "Create" button disappears too. Keep it fixed on the feed, hide on long pages only.
- **Thread header chip "2 items"** is not a label for deals; use "2 deals" and show the item thumbnail only when there is one deal.
- **Reservation card still stacks eight blocks** (state pill, next line, button, amber notice, payment, ways to pay, lock line, divider, cancel). Merge "Payment" and "Ways to pay" into one line ("Cash, ₱350").
- **"Philippine time."** appears as a loose line under Available; fold it into the heading ("Available, Philippine time").
- **Search is a link styled as a field**; tapping it opens another screen and keyboard, one tap more than needed. Acceptable, but "Search" as the whole placeholder says nothing; use "Search items, people, schools".
- **Hearts empty state** ("No hearts yet. Tap the heart...") has no button; every other empty state in the app has one.
- **Dates**: "Fri, Oct 23" in the thread (good); the post page still shows "Listed Oct 23 · Expires Nov 22" with no year (good); keep it consistent.
- **Seed titles** such as "Block post zbfcc9c #10" fill the feed screenshot; the screenshots cannot judge real photo, title length or price scanning until the seed uses real items.

## Questions to Consider

- If a student could only learn three words in her first minute, would they be "Sell", "Wanted" and "Deal"? Then why does the nav and the chips teach five different ones?
- Should the first thing a signed-in student sees be the feed, or the one action only this product offers: "Post something from your room in a minute"?
- What does a student need to see before she pays a stranger ₱1,200: the lock rule, the daylight rule, or who else bought from this seller? Which of those is on screen at the moment she taps Reserve?
- A 16 year old and her parent both read "We will review it". What would make them believe it?
- If Perks is empty at every school for the first semester, is it a tab, or a promise you can keep in Settings until it is real?

## First-run plan (onboard)

Impeccable's onboarding rule: get to the aha moment fast, teach through the real product, make everything skippable, no tour. Here the aha moments are (a) "I can see what students at my school have for sale" and (b) "I posted my first item in under a minute". We have no usage numbers (none exist yet), so these are hypotheses to measure with the existing per-student metrics in `principles.md` (time to first listing, listing and message within 7 days).

### The first 60 seconds after sign-up

0 to 10 s, **Welcome step (already exists, small edits).** After the password step the student sees "Welcome to Studiskarte" and the profile form. Keep the form (username, display name, role, consent). Change:
- Show the school the email confirmed: "Your school: Technological University of the Philippines" above the form, so she knows the community she is joining (principle 13).
- Rename "Handle" to "Username"; one example line "e.g. jun.santos".
- Put the 6 AM to 8 PM, no-money, 24-hour-report promises in three short lines on the page, above the checkboxes. This is where a guardian also reads them.
Files: `src/app/welcome/page.tsx`, `src/app/welcome/welcome-form.tsx`, `src/app/welcome/actions.ts` (no behaviour change).

10 to 30 s, **Feed with a first-session strip.** Redirect stays `redirect("/")`. For a member with zero posts and zero conversations, render one non-modal strip above the chips (a card, not an overlay):
- Line: "Hi, {display name}. Selling something or looking for something?"
- Primary button (filled, 48 px): **"Post your first item"** (goes to `/posts/new`). Secondary text link: "Just looking".
- The strip disappears for good the moment she has posted, messaged or tapped "Just looking" (store the dismissal on the account or `localStorage`, as onboard.md suggests; show it once).
- One action only: posting. Browsing already needs no help.
Why posting: PRODUCT.md says first-time sellers dominate, density of listings is the launch problem, and posting is the action no competitor makes this short.
Files: `src/app/(tabs)/page.tsx` (render strip when `me` has no posts and no conversations; needs a `hasStarted(me.id)` query in `src/lib/discovery/` or reuse `getOwnProfile`), a new `src/components/first-run-strip.tsx`.

30 to 60 s, **Create a post.** The form is already short. Add:
- On success, land on the new post (not `/me?tab=`), with one line at the top: "Your post is live. Students at your school can see it now." and two buttons: **"Post another"** (reopens the form with the same type, place and payment pre-filled, P10) and "View feed".
- Show "1 of 1 free posts used. Add an ID check to post more" under the form title for a student with the one-Showcase limit `[INFERENCE: limit text not seen in the form]`.
Files: `src/app/posts/post-form.tsx:211`, `src/app/posts/new/page.tsx`, `src/app/posts/[id]/page.tsx` (banner when `?created=1`).

### Empty states that need one button (and a sentence that says what to do)

| Screen | Now | Change | File |
|---|---|---|---|
| Feed, "My school" with no posts | "No posts match these filters." + Clear filters | "No one at {school} has posted yet. Be the first." Buttons: **Post an item**, All schools | `src/app/(tabs)/page.tsx:90-98` |
| Feed, nothing at all | "Nothing posted yet. Be the first." + Create a post | Keep; add school name | same file, lines 99-103 |
| Hearted | Sentence, no button | Add **Browse the feed** | `src/app/(tabs)/me/hearts/page.tsx:32` |
| Search (blank) | Sentence only (earlier audit: chips fix still open `[INFERENCE]`) | 4 to 6 category chips; tap to search | `src/app/(tabs)/search/page.tsx` |
| Own profile, "Sold 0 / Given free 0" | Count links to empty lists | Plain text until a deal exists | `src/app/u/[handle]/page.tsx` |
| Perks | "No perks near your school yet..." + Browse the feed | Hide the tab until perks exist (issue 5) | `src/components/bottom-nav.tsx`, `src/app/(tabs)/perks/page.tsx` |
| Blocked students | Sentence, fine, nothing to do | Leave as is (no action needed) | n/a |

Messages, Notifications and Transactions already have a sentence and a button; keep them, and rename Transactions to My deals.

### First buyer message (the second aha)

On the post page, the Message button opens the thread with a composer. Add three one-tap openers above the composer on an empty thread: "Is this still available?", "Can I see more photos?", "Can we meet at {place from the post}?". One tap sends; typing stays possible (P5). File: `src/app/messages/new/` (composer) and `src/app/messages/[id]/composer.tsx`.

### What NOT to add

- No product tour, no spotlight walkthrough, no coach marks over the feed (Operate mode: the tool should disappear into the task; 5 tabs are labelled).
- No modal on first load, and no push-permission prompt on first load (P18: ask after the first message or offer, with a reason).
- No multi-step "choose your interests" survey, no avatar-upload step, no bio step before the feed. Bio and picture stay optional (P2) and surface as one line on the own profile when it is empty.
- No badges, streaks, confetti, "complete your profile 40 percent" bars; the product goal is a completed handover, not time in the app.
- No second explanation of safety rules on the feed. The rules sit at the decision points (post payment, reservation card, welcome step); do not repeat them as a banner.
- No sample or fake listings in a real member's feed; no invented activity counts.

### Files that would change, in one list

`src/app/welcome/page.tsx`, `src/app/welcome/welcome-form.tsx`, `src/app/(tabs)/page.tsx`, `src/components/first-run-strip.tsx` (new), `src/lib/discovery/` (one "has this member started" query), `src/app/posts/post-form.tsx`, `src/app/posts/[id]/page.tsx`, `src/app/(tabs)/me/hearts/page.tsx`, `src/components/bottom-nav.tsx`, `src/app/(tabs)/search/page.tsx`, `src/app/messages/[id]/composer.tsx`, plus the term changes in issue 1 (`filter-sheet.tsx`, `u/[handle]/page.tsx`, `(public)/about/page.tsx`, `me/settings/page.tsx`, `lib/deals/rules.ts`, `offer-card.tsx`, `post-card.tsx`) and `docs/design/brand.md` for the glossary.

### Suggested order (Impeccable commands)

1. `$impeccable clarify`: the glossary (issue 1), the reservation lock wording (issue 2), Report and Block confirmations (issue 4).
2. `$impeccable onboard`: welcome step, first-session strip, post-live banner, school empty state (issue 3, plan above).
3. `$impeccable layout`: bottom nav and Me landing (issue 5).
4. `$impeccable distill`: reservation card.
5. `$impeccable polish`: final pass.
