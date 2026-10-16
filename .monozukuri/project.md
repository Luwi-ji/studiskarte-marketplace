# Studiskarte Marketplace

"The marketplace where student hustle meets student needs." Installable app (PWA) for verified students in the Philippines. Students post **Showcase** listings (what they offer) and **Wishlist** items (what they seek), including services, browse and search a feed, message, make offers, meet or arrange delivery to hand over items, and review each other. The system never handles money. No offline use, apart from one static "connection needed" page.

## Actors
Visitor, Student (verified by a code sent to a `.edu.ph` school email; buyer and seller are roles per deal), Admin (the owner, for reports).

## Status
- Stage 1 (business logic): approved, with all changes up to and including expiry, views, follow-first feed, reply time, student categories, services, idle-deal rules, and the static offline page.
- Stage 2 (tech stack): approved, then updated for the static offline page and the added scheduled jobs. The updates only record the owner's decisions.
- Stage 3 (logic-to-stack map): approved for the previous content, and updated for the same decisions. The updates need no new stack pieces.
- Stage 4 (phase plan): approved, 16 phases plus 3 deferred. See `.monozukuri/blueprint/04-phase-plan.md`.
- Phase 1 (walking skeleton): **done 2026-10-16.** Live at https://studiskarte-marketplace.vercel.app (Vercel, Neon `production`, R2 `studiskarte-prod`), CI green. Verified in production: code to a `tup.edu.ph` (Google mail) inbox; sign-in inside the installed iPhone app reaches the feed; sign-in in Samsung Internet on Android; iPhone photo posts stored with no EXIF, XMP or GPS data. Microsoft-mail check waived by the owner (ADR 0004). Follow-up: confirm Samsung Internet offers "Install" on a real Galaxy phone (all of Samsung's documented criteria are met).
- Phase 4 (listing lifecycle): built and deployed 2026-10-16: 30-day expiry job, expired posts hidden at once, relist (edit then relist, counts against the 20 limit), owner-only view counts (once per student per Manila day), unused-photo cleanup, protected jobs endpoint, Vercel daily cron, GitHub Actions 15-minute tick. Owner must add two GitHub secrets (APP_URL, CRON_SECRET) for the tick to pass. Hearts/messages/offers counts and expiry notifications wait for Phases 5, 8, 10, 9.
- Phase 2 (identity completion): built and deployed 2026-10-16 (commit 2b78c19, CI green). Production migrated after a rehearsal on a copy of production. Exit checks verified locally: handles unique ignoring case, school shown by domain until named, no page or payload contains the email (Better Auth HTTP routes removed). `tup.edu.ph` named "Technological University of the Philippines". Waiting for the owner to finish sign-up on the live site.
- Phase 3 (full listing): built and deployed 2026-10-16 (commit 286531e, CI green). Categories confirmed (12 main, 53 sub); limits 20 open posts, 10 photos; prices in whole pesos; places as free text. The 9 Phase 1 test posts and their photos were deleted from production (owner approved). Exit checks verified: every rule refused by the database even when the app is bypassed, a failed photo upload creates nothing, the open-post limit holds under concurrent creates (proven by removing the lock and watching the test fail). Revised 2026-10-16 at the owner's request (commit 54a2063): availability picked by weekday chips or a calendar with a time range for all or per day; delivery includes Grab, Lalamove and similar. This also fixed posting on iPhone (the old date-time field rejected Safari's value). Mobile-first pass shipped the same day (bottom tabs, 44 px targets, sticky Post bar, iOS home-screen metadata, full reload on sign-out). A first post page (swipeable photos, all details, availability, seller; owner gets Edit) was brought forward from Phase 6 at the owner's request; view counting stays in Phase 4, messaging in Phase 8. Owner changes 2026-10-16 (later): no subcategories (12 flat categories; existing posts moved to their main category), optional description per photo (main description stays), Studiskarte logo (app icons, sign-in, feed header, brand blue #0365fc). Waiting for the owner to post from the iPhone.

## Decisions since the feature list
- No payments. "Make offer" is a price proposal. "Buy now" is "Reserve at asking price". Handover and payment happen in person. Both students confirm the handover. Nobody else confirms for them.
- A deal not scheduled within 7 days, or not completed within 7 days after its scheduled time, is cancelled and the post returns to open. Reminders to confirm go out at 1 and 3 days.
- Exchange method is meet-up or delivery (the seller brings it, no courier, no fee). For services, meet-up means doing the work in person, and delivery means handing over finished work. "Scheduled pickups" means scheduled deliveries.
- Notifications cover activity on the student's own posts. No automatic matching.
- Calendar: an .ics file per deal plus a private subscribe link. No Google Calendar API. No lock-screen live calendar (not possible in a PWA).
- Reports: a post reported by 3 different verified students is hidden at once, and goes to the owner's admin queue. The owner has no team. Students are never suspended automatically.
- Listings expire 30 days after listing and must be relisted. Views are counted per student per day, owner-only. The default feed puts followed students' posts first. Profiles show stars and "typically replies within". Categories are two-level, made for students.
- Mobile-first (owner, 2026-10-16): most students use phones. Every page is designed at 360 px first; tap targets at least 44 px; bottom tab bar (Feed, Sell, My posts, Me); safe areas for notch and home bar; iOS home-screen icon and status bar set. Checked by an audit script that measures targets and sideways overflow on every page.
- Services are in the first release.
- One static offline page is stored by the service worker. Nothing else is cached. The service worker and offline page were moved forward into Phase 1 (2026-10-16) because Samsung Internet only installs apps that register a service worker; push alerts stay in Phase 9.
- Societies, Events, and AI listing are recorded as later work, with questions asked when each starts.

## Lessons from Phase 1
- Read env files with Node's own parser (`util.parseEnv`), never by hand: a hand parser sent Vercel a wrong Gmail password.
- A library that swallows errors (Better Auth's send callback) needs its outcome reported back explicitly; never show "sent" without proof.
- One credential per environment: dev and production R2 keys were once the same token.
- Cache Components keeps visited pages alive: forms that create things must clear themselves after success.
- Check what a production failure looks like in the logs before changing code (`vercel logs runtime`).
- A SQL CHECK that evaluates to NULL passes. Wrap nullable columns (`coalesce`) in CHECKs that must fail on missing values.
- A concurrency test proves nothing until it fails without the guard. Remove the lock once and watch it fail.
- A concurrency test proves nothing until it fails without its lock (checked again for relist).
- Fill form fields the way people do (typing, tapping), not by setting values with a script: scripted values hid an iPhone-only failure.
- Tests that share a database must not share counters: Better Auth reports 127.0.0.1 in tests, so per-IP limits leak between runs.

## Owner inputs still needed
- The terms of service, privacy policy, and community guidelines text (including prohibited items and cheating, and a note that services have no payment protection).
- Confirmation of the starter category list.
- A check of student data privacy requirements before launch.

## Accounts and infrastructure
- Sender mailbox: `studiskartemarketplace@gmail.com` (App Password held by the owner, never in the repo).
- Repo: `https://github.com/Luwi-ji/studiskarte-marketplace.git` (public, CI on every push to `main`).
- Hosting: Vercel Hobby (project `studiskarte-marketplace`), Neon Free, Cloudflare R2 (`studiskarte-dev` and `studiskarte-prod`, each with its own bucket-scoped token), GitHub Actions (CI and reminder scheduler). The repo is public.
- Neon branches: `production` (default, empty, never used by tests or local dev) and `dev` (local dev and tests). `.env.local` points at `dev`. Production connection strings are kept outside the repo at `~/.studiskarte/production.env`.
