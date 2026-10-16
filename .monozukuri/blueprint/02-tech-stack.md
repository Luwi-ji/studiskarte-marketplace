# Tech stack — Studiskarte Marketplace

## Summary

| Component | Choice | Stage 1 driver | Why — over what |
| --- | --- | --- | --- |
| Language and runtime | TypeScript on Node.js (current LTS) | all | One language for server and UI, with static types for entity states and the `.edu.ph` rule. Node 24 is already installed here (Observed). Over: Python/Django (two languages once the UI needs rich forms), Go (slower to build forms and pages). |
| Framework | Next.js (App Router), full-stack | Browse, Post, Contact flows | One deployable serves pages and server logic. Server-rendered pages suit phone users. Built-in web app manifest support for the PWA. Over: a separate SPA plus API (two deployables, no stage 1 need), SvelteKit/Remix (no stage 1 reason to prefer them over the more common choice). |
| Datastore | PostgreSQL | invariants (unique pair, one email per account, price ≥ 0), board queries | The invariants are relational and are best enforced by unique, foreign-key, and check constraints. Full-text search is built in. Over: SQLite (single-writer limits on a hosted setup), MongoDB (the invariants have no home in a document store). |
| Data access | Drizzle ORM with SQL migrations | all entities | Schema and constraints live in versioned TypeScript, close to SQL. Over: Prisma (heavier toolchain, no stage 1 need for its extras), raw SQL (no types at call sites). |
| Verification and sessions | Better Auth with the Email OTP plugin | Verify flow, "code" and "proof of receipt" rules | The student types a code, so sign-in finishes inside the installed app. An email link on iOS opens Safari, which has separate storage from the installed PWA (see ADR 0004). We store no passwords. The `.edu.ph` check runs in our own send-code function before any mail goes out. Over: Auth.js (link-based by default), hand-rolled code tables (security-sensitive and easy to get wrong), password sign-up (does not prove school email ownership). |
| Email delivery | Nodemailer sending through Gmail, authenticated with a Google App Password on a dedicated account, behind one `sendMail` function | Verify flow | Google handles sending and the free tier costs nothing. Personal Gmail allows 500 recipients per rolling 24 hours (Nodemailer docs), so about 500 codes a day at most. An App Password has no consent screen and no token that expires, so it avoids the 7-day refresh-token limit that Google applies to OAuth apps in Testing status. Over: Google OAuth 2.0 (Nodemailer recommends it, but Gmail SMTP needs the full-mailbox `https://mail.google.com/` scope, so a leak is no narrower, and it adds a Cloud project and a publishing status to keep healthy), the Gmail API with `gmail.send` (send-only scope, but adds `googleapis` and a Cloud project), Resend and Brevo (lower free quotas, and Resend needs a domain you own). Swappable in one module. |
| Rate limiting and quotas | A Postgres table of recent actions (`rate_limit_event`) | code flood rule, plus upload, report, offer, and message limits | No new service. Counting rows by address, student, and action is enough at this scale. Also feeds the 24-hour Gmail quota counter. Over: Redis (a second datastore with no stage 1 need). |
| Search | PostgreSQL full-text search for posts, `pg_trgm` for handles, names, and schools, plus category, school, condition, price, and date filters | Browse and Search flows | Neon supports `pg_trgm` (Neon extension docs). Typo-tolerant people search needs no extra engine. Over: Elasticsearch or Meilisearch (a second system to run for this size). |
| Messaging delivery | Plain request/response, with a page refresh or interval poll. Offers, deals, and messages share this path. | Contact, Offer, Deal flows | Over: WebSockets or a realtime service (nothing in stage 1 needs sub-second delivery). |
| Image storage | Cloudflare R2, through its S3-compatible API, with short-lived signed links for viewing | required post photos, message pictures, profile pictures | Free tier: 10 GB storage, 1 million writes and 10 million reads a month, free egress (Cloudflare docs). Vercel Blob on Hobby allows only 1 GB, 2,000 write operations a month, and blocks the store for 30 days when exceeded (Vercel docs). Required photos would pass that limit within weeks. Over: Vercel Blob, Neon storage (too small, and images do not belong in the database), Supabase Storage (a second platform with a 1 GB cap [Assumed from memory, unverified]). [Check: R2 may need a payment method on file even for the free tier.] |
| Installable app | Web app manifest (`app/manifest.ts`), icons, standalone display, served over HTTPS | PWA decision | Built into Next.js, so no library. Over: a plugin that generates the manifest (adds a dependency for one file). |
| Alerts and offline page | Web Push through the `web-push` library with VAPID keys, a `push_subscriptions` table in PostgreSQL, and a small service worker with two jobs: show alerts, and show one static offline page | Alerts flow, notification rules, offline edge case | Needs no third-party push vendor. The service worker handles `push` and `notificationclick`. It also stores exactly one static offline page at install and shows it only when a page navigation fails for lack of a connection. It stores no other response, so no private data reaches the device. Test: after browsing signed in, the only cache entry is the offline page. Over: OneSignal or Firebase Cloud Messaging (another vendor and account with no stage 1 need), Serwist or Workbox (caching tools that cache pages, which stage 1 forbids). |
| Image processing | `sharp` on the server, plus a client-side resize before upload | photo and picture rules, privacy | Phone photos carry GPS location in their metadata. Every uploaded image is re-encoded on the server, which strips metadata, checks that it is really an image, and writes a thumbnail. The browser first shrinks it to about 1,600 px, so uploads stay under Vercel Hobby's 4.5 MB request limit. [Check the limit when building.] Over: `next/image` optimization (usage limits on Hobby [unverified]), no processing (leaks locations). |
| Scheduled jobs | A GitHub Actions scheduled workflow every 15 minutes calling a protected endpoint for meet-up and handover reminders. A daily Vercel cron for cleanup, offer, post, and idle-deal expiry, and expiry and review reminders. | meet-up reminders, handover reminders, offer, post, and deal expiry | Vercel Hobby cron runs once a day with up to 59 minutes of drift (Vercel docs), too coarse for "one hour before". GitHub Actions already hosts our CI and is free on a public repo. Over: an external cron service (another vendor), moving to Vercel Pro (not free). The endpoint requires a secret header and is safe to call twice. |
| Calendar export | An iCalendar library (`ical-generator` proposed), a per-deal `.ics` download, and a token-based feed route | calendar rules | The feed must work without a login because Google and Apple Calendar cannot sign in. The link carries a long random token that we store hashed, and the student can regenerate it. Over: Google Calendar API (OAuth app and verification, nothing for iPhone), hand-writing the format (escaping and line-folding bugs). |
| Styling and UI | Tailwind CSS, with native CSS scroll-snap for swipe cards and photo viewers, and the native `<dialog>` for the full-screen viewer and filter sheet | feed, cards, filters, viewer | Fewer dependencies. Hide-on-scroll navigation is a small client component. Over: a component library now (decide later if forms and sheets get complex), carousel libraries (scroll-snap covers the swipe). |
| Admin | A role flag on the student record and `/admin` pages inside the same app | report queue, hidden posts | Only the owner uses it. Over: a separate admin app (no need). |
| Validation | Zod | post rules, `.edu.ph` rule | One schema validates the form and the server. Over: hand-written checks (they drift apart). |
| Tests | Vitest (unit and database integration), Playwright (end-to-end) | invariants, flows | Every business rule and edge case in stage 1 gets a check. Over: Jest (no stage 1 reason). |
| CI | GitHub Actions in `Luwi-ji/studiskarte-marketplace` | all (prove each rule on every change) | Decided by the owner: the repo is on GitHub. Runs typecheck and tests against a PostgreSQL service container, then Playwright. Over: none considered, since the owner chose GitHub. |
| Hosting | Vercel Hobby (free) for the app, deployed from the GitHub repo. Neon Free for PostgreSQL. | all | Decided by the owner: free for now. Both have free tiers with no card needed. Over: a free-tier VPS (more to run and patch). Limits and risks are under Infra and deploy. |

