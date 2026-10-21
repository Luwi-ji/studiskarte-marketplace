# Admin dashboard plan

Last updated 2026-10-22. Owner only (`student.is_admin`, set by `npm run admin:set`; never by the app). Phone first, free tier, no new service.

## Goal

One place for the owner to answer, in a minute a day: is the app healthy, is anyone in danger or being scammed, and is it growing in the way the app is for (students trading with students, safely).

## State: built, uncommitted, type-checks (2026-10-22)

| Tab | What it shows | Code |
| --- | --- | --- |
| Overview | New accounts per day and by role/status; listings per day by kind; conversations, offers, reservations, completed deals, reviews; reply and completion ratios; top lists; period 7/30/90 days, Manila time | `src/app/admin/page.tsx`, `src/lib/admin/overview.ts`, `series.ts` |
| Moderation | Posts to review (hidden first), students reported, suspended students; restore, remove, suspend, dismiss | `src/app/admin/moderation/page.tsx`, `src/lib/safety/admin.ts` |
| Users | Search by handle/name, paged list with role, status, verification | `src/app/admin/users/page.tsx`, `src/lib/admin/users.ts` |
| System | Free-tier limits (mail per day, photo storage, database), scheduled-job health, legal version in force, links to Sentry/Vercel/Neon/Cloudflare | `src/app/admin/system/page.tsx`, `src/lib/admin/system.ts` |

Each query module has a test file in `src/lib/admin/` (they use the dev database).

## Added with the child safety work (2026-10-22)

- Report reason "A child is being harmed, or sexual content involving someone under 18" (`child_safety`, migration 0032).
- One child safety report hides the post at once (other reasons need three reporters).
- Moderation queue puts anything with an open child safety report first, above hidden posts.

## Gaps, in the order to build

1. ~~Report alert~~ Built 2026-10-22 for child safety reports: email to `CHILD_SAFETY_ALERT_EMAIL` or the support address. Other reports still need the owner to open the tab.
2. ~~Reason and note on admin actions~~ Built 2026-10-22 (migration 0033, `admin_action`): every decision is recorded with who, what, target and reason; removing a post and suspending a person require a reason; the reason is shown to the poster in their notification for a removal or restore; "Recent decisions" lists the last 20 on the Moderation tab. A suspended person is still only signed out, with no message.
3. ~~Reservation disputes~~ Built 2026-10-22: "Deal problems" section on Moderation, disputed first then oldest, with both handles and each report. Read only: no action buttons yet (the owner messages the members or acts on the post or person).
4. **Child safety evidence log.** For a confirmed case: record the date, the report ids, what was removed, which authority was told and the reference. Keep it out of the member-facing tables; preserve the data (no deletion on account deletion for these rows).
5. **ID verification queue** (when it opens): pending requests, open the image (every view logged), approve/reject with reason, delete the picture at decision.
6. **Rights requests log**: access, correction, erasure, objection requests by email, due date from the response time the lawyer sets.
7. **Notices from authorities and takedown notices** received by email: date, sender, what, action, time to act (Internet Transactions Act and RA 11930 time limits are `[to confirm]` in `docs/legal-drafts/ph-law-research.md`).
8. **Growth views once there are real users**: signups to first message, first listing to first reply, school by school, weekly returning members. Add only when a number is asked for twice.

## Rules for the dashboard

- Read-only pages never show an email address or a message body. Moderation shows only what the decision needs.
- Every write is a server action that re-checks `isAdmin` and is rate limited.
- No new tracking of members for the dashboard: it only counts rows the app already keeps.
- Keep it on the free tier: queries are counts over indexed columns, one request per page.

## Decisions for the owner

- Where child safety alerts go (email is the default; push needs the admin to enable alerts).
- Whether the admin account is also a normal member account (today yes). A second, admin-only account avoids mixing roles.
- Who covers when the owner is away: the standards promise 24 hours.
