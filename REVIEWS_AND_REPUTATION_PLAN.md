# Phase 13: Reviews and reputation (+ two small carry-overs)

## Context
Repo `C:/Users/lowel/studiskarte-marketplace` (Next.js 16 per AGENTS.md: if you use a Next API you have not used in this repo, read `node_modules/next/dist/docs/` first; Drizzle + Postgres on Neon; vitest). Blueprint phase 13 (`.monozukuri/blueprint/04-phase-plan.md` lines 113-120): after a completed deal each student reviews the other once; profiles show stars, items sold / granted / (own profile: bought) and "typically replies within"; the post page shows the poster's stars. Nothing for reviews exists yet (grep of `src` for review / response-time / reputation finds only unrelated strings). Two leftovers from the last phase ride along in the same migration: declining a proposed time tells the proposer nothing, and the `post_expired` headline does not mention the 7-day auto-delete.

Facts the steps rely on (all read this session):
- `deal` columns: `id, postId, offerId, ownerId, responderId, amount (per unit, 0 = free), quantity, status ('agreed'|'scheduled'|'completed'|'cancelled'|'disputed'), updatedAt, activityAt`. No `completed_at`. A completed deal is final (trigger `deal_status_path`) and no code updates it afterwards, so `deal.updated_at` is its completion time.
- Roles come from the post: showcase -> owner hands over (seller), responder pays (buyer); wishlist -> responder supplies (seller), owner pays and receives (buyer). Seller id in SQL: `case when post.kind = 'wishlist' then deal.responder_id else deal.owner_id end`.
- Latest migration is `0023_handover_rejected` (journal idx 23). Migration pattern for the notification CHECK: see `src/db/migrations/0023_handover_rejected.sql` (DROP CONSTRAINT then ADD CONSTRAINT with the full list). Hand-written triggers live in migration SQL files (`CREATE FUNCTION ... RETURNS trigger AS $$ ... RAISE EXCEPTION '...' USING ERRCODE = 'check_violation'; $$ LANGUAGE plpgsql;` then `--> statement-breakpoint` then `CREATE TRIGGER`), see `0019_secure_slot.sql`.
- Notification mechanics: types in `src/db/schema.ts` CHECK `notification_type` (line ~482), `NOTIFICATION_TYPES` and `HEADLINE` in `src/lib/notifications/text.ts` (HEADLINE is a `Record` over all non-message/heart types so the compiler forces an entry), `DealNoticeType` in `src/lib/notifications/record.ts`. Types starting `deal_` link to `/messages/<conversationId>` via `notificationHref`.
- `tellOther(tx, found, actorId, type, key)` in `src/lib/deals/schedule.ts` (line ~30) notifies the other party; `answerProposal` (same file, decline branch builds `cleared` and returns without notifying).
- Shell gotcha: the shell has `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH` set to PRODUCTION. Prefix EVERY vitest / tsx / drizzle / next command that touches a DB with `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u NEON_BRANCH` (then `.env.local`, the dev DB, is used).

## Approach

### 1. Schema and migration 0024 (do first; everything else depends on it)
Edit `src/db/schema.ts`:
- Add table `review` (place it after `dealReport`), columns: `id uuid pk defaultRandom`, `dealId uuid notNull references(() => deal.id, { onDelete: "cascade" })`, `reviewerId text notNull references(() => student.id)`, `revieweeId text notNull references(() => student.id)`, `rating smallint notNull`, `text text` (nullable), `createdAt timestamptz notNull defaultNow`.
- Constraints in the table's array: `check("review_rating", sql\`${t.rating} between 1 and 5\`)`, `check("review_text", sql\`${t.text} is null or char_length(btrim(${t.text})) between 1 and 500\`)`, `check("review_distinct_people", sql\`${t.reviewerId} <> ${t.revieweeId}\`)`, `unique("review_one_each").on(t.dealId, t.reviewerId)`, `index("review_reviewee_idx").on(t.revieweeId, t.createdAt.desc())`.
- In the `notification_type` CHECK add `'deal_review_reminder'` and `'deal_proposal_declined'` (after `'deal_handover_rejected'`).
Run (repo root): `npx drizzle-kit generate --name=reviews`. Expected: one new table + the CHECK swap, no rename prompt. If it fails with "Interactive prompts require a TTY", a prompt appeared because a column was added and dropped in the same diff: re-check that you changed nothing else in `schema.ts`.
Append to the generated `src/db/migrations/0024_reviews.sql` (hand-written, after the generated statements, each separated by `--> statement-breakpoint`):
- Function `review_rules()` BEFORE INSERT on `review`: select the deal row; raise `check_violation` 'A review needs a completed deal.' if `status <> 'completed'`; raise 'Only the two people of the deal can review each other.' unless (`NEW.reviewer_id` = owner_id and `NEW.reviewee_id` = responder_id) or (reviewer = responder_id and reviewee = owner_id).
- Function `review_frozen()` BEFORE UPDATE on `review`: always `RAISE EXCEPTION 'A review cannot be changed.' USING ERRCODE = 'check_violation'`. (No DELETE trigger: deleting a deal/post cascades to its reviews, which test cleanup and Phase 15 need. No code path deletes a review.)
Apply to dev: `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u NEON_BRANCH node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate`; expect "migrations applied successfully".