## Runtime
TypeScript on the current Node.js LTS, pinned in `package.json` `engines` when the project is created. Request-driven execution, with no long-running workers. Every stage 1 flow completes inside a single request.

## Framework
Next.js App Router. Pages render on the server. Mutations (post, close, message, request confirmation) go through server actions or route handlers that validate with Zod before touching the database. Access checks (verified, owner, participant) live in one server-side module, never only in the UI.

## Data
PostgreSQL. Constraints carry the stage 1 invariants:
- unique school email per student;
- unique (participant a, participant b) per conversation, stored in fixed order (a before b in byte order, a CHECK);
- check price and budget ≥ 0;
- a post's kind is fixed after creation;
- foreign keys from posts to students, and from messages to conversations.

Schema changes ship as migrations. No cache, since nothing in stage 1 needs one.

## Infra and deploy
Vercel Hobby plus Neon Free, both free for now. Vercel deploys from the GitHub repo, and GitHub Actions runs the checks. Environments: local, preview, production, each with its own database [Assumed: Neon branches serve preview]. Error tracking is not chosen yet. Decided in the release phase.

Observed: the remote `https://github.com/Luwi-ji/studiskarte-marketplace.git` is readable without credentials and has no refs, so it is empty. This directory is not yet a git repository. Nothing is pushed until you say so.

