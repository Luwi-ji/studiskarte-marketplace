# Design principles for Studiskarte

Every rule below comes from the research in `docs/design/research/` (`evidence.md` = E, `teardown.md` = T, `philippines.md` = P). E and P numbers are the numbered findings and design implications at the end of those files. T numbers are rows of the pattern table in teardown section 10; "T11" in running text means section 11 (patterns that differ). Ratings follow the research: **strong** (study or first-party data), **medium** (credible practitioner analysis), **weak** (anecdote or vendor claim). A rule marked **measure** is a hypothesis to check with the numbers listed at the end, not a settled fact.

Studiskarte is chat-led, has no money, and its peers are Facebook Marketplace and Carousell Philippines, not Vinted or Depop (T section 1). Where those escrow apps' patterns do not transfer, we do not copy them.

## What people trust, and what that asks of the screens

1. **The person comes first.** On a chat-led marketplace the seller is the product: Carousell and Depop put the seller card next to the photo (T11 table, "Where trust cues live"; T7). Post page and thread header show: school, stars with the **count**, items sold, "typically replies within", badge state. Stars alone separate little because most ratings are 4.5 or higher; count and items sold carry the signal (E1, strong; E5, medium).
2. **A new seller shows "New", not empty stars.** Plus a short bio prompt (one or two lines: course, year, what you sell or look for). A short bio moves trust a lot and the effect flattens after about 100 words (E3, strong for perceived trust). A profile photo is optional, never required: people hide faces and names for safety (E3).
3. **Verification shows the fact, not the data.** "School email checked", later "ID checked", as a second, optional level; never ask for more personal data than the step needs (E4, medium; P15, P16, P20, strong for the law). The badge ladder is Carousell's: not verified, verified, plus the role (T26).
4. **Reviews stay tied to completed deals and cannot be edited** (E2, T16, T19). Open question, **measure**: reveal both reviews together instead of at once, which cut retaliation in an Airbnb experiment (E2, strong, but Airbnb) and is what Carousell does (T11). No auto-reviews, no paid reviews (E2, T11, T18).
5. **Reply speed is a visible habit.** Keep "typically replies within"; add one-tap opening messages ("Is this still available?") to cure the empty chat (E5; T21).
6. **Keep everything in the app and make leaving look suspicious.** One thread holds chat, offers, handover and reviews; warn when someone asks to move to another app (E9, medium; T22).

## Making a listing

7. **The shortest listing is one photo, a title, a price (or free or negotiable) and a category.** Everything else has a safe default or comes later (E7, **measure** time to first listing; vendor claims of 30 seconds are weak). P21: first-time sellers dominate, so posting must stay under a minute.
8. **Guide the photo, do not chase the count.** Real photos only, daylight, show defects, first photo shows the whole item (E6, strong; T11). Show the size of an image before it uploads and keep resizing in the browser: data is prepaid (P3, weak, **measure**).
9. **Condition is a short fixed list with a one-line definition each** (T9). Category-specific fields for textbooks and services (T10).
10. **A "post another like this" shortcut** for the student clearing a dorm room (T15).
11. **Free is a first-class option** and so are textbooks and uniforms (P7).

## Finding and choosing

12. **Photo grid, price on the card, search plus a filter sheet** (T2, T3): already built. Next, in order of evidence: saved searches (T4, four apps), a counter-offer (T13: the one common feature Studiskarte lacks), a "post age" cue (T14).
13. **Density beats size.** Default to the student's own school, keep the school filter visible, and launch campus by campus (E8, medium, **measure**).
14. **Seasonal shelves come from each school's own calendar** (start-of-term textbooks, end-of-term clear-outs) (P6, strong for the calendar facts).

## Meeting and handing over

15. **The handover form is the safety feature.** Meet-ups only 6:00 AM to 8:00 PM (done), suggested public places per school, a "share this plan" action using the phone's share sheet, a note for late hours (E12, medium; T23). No Philippine source says which places students use, so the school's own list comes from the school (P13, weak).
16. **The non-delivery scam is the main scam**: about 86% of 2024 consumer-fraud complaints were goods paid for and never delivered (P11). Copy says: do not pay before the handover is agreed. On the payee side, "check your GCash Transactions tab, not a screenshot" appears exactly when they tap "Payment received" (P9, strong).
17. **Cash at the meet-up stays a first-class payment** (P10, medium).

## Notifications and returning

18. **The in-app list is the primary channel; push is a bonus.** iPhone push works only for Home Screen installs after a tap (P4, E10, strong). Ask for push after the first message sent or offer made, with a reason, never on first load (E10, medium, **measure**).
19. **Retention is trust and repeat deals**, not engagement tricks (E11, medium). Design so one student is both buyer and seller. Evening reminders (P5, medium); a listing nudge in the afternoon.

## Look and feel

20. **Mobile first at 360 px for an Android phone with 2 GB of RAM** (P2). Tap targets 44 px or more, primary actions largest, destructive actions apart from confirming ones (E13, strong). Budget for the slow tail, not the median; reserve image space; small thumbnails (E14, **measure** p75 on a real phone).
21. **English for navigation, buttons, errors and anything legal; a light Taglish voice only in low-stakes moments** such as greetings and empty states, and test it with students first (P14: plain language is a legal duty for privacy notices, strong; the Taglish advice itself is weak).

## Privacy that the design must respect

22. **Consent is separate, specific and as easy to withdraw as to give.** Push, perk sharing with partners and analytics are separate switches, never bundled into terms (P17, P18, strong).
23. **Any ID or selfie step is built around deletion**: a notice on the capture screen (purpose, who sees it, how long, how to withdraw), only a pass or fail flag kept, the image deleted after the check, never requested over chat (P16, strong).
24. **Decide the under-18 position before roles ship** (P19, strong that NPC is focused here).

## What to measure after launch (from E section 10)

Per school: active listings, share of listings with a message within 48 hours, share reserved within 30 days, time to first reservation. Per new student: time to first listing, listing and message within 7 days. Trust: reply rate with and without bio, badge, reviews. Safety: handovers at suggested places, share-plan use, cancellations and reports by hour. Notifications: opt-in by moment, alerts in week one, 30-day retention. Performance: p75 load and interaction time on a mid-range Android.