### 2. Notification types and the two carry-overs
- `src/lib/notifications/record.ts`: add `"deal_review_reminder" | "deal_proposal_declined"` to `DealNoticeType`.
- `src/lib/notifications/text.ts`: add both to `NOTIFICATION_TYPES` and `HEADLINE`: `deal_review_reminder: "How did it go? Rate the other student"`, `deal_proposal_declined: "Your proposed time and place was declined"`. Change the existing `post_expired` HEADLINE value to `"Your post expired. Relist it within 7 days or it is deleted"` (read the current string first and keep the same punctuation style as its neighbours).
- `src/lib/deals/schedule.ts` `answerProposal`: in the decline branch (`!args.agree`), after the `cleared` update, call `recorded = await tellOther(tx, found, args.actorId, "deal_proposal_declined", \`declined:${now.getTime()}\`)` exactly like the agree branch does with `recorded`, so the alert fires after commit. Reuse the existing `recorded`/alert plumbing in that function; no new helper.
- Existing test `src/lib/deals/handover.test.ts` line ~287 asserts the owner gets no `deal_proposed` after a decline; keep it (the proposer now gets `deal_proposal_declined`, a different type). Add one assertion in `src/lib/deals/handshake.test.ts` (new `it` in the `describe` about notices): proposer proposes, other declines -> `noticesFor(proposer)` equals `["deal_proposal_declined"]`.

### 3. Reputation queries: `src/lib/deals/stats.ts` (new; no equivalent exists)
```ts
export type Reputation = { rating: { average: number; count: number } | null; sold: number; granted: number; bought: number };
export async function getReputation(studentId: string): Promise<Reputation>;
export type ReviewItem = { id: string; rating: number; text: string | null; createdAt: Date; postTitle: string; reviewerName: string };
export async function listReviews(revieweeId: string, limit = 20): Promise<ReviewItem[]>;
```
- `getReputation`: two `getDb()` queries (counts are queries, never stored).
  - Reviews: `select count(*)::int, avg(rating)::float from review where reviewee_id = $1`; `rating = count === 0 ? null : { average: avg, count }` (callers round to one decimal for display).
  - Deals: `select` from `deal join post on post.id = deal.post_id where deal.status = 'completed' and (deal.owner_id = $1 or deal.responder_id = $1)`, with `coalesce(sum(deal.quantity) filter (where <seller = $1> and deal.amount > 0), 0)::int as sold`, same with `deal.amount = 0` as `granted`, and `... filter (where <buyer = $1> and deal.amount > 0)` as `bought`. Seller = `case when post.kind = 'wishlist' then deal.responder_id else deal.owner_id end`; buyer = `case when post.kind = 'wishlist' then deal.owner_id else deal.responder_id end`. Items are counted as units (`sum(quantity)`). A free deal gives the buyer no "bought" (business rule).
- `listReviews`: `review` join `deal` -> `post` (title) and left join `student` as reviewer (`alias`); order `review.created_at desc`, limit. `reviewerName` = reviewer `account_status = 'active'` and `name <> ''` ? `name` : reviewer status `'deleted'` ? `"Deleted student"` : `"Student"` (never the email or handle of a non-active student).