Free-tier risks:
- **Vercel Hobby is for non-commercial, personal use only** (Vercel docs). A marketplace with no fees or ads is probably within that. If it earns money, move to a paid plan. Read Vercel's fair-use page before launch.
- **Neon Free** scales compute to zero after about 5 minutes idle, so the first request after a quiet period is slower. Storage is capped (the Neon pages disagree: 0.5 GB or 1 GB per project; check the current limit). Images do not count, since they go to object storage. Messages, offers, notifications, and reviews are text and should fit for a long time. Track database size from the start.
- **Gmail sending** can be blocked when Google sees a server connecting from an unusual place. Nodemailer's docs say Gmail is not recommended for production, and that App Passwords bypass most of Google's extra security checks, though Google may still block unusual locations. An App Password gives full access to that mailbox, so the sending account must hold nothing else. When the daily quota runs out, code requests fail. The app must say "try again later" and not claim it sent mail.
- **Gmail mitigations** (apply whichever credential is chosen):
  - Use a dedicated Gmail account for the app, with 2-Step Verification, so a block does not lock the owner out of personal mail.
  - Count codes sent in the last 24 hours in PostgreSQL. Log a warning at 400 and show "try again later" at the limit.
  - Exit trigger: switch `sendMail` to Brevo, or to Resend with a domain you own, after one block by Google or when volume passes about 400 codes a day.
  - 30-day sessions keep code volume low.
- **Cloudflare R2** free limits are 10 GB and 1 million writes a month. At roughly 300 KB per photo and three photos per post, 10 GB holds tens of thousands of photos. Track usage monthly. Old photos of withdrawn and deleted posts are deleted, since deletes are free.
- **GitHub Actions schedules** can be delayed under heavy load, and in a public repository they are disabled automatically after 60 days with no repository activity (GitHub docs). Reminders could then stop silently. Mitigation: the reminders endpoint records its last run, and the admin page warns when it is stale.
- **No scheduler means no reminders**, never wrong reminders: each reminder is sent once, and only inside its time window.

## Key libraries
- Better Auth: issues and checks single-use, expiring codes, and manages 30-day sessions. Its documented options cover the attempt limit (`allowedAttempts`), expiry (`expiresIn`), code length (`otpLength`), and one live code per address (`resendStrategy: "rotate"`). Our own `sendVerificationOTP` callback is the only place mail leaves the system. It sends nothing unless the address ends in `.edu.ph` and is under the rate limit. This fails closed: no mail means no code, so a non-school address can never be verified, even through Better Auth's public endpoint. Phase 1 exit checks are in ADR 0004.
- Zod: input validation at every boundary.
- Drizzle ORM and drizzle-kit: schema and migrations.
- Nodemailer: sends the mail. Authenticates to Gmail as `studiskartemarketplace@gmail.com` (the dedicated account, 2-Step Verification on, App Password generated by the owner) with the App Password held only in an environment variable, never committed. Rotating it means generating a new App Password and revoking the old one.
- web-push: signs and sends Web Push messages with the VAPID keys. Alert text carries only the post title, never the message text. A push service reply that says the subscription is gone removes that row.
- sharp: re-encodes images, strips metadata, and writes thumbnails.
- AWS SDK S3 client (`@aws-sdk/client-s3`): talks to R2. Signs the short-lived viewing links.
- ical-generator (proposed): writes the calendar files and the feed.
- Tailwind CSS: styling.
- Vitest and Playwright: tests.

## Rejected alternatives
- Separate frontend and API: two deployables with no stage 1 need.
- Realtime messaging service: nothing needs it.
- Redis, Elasticsearch, a message queue: no stage 1 element needs them.
- Payments provider: stage 1 says the system never moves money.
- Verification by studiskarte image upload: the user chose school email only.
- Error tracker: not driven yet. Decided in the release phase.
- Offline caching of pages, boards, or conversations (Serwist, Workbox, cached boards): stage 1 says no offline use and no private data on the device. Only one static offline page is stored.
- Auth.js with emailed links: the link cannot finish sign-in inside an installed iOS PWA. Superseded by ADR 0004.
- Resend, Brevo, or the Gmail API with `gmail.send`: not needed now. They are the exit path if Google blocks sending or the quota proves too low.
- Vercel Blob: 2,000 write operations a month on Hobby, and the store is blocked for 30 days when exceeded. Superseded by R2.
- Vercel cron alone for reminders: runs once a day on Hobby, with drift up to an hour.
- Google Calendar API sync and lock-screen live calendar: the first needs a Google OAuth app and does nothing for iPhone, and the second needs a native app. Replaced by `.ics` files, a subscribe link, and reminder alerts.
- Societies, Events, AI listing: no component chosen. Each is decided when its phase starts. AI listing needs a model provider decision, plus a check that sending student photos to a third party fits the privacy policy.

## ADRs raised
- `.monozukuri/decisions/0001-nextjs-typescript-fullstack.md` — one full-stack TypeScript application.
- `.monozukuri/decisions/0002-postgresql-datastore.md` — PostgreSQL carries the business invariants.
- `.monozukuri/decisions/0003-school-email-passwordless-verification.md` — superseded by ADR 0004.
- `.monozukuri/decisions/0004-school-email-code-verification.md` — verification by an emailed single-use code, restricted to `.edu.ph`, using Better Auth.
