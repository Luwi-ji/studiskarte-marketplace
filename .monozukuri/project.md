# Studiskarte Marketplace

"The marketplace where student hustle meets student needs." Installable app (PWA) for verified students in the Philippines. Students post **Showcase** listings (what they offer) and **Wishlist** items (what they seek), including services, browse and search a feed, message, make offers, meet or arrange delivery to hand over items, and review each other. The system never handles money. No offline use, apart from one static "connection needed" page.

## Actors
Visitor, Student (verified by a code sent to a `.edu.ph` school email; buyer and seller are roles per deal), Admin (the owner, for reports).

## Status
- Stage 1 (business logic): approved, with all changes up to and including expiry, views, follow-first feed, reply time, student categories, services, idle-deal rules, and the static offline page.
- Stage 2 (tech stack): approved, then updated for the static offline page and the added scheduled jobs. The updates only record the owner's decisions.
- Stage 3 (logic-to-stack map): approved for the previous content, and updated for the same decisions. The updates need no new stack pieces.
- Stage 4 (phase plan): approved, 16 phases plus 3 deferred. See `.monozukuri/blueprint/04-phase-plan.md`.
- Phase 1 (walking skeleton): deployed at https://studiskarte-marketplace.vercel.app (Vercel, Neon `production`, R2 `studiskarte-prod`); CI green. Verified in production: a code reached the `tup.edu.ph` (Google mail) inbox and signed in; the owner posted two photos, stored with no EXIF, XMP or GPS data. The owner waived the Microsoft-mail inbox check (ADR 0004). **Not yet done:** posting and sign-in inside an installed iPhone and Android app. Phase 1 stays open until those pass.

## Decisions since the feature list
- No payments. "Make offer" is a price proposal. "Buy now" is "Reserve at asking price". Handover and payment happen in person. Both students confirm the handover. Nobody else confirms for them.
- A deal not scheduled within 7 days, or not completed within 7 days after its scheduled time, is cancelled and the post returns to open. Reminders to confirm go out at 1 and 3 days.
- Exchange method is meet-up or delivery (the seller brings it, no courier, no fee). For services, meet-up means doing the work in person, and delivery means handing over finished work. "Scheduled pickups" means scheduled deliveries.
- Notifications cover activity on the student's own posts. No automatic matching.
- Calendar: an .ics file per deal plus a private subscribe link. No Google Calendar API. No lock-screen live calendar (not possible in a PWA).
- Reports: a post reported by 3 different verified students is hidden at once, and goes to the owner's admin queue. The owner has no team. Students are never suspended automatically.
- Listings expire 30 days after listing and must be relisted. Views are counted per student per day, owner-only. The default feed puts followed students' posts first. Profiles show stars and "typically replies within". Categories are two-level, made for students.
- Services are in the first release.
- One static offline page is stored by the service worker. Nothing else is cached.
- Societies, Events, and AI listing are recorded as later work, with questions asked when each starts.

## Owner inputs still needed
- The terms of service, privacy policy, and community guidelines text (including prohibited items and cheating, and a note that services have no payment protection).
- Confirmation of the starter category list.
- A check of student data privacy requirements before launch.

## Accounts and infrastructure
- Sender mailbox: `studiskartemarketplace@gmail.com` (App Password held by the owner, never in the repo).
- Repo: `https://github.com/Luwi-ji/studiskarte-marketplace.git` (public, CI on every push to `main`).
- Hosting: Vercel Hobby (project `studiskarte-marketplace`), Neon Free, Cloudflare R2 (`studiskarte-dev` and `studiskarte-prod`, each with its own bucket-scoped token), GitHub Actions (CI and reminder scheduler). The repo is public.
- Neon branches: `production` (default, empty, never used by tests or local dev) and `dev` (local dev and tests). `.env.local` points at `dev`. Production connection strings are kept outside the repo at `~/.studiskarte/production.env`.