### 4. Writing a review: `src/lib/deals/review.ts` (new) and the action
```ts
export const NOT_COMPLETED = "You can review once the handover is complete.";
export const ALREADY_REVIEWED = "You already reviewed this one.";
export const OTHER_CLOSED = "That student's account is closed.";
export async function submitReview(args: { actorId: string; dealId: string; input: unknown; alert?: AlertSink }): Promise<HandoverResult>
```
- Shape mirrors `reportDeal` in `src/lib/deals/report.ts` (same args style, returns `HandoverResult` from `schedule.ts`: `{ ok: true; conversationId } | { ok: false; error }`). Copy its deal lookup/participant check pattern (it uses `lockDeal`/`activeFor` style helpers; read it first). Reuse `DEAL_NOT_FOUND` from `src/lib/deals/cancel.ts` for "not found or not a participant". Do NOT use `activeFor` if it rejects completed deals: read it, and if it does, do a plain select of the deal joined to `offer` (for `conversationId`) and check `ownerId`/`responderId` membership yourself.
- Input zod (`z` from `zod`, as in `rules.ts`): `{ rating: z.number().int().min(1).max(5), text: z.string().max(500).default("") }`; `text` trimmed, empty -> `null`. Parse failure -> `{ ok: false, error: "Choose 1 to 5 stars." }`.
- Order of checks: parse; deal found and actor is a participant; `status === 'completed'` else `NOT_COMPLETED`; reviewee (the other participant) `account_status = 'active'` else `OTHER_CLOSED`; insert `review`; catch Postgres `23505` (use `isUniqueViolation` from `src/lib/messaging/send.ts:18`) -> `ALREADY_REVIEWED`. Any other error propagates (the DB triggers are the backstop).
- `src/app/deals/actions.ts`: add `export const submitReviewAction = async (dealId: unknown, input: unknown) => act("review", dealId, (a) => submitReview({ ...a, input }));` next to `reportDealAction`; import `submitReview`. (If `act`'s generic result type rejects it, widen `act`'s return type the way `reportDealAction` already does; read `act` first.)

### 5. Review button in the thread (completed deals)
- `src/lib/messaging/read.ts`: extend `DealCard` with `review: { mine: { rating: number; text: string | null } | null; theirs: { rating: number; text: string | null } | null } | null` (null unless `status === 'completed'`). In `getConversation`, after the offers are loaded, collect completed deal ids and run one query `select deal_id, reviewer_id, rating, text from review where deal_id in (...)` (skip when none); pass `reviews: ReviewRow[]` as a new last parameter of `dealCard(...)` and build `mine` (reviewer = viewerId) / `theirs`. Update every `dealCard(` callsite (`grep -n "dealCard(" src/lib/messaging/read.ts`). No new DB columns.
- `src/app/messages/[id]/review-box.tsx` (new, `"use client"`): props `{ deal: DealCardData; otherName: string }`. Layout copies the style of `ReportBox` in `payment-steps.tsx` (read it for classes and the `run`/busy/error handling and `NO_ANSWER` from `./reload-hint`). States: (a) `deal.review.mine` set -> text `You rated {otherName}` + stars + their text; (b) else a row of five 44px star buttons (`aria-label="1 star"` ... `"5 stars"`, `aria-pressed`), an optional `<textarea maxLength={500} placeholder="Say how it went (optional)">`, a `Send review` button (disabled until a rating is chosen; error text in `<p role="alert" className="text-sm text-red-600">` above the button); on `{ ok: true }` call `router.refresh()`. In both states, if `deal.review.theirs` is set show `{otherName} rated you` + stars + text. Reviews cannot be edited, so no edit control.
- `src/app/messages/[id]/handover-panel.tsx` completed branch (line ~113, the `<p>Completed. ...</p>` return): wrap in a fragment/div and render `<ReviewBox deal={deal} otherName={otherName} />` under the text when `deal.review !== null`.
- `src/app/messages/[id]/page.tsx` already spreads `...o.deal` into `DealCardData`; `review` has no dates so no conversion is needed (verify by `tsc`).

