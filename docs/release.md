# Release: checklist, rollback, backup and restore

Last reviewed 2026-10-20. Production is https://studiskarte.com (Vercel Hobby, Neon `production` branch, Cloudflare R2 `studiskarte-prod`, mail by SMTP: Resend).

## Before the app is opened to real students

Items marked **Owner** cannot be done in code.

| # | Item | Who | State |
| --- | --- | --- | --- |
| 1 | Write the Terms of Service, Privacy Policy and Community Guidelines (they must cover: prohibited items such as past exams, answer keys, school IDs and medicine; food and housing listings; that paying a stranger for a service has no protection because the app never moves money; meeting strangers; minors). Save them as `content/legal/terms.md`, `privacy.md`, `guidelines.md`, and put a version such as `2026-11-01` in `content/legal/VERSION` (one word, no spaces). Deploy. | **Owner** | Open. Until all four files exist the legal pages answer 404, the sign-up checkbox does not appear and nobody is asked to accept anything. |
| 2 | Check the Data Privacy Act side with someone qualified: consent, retention, whether students may be minors, what the privacy policy must say about the data in the tables below. | **Owner** | Open. |
| 3 | Error tracking: Sentry (free tier), errors only, no tracing or replay, no personal data (`src/lib/sentry-options.ts` removes identity, cookies, headers, bodies, query strings and email addresses; tested in `sentry-options.test.ts`). Sending turns on only in a production build with `NEXT_PUBLIC_SENTRY_DSN` set in Vercel (it is public by design; redeploy after setting it). Source maps are not uploaded, so browser stack traces are minified; add `SENTRY_AUTH_TOKEN` and `withSentryConfig` later if that hurts. Add Sentry to the Privacy Policy before relying on it. | **Owner** sets the DSN | Code done; open until the DSN is set and a test error is seen in Sentry. |
| 4 | In the Cloudflare dashboard confirm the `studiskarte-prod` bucket has no public access and no `r2.dev` domain (photos must only be reachable through signed links). | **Owner** | Open (the code cannot show it). |
| 5 | In GitHub: repository secrets `APP_URL` and `CRON_SECRET` set (the Scheduled jobs workflow fails loudly when they are missing). | **Owner** | Present: the workflow has been running. |
| 6 | Mail: Resend over SMTP. Set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASSWORD` (a Resend API key limited to sending), `MAIL_FROM=support@studiskarte.com` in Vercel, with `studiskarte.com` verified in Resend (SPF, DKIM, DMARC records in Cloudflare, DNS only). Resend Free allows 100 emails a day and 3,000 a month: the app stops at 96 a day. After moving to Pro, set `MAIL_DAILY_LIMIT` (the app has no monthly counter). Replies reach the owner through Cloudflare Email Routing. | **Owner** | Done 2026-10-20: a reset code arrived from support@. |
| 7 | Run `node scripts/load-check.mjs https://studiskarte.com` after the last deploy. 2026-10-23 result: 200 requests, 20 at a time, no failures; `/sign-in` p50 335 ms, p95 2.6 s; `/api/health/db` p50 289 ms, p95 2.4 s. Earlier, 2026-10-18 result: 200 requests, 20 at a time, no failures; `/sign-in` p50 298 ms, p95 2.3 s; `/api/health/db` p50 280 ms, p95 1.3 s. | Anyone | Done once; repeat. |
| 8 | Restore drill (below). | Anyone | Done 2026-10-18. |
| 10 | Sign-in with Google: create an OAuth client in Google Cloud (authorised redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`), set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel. Without them the button is hidden. Not tested against Google (no credentials in the repo); try it with a gmail.com account and a school Google account, since a school admin may block outside apps. | **Owner** | Open. |
| 11 | `ALLOW_VISITORS`: leave unset until the visitor rules and mail provider switch are built (docs/roles-and-verification-plan.md). Unset means only school emails can sign up. | **Owner** | Off. |
| 12 | Accounts made before 2026-10-19 have no password: tell them to use **Forgot password** once. Migration 0028 (make a `pre-password-login` branch first). | Whoever deploys | Open. |
| 13 | ID checks (built 2026-10-22, off until `R2_ID_BUCKET` is set). Create a second R2 bucket (for example `studiskarte-id-prod`) with no public access and no `r2.dev` domain; set `R2_ID_BUCKET` in Vercel (optionally `R2_ID_ACCESS_KEY_ID` and `R2_ID_SECRET_ACCESS_KEY` for a token limited to that bucket; otherwise the photo token must cover it). Turning it on also switches on the one-open-showcase limit for members without a current ID check. Do not turn it on before the lawyer has reviewed the consent text and the ID section of the Privacy Policy is published (migrations 0034 and 0035 first). The daily `expire-id-checks` job deletes pictures of checks open for 7 days. | **Owner** | Built, off. |
| 9 | Make a Neon branch before each production migration: `npx neonctl branches create --project-id late-dew-47090405 --name pre-<change>`. Older ones are `pre-pair-conversations` and `pre-perks-reviews`. | Whoever deploys | Habit. |

Personal data the app holds (for the privacy review): school email, handle, display name, profile picture, school domain, sessions (IP address and browser), device alert subscriptions, messages and message pictures, post photos, offers, reservations, reviews, reports and blocks, calendar link hash, the terms version and time accepted. Account deletion (Settings, Delete my account) erases the email, handle, name, picture, sessions, devices, notifications, follows, hearts, blocks and view history; messages, finished reservations and reviews stay as "Deleted account". Post photos and message pictures are not erased.

## What watches production

| Signal | How it reaches the owner |
| --- | --- |
| A scheduled job stopped running | The `Scheduled jobs` GitHub workflow runs every 15 minutes, reads `stale` from `/api/jobs/run` and fails; GitHub emails the repository owner. |
| Mail 80% of `MAIL_DAILY_LIMIT` in 24 hours, photo storage 80% of 10 GB, database 80% of 0.5 GB | The same workflow, once a day at 01:17 UTC, runs the `health` job and fails with the warning text. The tests are in `src/lib/jobs/health.test.ts`. |
| Deploy or CI failure | GitHub and Vercel emails. |
| Errors in server code and in browsers | Sentry, once `NEXT_PUBLIC_SENTRY_DSN` is set (item 3). Vercel runtime logs only for about an hour. |

## Security review (2026-10-18)

No critical or high findings. Fixed in this phase: addresses with `+tag`, `%` or `!` in the local part are refused (one mailbox could make unlimited accounts and escape a suspension); push addresses must be a known push service and a send times out after 10 seconds (it was an open call from the server to any host, and one never-answering address could stall every job); old rate-limit rows are purged daily (nothing deleted them, so sign-in attempts could fill the free database); every page now sends frame-ancestors none, nosniff, a referrer policy and a permissions policy; `/api/health/db` no longer returns the database name or time; display names cannot be staff-like words ("Admin", "Support", anything with "studiskarte") and lose bidirectional and zero-width characters; a student can send 20 reports an hour.

Known and accepted for now:

- Anyone can use up a named student's sign-in tries (3 codes per 15 minutes per address) from one network; a sign-in code is also an email to that address. Cloudflare Turnstile in front of the sign-in form would close it; not added.
- Hearts, follows, blocks and search have no per-student throttle. Messages, offers, uploads and now reports do.
- Failed handover and payment actions show the database error code to the person who tapped (added on purpose on 2026-10-17 to diagnose an iPhone problem). Remove the `(code: …)` text in `src/app/deals/actions.ts` once that is solved.
- The sign-in network limit trusts the `x-forwarded-for` header Vercel sets.

## Rollback

**A bad deploy (code only).** Vercel dashboard, Deployments, pick the last good one, Promote to Production; or `npx vercel rollback <deployment url>`. Takes seconds and does not touch the database. Then `git revert` the commit on `main` so the next push does not bring it back.

**A bad migration.** Migrations only move forward (`src/db/migrations/`); there are no down scripts. Two ways out, in this order:

1. Fix forward with a new migration if the damage is small and the data is intact.
2. Restore the data (below) to the `pre-<change>` branch or to a time just before the migration, then roll the code back as above. Code and schema must match: do not leave new code on an old schema or the reverse.

Every migration so far only adds (tables, columns, constraints), so the previous code keeps working against the newer schema. That is a deliberate rule for the next ones too: add first, deploy, remove later.

## Backup and restore

Neon keeps the history of the `production` branch for **6 hours** on this plan (point-in-time restore), and the named `pre-*` branches are full copies. Photos live in R2 and are not versioned; the app never deletes a photo that a post or message uses.

**Restore drill, done 2026-10-18** (no change to production):

1. `npx neonctl branches create --project-id late-dew-47090405 --name restore-drill --parent 2026-10-18T10:47:00Z` (one hour earlier; the parent is the default branch, `production`).
2. Connect to it (`npx neonctl connection-string restore-drill --project-id late-dew-47090405 --database-name neondb`) and count rows: students 2, posts 23, deals 42, conversations 1, messages 72, reviews 1, migrations 27. The same counts as production at that moment.
3. `npx neonctl branches delete restore-drill --project-id late-dew-47090405`.

**Real restore of production** (stop the app's writes first: put the previous deployment back, or accept that writes made after the restore point are lost):

```
npx neonctl branches restore production ^self@<timestamp, UTC, within the last 6 hours> --project-id late-dew-47090405 --preserve-under-name production-before-restore
```

or from a named branch: `npx neonctl branches restore production pre-<change> --project-id late-dew-47090405 --preserve-under-name production-before-restore`. The old state stays as `production-before-restore`; delete it when sure. The connection strings do not change. Afterwards: `node scripts/db-check.mjs` with the production env file, open the app, and check that the scheduled jobs workflow goes green.

Beyond 6 hours there is no automatic copy. A weekly `pg_dump` of production to a place outside Neon would be the next step if the data starts to matter more than a restart would cost.

## Deploy steps

1. `npm run typecheck`, `npm run lint`, and the tests for what changed (the full suite takes over an hour against the remote dev database; CI runs all of it against a local PostgreSQL in a few minutes).
2. If there is a migration: make the `pre-<change>` branch, then `node --env-file=%USERPROFILE%\.studiskarte\production.env node_modules/drizzle-kit/bin.cjs migrate`.
3. `git push origin main`. CI runs; Vercel deploys the push.
4. Check `/api/version`, sign in, open the changed page. After adding a scheduled job, call `/api/jobs/run?job=<name>` once with the bearer secret so the workflow does not report it as never run.