### 6. Shared stars component and profile page
- `src/components/stars.tsx` (new, server-safe): `export function Stars({ average, count }: { average: number | null; count: number })` renders five glyphs (`★` filled up to `Math.round(average)`, `☆` rest), then `average.toFixed(1)` and `(${count})`; wrapper `<span aria-label="${average.toFixed(1)} out of 5 from ${count} reviews">`; when `average === null` render `<span className="text-sm text-zinc-500">No reviews yet</span>`. Also export `StarRow({ rating }: { rating: number })` for a single review's fixed stars (used by review-box and the reviews list).
- `src/app/u/[handle]/page.tsx` (profile, line numbers from the scout: header block 35-67, listings 69-76): after the school line add a stats `<p>`/row: `<Stars .../>`, ` · Sold {sold} · Granted {granted}` and, only when `profile.isSelf`, ` · Bought {bought}`; plus `Typically replies {REPLY_LABEL[bucket]}` when `getReplyTime` is non-null (step 7). Data: `const [rep, reply, reviews] = await Promise.all([getReputation(profile.id), getReplyTime(profile.id), listReviews(profile.id)])`. After the listings section add `<section id="reviews">` with heading `Reviews` and, per review: `<StarRow>`, text (`whitespace-pre-wrap`), `{reviewerName} · {postTitle} · {date}` (date formatted with `toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })`); empty state `No reviews yet.`.
- No `PublicProfile` change; the profile page composes the three new functions (`getPublicProfile` stays as is).

### 7. Reply time: `src/lib/messaging/response-time.ts` (new; no equivalent exists)
```ts
export type ReplyBucket = "hour" | "few_hours" | "day" | "few_days";
export const REPLY_LABEL: Record<ReplyBucket, string> = { hour: "within an hour", few_hours: "within a few hours", day: "within a day", few_days: "within a few days" };
export const REPLY_WINDOW_DAYS = 30;
export const REPLY_MIN_CONVERSATIONS = 5;
export const REPLY_CAP_HOURS = 72;
export function bucketOf(hours: number): ReplyBucket; // hours <= 1 -> hour; <= 6 -> few_hours; <= 24 -> day; else few_days
export async function getReplyTime(studentId: string, now = new Date()): Promise<ReplyBucket | null>;
```
- `getReplyTime` runs one raw query through `getPool().query<{ n: number; median_seconds: number | null }>(text, [studentId, now.toISOString()])` (same driver call as `src/app/api/health/db/route.ts`). SQL (qualifying conversation = its FIRST message was sent by the other person within the last 30 days, and the student either replied after it or 72 hours have passed since it):
```sql
with mine as (
  select f.created_at as asked_at,
    (select min(r.created_at) from message r where r.conversation_id = f.conversation_id and r.sender_id = $1 and r.id > f.id) as replied_at
  from (
    select distinct on (m.conversation_id) m.conversation_id, m.id, m.sender_id, m.created_at
    from message m
    where m.conversation_id in (select id from conversation where participant_a = $1 or participant_b = $1)
    order by m.conversation_id, m.id
  ) f
  where f.sender_id <> $1 and f.created_at >= $2::timestamptz - interval '30 days'
)
select count(*)::int as n,
  percentile_cont(0.5) within group (order by least(extract(epoch from (coalesce(replied_at, asked_at + interval '72 hours') - asked_at)), 259200)) as median_seconds
from mine
where replied_at is not null or asked_at <= $2::timestamptz - interval '72 hours'
```
- Return `null` when `n < REPLY_MIN_CONVERSATIONS` or `median_seconds` is null; else `bucketOf(median_seconds / 3600)`. (Median is the "typical" value; the bucket thresholds 1h / 6h / 24h are this plan's decision.)
- Conversation header: in `src/lib/messaging/read.ts` add `replyTime: ReplyBucket | null` to `ConversationView` (computed with `getReplyTime(otherPersonId)` inside `getConversation`) and render it in `src/app/messages/[id]/page.tsx` as a muted one-line `<p className="px-4 text-xs text-zinc-500">Typically replies {REPLY_LABEL[...]}</p>` directly under the existing `PageHeader` (page.tsx line ~73; read it for the sticky wrapper and put the line inside the same wrapper so it does not scroll away).

### 8. Poster's stars on the post page
- `src/lib/posts/detail.ts`: add `rating: { average: number; count: number } | null` to `PostDetail.seller`; in `getPostDetail` (row already has `ownerId`) fill it from `(await getReputation(row.ownerId)).rating`.
- `src/app/posts/[id]/page.tsx` seller block (lines ~140-173, the `<p>` with "@handle · school" at ~160): add a line under it `<Stars average={seller.rating?.average ?? null} count={seller.rating?.count ?? 0} />` wrapped in `<Link href={\`/u/${seller.handle}#reviews\`}>`. Update the `detail.test.ts` fixture expectation for `seller` (add `rating: null`).

### 9. Review reminders job: `src/lib/jobs/review-reminders.ts` (new) and registration
```ts
export const REVIEW_REMIND_AFTER_DAYS = 1;
export const REVIEW_REMIND_WITHIN_DAYS = 14;
export async function sendReviewReminders(now = new Date(), alert?: AlertSink): Promise<number>
```
- Copy the shape of `sendHandoverReminders` in `src/lib/jobs/reminders.ts` (it calls `recordNotification(db, {...})`, counts `sent`, calls `alert?.(recorded.id)`).
- Select completed deals with `deal.updated_at <= now - 1 day` and `deal.updated_at > now - 14 days` (the 14-day floor stops a first run from reminding about old deals), joined to `offer` (for `conversationId`). For each of the two participants (owner, responder) with no row in `review` for (`deal_id`, `reviewer_id` = that participant), call `recordNotification(db, { type: "deal_review_reminder", recipientId, postId: deal.postId, conversationId, onceKey: \`deal:${deal.id}:review-remind\` })`. Never update the deal row.
- Register: `src/lib/jobs/job-run.ts` add `"review-reminders": { maxAgeMinutes: 36 * 60 }` to `JOBS` (daily-style, like `cleanup`); `src/app/api/jobs/run/route.ts` add `if (name === "review-reminders")` in `runNamed` following the `handover-reminders` branch (including `await Promise.all(alerts)` and a result string like `` `${n} review reminders` ``) and add the name to the doc comment's `?job=` list. Do NOT add it to `.github/workflows/jobs.yml` (the daily Vercel cron already calls `?job=all`; the 15-minute tick uses an explicit list).

## Critical files & anchors
- `src/db/schema.ts` + `src/db/migrations/0024_reviews.sql`: new `review` table, notification CHECK, hand-written triggers (pattern: `0019_secure_slot.sql`).
- `src/lib/messaging/read.ts`: `DealCard`, `dealCard(...)`, `getConversation`, `ConversationView` (review state + reply time both land here).
- `src/app/messages/[id]/handover-panel.tsx` completed branch (~line 113) and new `review-box.tsx`.
- `src/app/u/[handle]/page.tsx`: stats row and `#reviews` section.
- `src/lib/deals/handover.test.ts` / `src/lib/deals/handshake.test.ts`: copy `newPost`, `reserved`, `scheduled`, `mondaySlot`, `proposal` helpers and the `afterEach` cleanup (they are file-local, not shared); `src/test/fixtures.ts` for `createTestStudent`.

## Verification
All DB commands prefixed `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u NEON_BRANCH`; run from repo root; run only the files below (the full suite takes over an hour against the remote dev DB).
1. `npx tsc --noEmit` and `npx eslint src` clean; `npx next build` succeeds (routes `/u/[handle]`, `/posts/[id]`, `/messages/[id]` compile).
2. New `src/lib/messaging/response-time.test.ts`: (a) pure: `bucketOf(0.5)` = `hour`, `bucketOf(1)` = `hour`, `bucketOf(1.01)` = `few_hours`, `bucketOf(6)` = `few_hours`, `bucketOf(24)` = `day`, `bucketOf(24.01)` = `few_days`. (b) DB (students prefixed `rt-`, conversations inserted directly with `db.insert(conversation)` ordered so `participant_a < participant_b` by plain string compare, messages inserted with explicit `createdAt`): 4 qualifying conversations -> `null`; a 5th -> bucket of the median; a conversation the student started is not counted; an unanswered first message less than 72 hours old is excluded; unanswered and older than 72 hours counts as `few_days` (so 5 such conversations -> `few_days`); a first message older than 30 days is excluded.
3. New `src/lib/deals/review.test.ts` (students prefixed `rv-`; use FREE posts so completion is just `confirmHandover` by both with `now` after the slot): review on a `scheduled` deal -> `NOT_COMPLETED`; after completion each participant reviews once, a second review by the same person -> `ALREADY_REVIEWED`, a non-participant -> `DEAL_NOT_FOUND`; rating 0 and 6 rejected, 500-char text accepted and 501 rejected; direct `db.insert(review)` for a non-completed deal fails with SQLSTATE `23514`; `db.update(review).set({ rating: 1 })` fails with `23514`; stats: showcase priced deal (use the current payment helpers from `handover.test.ts`'s `finish`) -> seller `sold` = quantity, buyer `bought` = quantity, free showcase deal -> seller `granted` = 1 and buyer `bought` unchanged; wishlist deal: the SUPPLIER (responder) gets `sold`/`granted`, the poster (owner) gets `bought`; rating `average`/`count` equal the reviews received; no reviews -> `rating: null`; `listReviews` shows `"Deleted student"` for a reviewer set to `account_status = 'deleted'` and never returns an email.
4. New `src/lib/jobs/review-reminders.test.ts`: deal completed 2 days ago (set `deal.updated_at` back with `db.update`) -> both get exactly one `deal_review_reminder`; running again adds none; after one of them reviews only the other is reminded on a fresh deal; completed 6 hours ago -> none; completed 20 days ago -> none.
5. `src/lib/deals/handshake.test.ts` (decline notice, step 2), `src/lib/posts/detail.test.ts`, `src/lib/notifications` tests: run `npx vitest run src/lib/deals/handshake.test.ts src/lib/deals/handover.test.ts src/lib/posts/detail.test.ts src/lib/notifications src/lib/messaging src/lib/jobs src/lib/deals/review.test.ts src/lib/messaging/response-time.test.ts src/lib/jobs/review-reminders.test.ts` (expect long runtime, 20-40 minutes; write output to a file with `> "$TEMP/vt.log" 2>&1` and read the summary lines).
6. Manual smoke on dev: seed two `rv-` students and a completed free deal with a throwaway `tmp-seed.mts` (run with `npx tsx --env-file=.env.local tmp-seed.mts` under the `env -u` prefix; copy helpers from `handover.test.ts`); `npm run dev` (also `env -u` prefixed, `MAIL_TRANSPORT=log` already in `.env.local`; sign-in codes appear in `.next/dev/logs/next-development.log`); at 360 px width open the thread: the completed card shows five star buttons and "Send review"; after sending, the card shows "You rated ..." and `/u/<other handle>#reviews` shows the review, the stars line and `Granted 1`. Delete the seed students (email starting `rv-` / `rt-`, with posts, conversations, images) and `tmp-seed.mts` afterwards.
7. Deploy (same procedure as phase 12): rehearse the migration on a throwaway production copy (`neon branch create --project-id late-dew-47090405 --name rehearsal-reviews --parent production`, put its `neon connection-string` into `$TEMP/rehearsal.env` as `DATABASE_URL_UNPOOLED="..."`, run drizzle `migrate` with `--env-file="$TEMP/rehearsal.env"` under the `env -u` prefix, then `neon branch delete rehearsal-reviews --project-id late-dew-47090405` and delete the env file), then `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED -u NEON_BRANCH node --env-file="C:/Users/lowel/.studiskarte/production.env" node_modules/drizzle-kit/bin.cjs migrate`, then `git add -A . ':!AGENTS.md'`, commit, `git push`; confirm CI success (`gh run list --limit 1`) and the Vercel `studiskarte-marketplace` status success (the `-pwa` and `-2njv` projects always fail; ignore); production smoke: `curl -s -o /dev/null -w "%{http_code}" https://studiskarte-marketplace.vercel.app/api/health/db` = 200.

## Assumptions & contingencies
- Reviews are public immediately (the blueprint does not require a simultaneous reveal). Override: hide each side's review until both are in.
- Review text max 500 characters; rating 1-5; no deadline to review; reminder is one notification 1 day after completion (blueprint default), and only deals completed in the last 14 days are reminded.
- "Typically replies" = median over the last 30 days; buckets `<=1h`, `<=6h`, `<=24h`, else "a few days"; hidden under 5 qualifying conversations; a first message unanswered for 72 hours counts as 72 hours. Override: change the constants in `response-time.ts` (`bucketOf` thresholds, `REPLY_*`).
- A review of a closed (suspended/deleted) account is refused (`OTHER_CLOSED`); old reviews stay in the counts but show the reviewer as "Student" / "Deleted student".
- If `act()` in `src/app/deals/actions.ts` cannot take `submitReview` as written, write `submitReviewAction` as its own function that calls `requireActiveStudent()`, validates the id with `z.uuid()`, calls `submitReview`, calls `refresh()` from `next/cache`, and returns the result (pattern: `createCalendarLinkAction` in `src/app/(tabs)/me/settings/actions.ts`).
- If `drizzle-kit generate` produces extra changes beyond the `review` table and the notification CHECK, stop and diff `schema.ts` against git before accepting.
