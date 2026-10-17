# Logic → stack map — Studiskarte Marketplace

Revision 2. Mapped against stage 1 revision 2 and stage 2 as revised. Every stage 1 business element maps to exactly one home in the stack. Paths are the proposed layout, created phase by phase. `src/` is the source root.

## Proposed layout

| Area | Path | Holds |
| --- | --- | --- |
| Schema | `src/db/schema.ts`, `src/db/migrations/` | Tables, constraints, triggers, seeds |
| Identity | `src/lib/identity/` | `school-email.ts` (pure `.edu.ph` check and normalization), `auth.ts` (Better Auth config and the `sendVerificationOTP` callback), `onboarding.ts`, `profile.ts`, `delete-account.ts` |
| Mail | `src/lib/mail.ts` | The single `sendMail` function |
| Rate limits | `src/lib/rate-limit.ts` | Request counting for every limited action, and the 24-hour mail quota |
| Access | `src/lib/access.ts` | `requireActiveStudent`, `requireOwner`, `requireParticipant`, `requireAdmin`. The only place these checks live. |
| Images | `src/lib/images/` | `upload.ts` (validate, re-encode with sharp, store in R2), `signed-url.ts` (access check, then a short-lived link) |
| Posts | `src/lib/posts/` | `schema.ts` (Zod and constants), `create.ts`, `update.ts`, `transitions.ts` |
| Discovery | `src/lib/discovery/` | `visibility.ts` (the one base query every list uses), `feed.ts`, `filters.ts`, `search.ts` |
| Social | `src/lib/social/` | `follow.ts`, `heart.ts` |
| Messaging | `src/lib/messaging/` | `start.ts`, `send.ts`, `state.ts`, `unread.ts` |
| Deals | `src/lib/deals/` | `offers.ts`, `accept.ts`, `schedule.ts`, `confirm.ts`, `cancel.ts`, `review.ts`, `stats.ts` |
| Notifications | `src/lib/notifications/` | `create.ts`, `list.ts`, `unread.ts`, and `push/` (`subscriptions.ts`, `notify.ts`, `payload.ts`) |
| Calendar | `src/lib/calendar/` | `ics.ts`, `feed.ts` |
| Safety | `src/lib/safety/` | `report.ts`, `block.ts`, `admin.ts` |
| Jobs | `src/lib/jobs/` | `reminders.ts`, `expire-offers.ts`, `expire-posts.ts`, `expire-deals.ts`, `expiry-warnings.ts`, `review-reminders.ts`, `cleanup.ts`, `job-run.ts` |
| Routes | `src/app/` | Pages, server actions, route handlers, `manifest.ts`, `(public)/`, `admin/`, `api/jobs/`, `api/auth/`, `calendar/[token]/` |
| Service worker | `public/sw.js`, `public/offline.html` | `push` and `notificationclick` handlers, plus one navigation fallback to the static offline page |
| Components | `src/components/` | Cards, feed, filter sheet, photo viewer, conversation view, alerts toggle, connection notice, install help, nav bars |

## Tables

| Table | Source | Notes |
| --- | --- | --- |
| `student` | Better Auth user table, extended | email, handle, display name, avatar image, school domain, verification status, account status, terms version and time, admin flag, calendar token hash |
| `session`, `verification` | Better Auth | `verification` holds the codes |
| `school` | ours | Domain (key) and readable name |
| `category` | ours | Seeded two-level lookup: `parent_id`, name, and `requires_condition` on the main category |
| `post` | ours | One table, `kind` column, per-kind CHECKs, status, status before hidden, `listed_at`, `expires_at` |
| `availability_window` | ours | Many per post |
| `image`, `post_photo`, `message_image` | ours | `image` holds R2 keys and purpose. The other two link images to posts and messages. |
| `heart`, `follow`, `block` | ours | Composite primary keys, CHECK against self |
| `post_view` | ours | UNIQUE (`post_id`, `viewer_id`, `day`). Views are counted from these rows. |
| `conversation`, `message` | ours | |
| `offer`, `deal`, `review` | ours | |
| `notification` | ours | |
| `push_subscription` | ours | |
| `report` | ours | |
| `rate_limit_event` | ours | |
| `reminder_log`, `job_run` | ours | Reminder idempotency and the stale-scheduler warning |

Design choices: Showcase and Wishlist share the `post` table with a `kind` column, so an offer or report points at one `post_id`, and a conversation lists its posts in `conversation_listing`. Counts (followers, sold, granted, bought, rating, views) and the "typically replies within" time are computed by queries in `src/lib/deals/stats.ts`, `src/lib/social/follow.ts`, `src/lib/posts/views.ts` and `src/lib/messaging/response-time.ts`, never stored. If `post_view` grows too large, old rows can be rolled into a total later.

## Map

### Actors

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Visitor | actor | Public routes in `src/app/(public)/` (landing, sign-in, legal) | Every other route requires a session, checked in the shared layout and `access.ts` |
| Student | actor | `student` table and `requireActiveStudent` | |
| Seller | actor (role) | Derived, no table | Showcase owner, or Wishlist responder, per deal |
| Buyer | actor (role) | Derived, no table | Wishlist owner, or Showcase responder, per deal |
| Follower | actor (role) | `follow` table | |
| Admin | actor | `student.is_admin` flag plus `requireAdmin`, `src/app/admin/` | Set by the owner directly in the database |
| Society, Event organizer | actor | Later. No home by decision. | Listed under Orphans |

### Domains

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Identity and verification | domain | `src/lib/identity/` | |
| Profile and social | domain | `src/lib/identity/profile.ts`, `src/lib/social/` | |
| Posts | domain | `src/lib/posts/` | |
| Discovery | domain | `src/lib/discovery/` | |
| Messaging | domain | `src/lib/messaging/` | |
| Offers and deals | domain | `src/lib/deals/` | |
| Notifications | domain | `src/lib/notifications/` | |
| Calendar | domain | `src/lib/calendar/` | |
| Safety | domain | `src/lib/safety/` | |
| Legal | domain | `src/app/(public)/legal/` | Pages only. Text is supplied by the owner. |

### Entities and relationships

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Student | entity | `student` table | Email stored lowercase and trimmed |
| Post (Showcase or Wishlist) | entity | `post` table, `kind` column | |
| Photos (one or more) | attribute | `post_photo` plus `image` plus R2 | At least one, enforced in `create.ts` and by a trigger on publish |
| Category | entity | `category` table, two levels | The starter list in stage 1 is seeded. The owner confirms it. |
| Condition | attribute | `post.condition` enum, nullable. A CHECK requires it exactly when the main category sets `requires_condition`. | |
| School | entity | `school` table | Created from the email domain at first verification. The admin sets the readable name. |
| Heart | entity | `heart` table | |
| Post view | entity | `post_view` table | |
| Follow | entity | `follow` table | |
| Conversation | entity | `conversation` table | |
| Message | entity | `message` table, pictures in `message_image` | |
| Offer | entity | `offer` table | |
| Deal | entity | `deal` table | |
| Review | entity | `review` table | |
| Notification | entity | `notification` table | |
| Notification subscription | entity | `push_subscription` table | |
| Verification code | entity | Better Auth `verification` table | |
| Session | entity | Better Auth `session` table | |
| Report | entity | `report` table | |
| Block | entity | `block` table | |
| Calendar feed link | entity | `student.calendar_token_hash` | Only the hash is stored |
| Availability window | attribute | `availability_window` table | |
| Student owns many posts | relationship | `post.owner_id` foreign key | |
| Post has photos, listings in conversations, offers, one active deal | relationship | Foreign keys to `post.id` (`conversation_listing.post_id`, `message.post_id`, `offer.post_id`) | Active deal limited by the partial unique index below |
| Conversation has many messages | relationship | `message.conversation_id` foreign key | |
| Deal has up to two reviews | relationship | `review.deal_id` foreign key | |

### Business rules: identity and accounts

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Only verified students act | rule | `requireActiveStudent` in `access.ts`, called by every action and page | Also rejects suspended and deleted |
| `.edu.ph` suffix rule | rule | `src/lib/identity/school-email.ts` | Pure function, unit-tested with `x.edu.ph.com`, `xedu.ph`, `edu.ph`, mixed case, subdomains |
| Typing an address is not proof | rule | Better Auth Email OTP flow | |
| Code lifecycle (once, one address, time, new cancels old, wrong tries lock) | rule | Better Auth options in `src/lib/identity/auth.ts` | Phase 1 exit check, ADR 0004 |
| One email per account | rule | UNIQUE on `student.email` | |
| Code request limits | rule | `rate-limit.ts` called from the send callback | Limits open |
| 30-day sessions | rule | Better Auth session `expiresIn` | |
| First verification: handle, display name, terms | rule | `src/lib/identity/onboarding.ts` and the `student` terms columns | |
| Handle unique, case-insensitive | rule | UNIQUE index on `lower(student.handle)` | Format open |
| Verified mark | rule | `src/components/verified-badge.tsx`, derived | No data. Shown for every active student. |
| Email never shown to others | rule | Column lists in `discovery/`, `identity/profile.ts`, `messaging/` that never select `student.email` | Test: no response contains an address |
| Account deletion is final | rule | `src/lib/identity/delete-account.ts` | |
| School name from domain, admin can rename | rule | `school` table, admin page | |

### Business rules: posts

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Required fields | rule | `src/lib/posts/schema.ts` (Zod) plus NOT NULL and CHECK on `post` | Photo count in `create.ts`. The form asks for a condition only if the category needs one. |
| Price statement (amount, free, negotiable) | rule | `post.price_kind` and `post.price_amount` with CHECK (amount ≥ 0 only when kind is amount) | Currency constant in `schema.ts` [Assumed PHP] |
| Exchange options (meet-up, delivery, both) with matching place | rule | `post.exchange_meetup`, `exchange_delivery`, `meetup_location`, `delivery_area` with CHECKs | At least one option, and a place for each chosen |
| Pickup is delivery | rule | The `notification.type` enum has no pickup value | |
| Owner-only edit, withdraw, relist. Edit while open | rule | `requireOwner` plus `posts/update.ts`, `posts/transitions.ts` | |
| Listings expire 30 days after listing | rule | `post.expires_at` set from `listed_at`, and `jobs/expire-posts.ts` (daily Vercel cron) moves open posts to expired | |
| Expiry warning 3 days before, and at expiry | rule | `jobs/expiry-warnings.ts` creates the notification once | Idempotent, so a repeated run adds nothing |
| Relist: new 30 days, new listed date, appears as new | rule | `relist()` in `posts/transitions.ts` | Only for the owner's expired posts |
| Relisting keeps photos and history, only for expired posts | rule | `posts/transitions.ts` rejects any other status | |
| Reserved posts do not expire. On cancel, at least 7 days left | rule | `jobs/expire-posts.ts` skips reserved posts. `deals/cancel.ts` sets `expires_at` to at least now plus 7 days. | |
| Relisted posts count against the open limit | rule | `posts/create.ts` and `relist()` share one open-count helper | |
| Views counted once per student per day, never the owner. Owner-only insights | rule | `posts/views.ts` inserts into `post_view` with `ON CONFLICT DO NOTHING`. The owner page shows counts only. | Viewer identity never selected |
| Kind separate, never changes, no matching | rule | `post.kind` plus a trigger rejecting a change | |
| Limit on open posts | rule | `posts/create.ts`, counted inside the create transaction | Limit open |
| Open and reserved posts only in feed. Expired excluded. Reserved labelled, no new offers | rule | `discovery/visibility.ts` filter, and the check in `deals/offers.ts` | |
| Blocked students' posts never shown | rule | `discovery/visibility.ts`, the single base query for feed, search, profile, post page | |
| All schools visible, school shown and filterable | rule | `discovery/filters.ts` and the school name on the card | |

### Business rules: discovery

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Feed of both kinds. Followed students first, then everyone, newest first | rule | `discovery/feed.ts`, ordering by "viewer follows the owner" descending, then `listed_at` descending, with keyset pagination | Other sorts and search skip the follow ordering |
| Filters and sort options | rule | `discovery/filters.ts` (Zod parse, then SQL) | school, category, type, price range, condition, date listed, sort |
| Filters combine | rule | `discovery/filters.ts` (all conditions ANDed) | |
| Search covers posts, people, schools; hides closed, suspended, blocked | rule | `discovery/search.ts` over full-text and `pg_trgm` indexes | |
| Share link, content hidden until sign-in | rule | The shared layout redirects to sign-in with a validated `next` path | Test: `next` cannot point off-site |

### Business rules: profile and social

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Public profile contents (including stars and reply time) | rule | `identity/profile.ts` plus the profile page | |
| Own profile extras | rule | `identity/profile.ts` (own view), `social/heart.ts`, `deals/stats.ts` | |
| No self-follow, public follows | rule | CHECK on `follow`, `social/follow.ts` | |
| Hearts private. Owner sees a count, not who | rule | `social/heart.ts` scopes lists to the viewer. Notification text carries no name. | |
| Sold, granted, bought counts from completed deals | rule | `deals/stats.ts` | Derived, never stored |
| Rating from reviews of completed deals | rule | `deals/stats.ts` | No reviews means no rating shown |
| Typically replies within | rule | `messaging/response-time.ts`, a query over `message` timestamps for the last 30 days, shown by the profile and the conversation header | Hidden under 5 qualifying conversations |
| Post page shows the poster's stars and a link to reviews | rule | `src/app/posts/[id]/` using `deals/stats.ts` | |

### Business rules: messaging

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Cannot message own post | rule | `messaging/send.ts`; the pair CHECK (a < b) refuses a conversation with yourself; triggers refuse a listing, a listing card or an offer that does not fit the pair | A CHECK cannot compare across tables |
| Conversation private | rule | `requireParticipant` | |
| Message pictures visible only to the two | rule | `images/signed-url.ts` checks participation before signing | |
| Closed, withdrawn, expired, hidden post means read-only. Relisting reactivates it | rule | `messaging/state.ts`, derived from `post.status`, checked in `send.ts` | |
| Block makes a conversation read-only | rule | `messaging/state.ts` | |

### Business rules: offers and deals

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Offers by the responder only | rule | `deals/offers.ts` plus a trigger rejecting responder = owner | |
| Make offer with an amount | rule | `deals/offers.ts` | |
| Reserve at the asking price, not for negotiable | rule | `deals/offers.ts` | |
| One pending offer per (post, responder) | rule | Partial UNIQUE on `offer` where status is pending | |
| Offer expiry | rule | `jobs/expire-offers.ts`, daily Vercel cron | Duration open |
| Accept creates a deal, reserves, declines others, one active deal | rule | `deals/accept.ts` in one transaction, plus a partial UNIQUE on `deal(post_id)` where status is agreed or scheduled | |
| Agree time inside availability, place from the post | rule | `deals/schedule.ts` | Outside the window needs the owner's confirmation |
| Handover method must be offered by the post | rule | `deals/schedule.ts` plus a CHECK against the post's flags in a trigger | |
| Either side can cancel before completion | rule | `deals/cancel.ts` | Post returns to open |
| Completes when both confirm. Nobody else confirms | rule | `deals/confirm.ts` | Both confirmation times set, then status completed. No admin path exists. |
| Reminders to confirm at 1 and 3 days. Cancel idle deals after 7 days | rule | `jobs/expire-deals.ts`, `reminder_log` for the confirm reminders, calling `deals/cancel.ts` | Daily cron cancels. The 15-minute job sends reminders. |
| Services: no condition, meet-up means in person, delivery means finished work handed over | rule | `category.requires_condition` for the Services main category, and the same exchange fields on `post` | Form labels change by category |
| One review per participant per completed deal | rule | `deals/review.ts` plus UNIQUE (`deal_id`, `reviewer_id`) | |
| Reviews not editable or deletable by the author | rule | A trigger rejecting UPDATE on rating and text, and no delete path | |
| The system never moves money | rule | No home by design: no payment code or library | Enforced by absence |

### Business rules: notifications and calendar

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| In-app list of the listed types | rule | `notifications/create.ts` and the `notification.type` enum | Includes deal changes, post moderation notices, post expiring, post expired, and review reminders |
| Review reminder one day after completion | rule | `jobs/review-reminders.ts` | Idempotent. Skips a deal that already has the student's review. |
| Device alerts for the same entries. Actor never alerted | rule | `notifications/push/notify.ts`, after the transaction commits | An alert failure never fails the action |
| Alert shows only the title | rule | `notifications/push/payload.ts` | Test: payload never contains message text |
| Alerts toggled per device. Sign-out removes it | rule | `notifications/push/subscriptions.ts`, called by the sign-out action | |
| App shows everything without alerts, with unread counts | rule | `notifications/unread.ts` and `messaging/unread.ts` | |
| No alerts when suspended or revoked | rule | `notifications/push/notify.ts` filters on the recipient | |
| Reminders one day and two hours before | rule | `jobs/reminders.ts`, `reminder_log` UNIQUE (`deal_id`, `kind`) | Called by GitHub Actions every 15 minutes |
| `.ics` file per deal | rule | `calendar/ics.ts` and the `/deals/[id]/calendar.ics` route | |
| Private feed link, regenerable | rule | `calendar/feed.ts`, route `src/app/calendar/[token]/`, `student.calendar_token_hash` | Regenerating replaces the hash |
| Feed lists only own scheduled deals with title, time, place | rule | `calendar/feed.ts` | |
| No lock-screen live calendar | rule | No home by design: needs a native app | Replaced by reminder alerts |

### Business rules: safety, legal, limits

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Report once per target | rule | `report` UNIQUE (`reporter_id`, target) plus `safety/report.ts` | |
| Three distinct reporters auto-hide a post | rule | `safety/report.ts`, counted inside the report transaction | Threshold is a constant. Number open. |
| Admin reviews and acts | rule | `safety/admin.ts`, `src/app/admin/`, `requireAdmin` | |
| Students never auto-suspended | rule | No home by design: no code path | Enforced by absence |
| Restore clears earlier reports | rule | `safety/admin.ts` sets `report.cleared_at`. The count ignores cleared reports. | |
| Hidden post effects | rule | `discovery/visibility.ts`, `messaging/state.ts`, `deals/offers.ts`. Removing the post calls `deals/cancel.ts`. | |
| Block is private and mutual | rule | `safety/block.ts` and `discovery/visibility.ts` | |
| No self-report, no self-block | rule | CHECK constraints | |
| Legal pages readable by anyone | rule | `src/app/(public)/legal/` | |
| Works only connected, no private data stored offline. One static offline page | rule | `public/sw.js` caches only `public/offline.html` at install and falls back to it for failed navigations. It stores no other response. Signed-in pages carry `Cache-Control: private, no-store`. | Test: after browsing signed in, the cache holds one entry |
| No payment, escrow, courier, or fee | rule | No home by design | Enforced by absence |

### Primary flows

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| 1. Verify | flow | `src/app/(public)/sign-in/`, `src/app/api/auth/[...all]/`, `identity/auth.ts`, `mail.ts`, `identity/onboarding.ts` | |
| 2. Create a post | flow | `src/app/posts/new/`, `posts/create.ts`, `images/upload.ts` | |
| 3. Browse | flow | `src/app/(feed)/`, `src/app/posts/[id]/`, `discovery/feed.ts`, `posts/views.ts`, `components/` cards, photo viewer, filter sheet | Opening a post records the view |
| 4. Search | flow | `src/app/search/`, `discovery/search.ts` | |
| 5. Heart and share | flow | `social/heart.ts`, Web Share API in a client component | |
| 6. Message | flow | `src/app/messages/`, `messaging/start.ts`, `send.ts`, `images/upload.ts` | Reply visibility by interval refresh |
| 7. Offer | flow | `deals/offers.ts`, `deals/accept.ts` | |
| 8. Schedule and meet | flow | `deals/schedule.ts`, `deals/confirm.ts` | |
| 9. Review | flow | `deals/review.ts` | |
| 10. Follow | flow | `social/follow.ts` | |
| 11. Manage my posts | flow | `src/app/me/posts/`, `posts/update.ts`, `posts/transitions.ts` (withdraw, relist), insights from `posts/views.ts` | |
| 12. Notifications | flow | `src/app/notifications/`, `notifications/list.ts` | |
| 13. Alerts | flow | `components/alerts-toggle.tsx`, `notifications/push/subscriptions.ts`, `public/sw.js` | |
| 14. Calendar | flow | `calendar/ics.ts`, `calendar/feed.ts`, settings page | |
| 15. Report or block | flow | `safety/report.ts`, `safety/block.ts` | |
| 16. Admin review | flow | `src/app/admin/`, `safety/admin.ts` | |
| 17. Edit profile | flow | `src/app/me/settings/`, `identity/profile.ts` | |
| 18. Delete my account | flow | `identity/delete-account.ts`, one transaction | Cancels deals via `deals/cancel.ts` |

### State transitions

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Student | state | `student.verification_status` and `student.account_status` | Deleted is final |
| Post | state | `post.status`, `post.status_before_hidden`, `post.expires_at`, `posts/transitions.ts` | Values: open, reserved, fulfilled, withdrawn, expired, hidden, removed. A trigger enforces the final states. |
| Offer | state | `offer.status`, `deals/offers.ts` | Expires with its post |
| Deal | state | `deal.status`, `deals/` | Completed and cancelled are final. Idle deals are cancelled by `jobs/expire-deals.ts`. |
| Conversation | state | Derived by `messaging/state.ts` | |
| Report | state | `report.status` | |
| Verification code | state | Better Auth `verification` table | Used and cancelled are expressed by deletion or replacement. Confirm in phase 1. |
| Notification subscription | state | Row existence in `push_subscription` | |
| Session | state | Better Auth `session` table | |
| Notification | state | `notification.read_at` null or set | |

### Invariants

| Element | Type | Home | Notes |
| --- | --- | --- | --- |
| Post has one owner, at least one photo, fixed kind | invariant | `post.owner_id` NOT NULL FK, the photo check, the kind trigger | |
| Conversation: two distinct participants, one per pair | invariant | `conversation` NOT NULL FKs, UNIQUE (`participant_a`, `participant_b`), CHECK (`participant_a` < `participant_b` COLLATE "C") | |
| One pending offer per post and responder. No offer on own post | invariant | The partial UNIQUE and the offer trigger | |
| One active deal per post. Participants are owner and responder, distinct | invariant | The partial UNIQUE on `deal(post_id)`, and `deal` FKs with a trigger | |
| Deal completes only after both confirm | invariant | CHECK: status completed requires both confirmation times | |
| Review only for a completed deal, rating 1 to 5, between its participants | invariant | `review` CHECK on rating, a trigger on deal status and participants | |
| Unique handle, email, follow, heart, block, report | invariant | UNIQUE and composite primary keys | |
| Code used once and one pending per address | invariant | Better Auth `verification`, `resendStrategy: "rotate"` | Phase 1 exit check |
| Subscription belongs to one active student | invariant | `push_subscription.student_id` FK, UNIQUE (`endpoint`), check in `subscriptions.ts` | |
| Session: one student, one device, 30 days | invariant | Better Auth `session` and `expiresIn` | |
| Counts and ratings are derived | invariant | `deals/stats.ts`. No stored counter column exists. | |
| An open post's expiry is in the future | invariant | CHECK: status open requires `expires_at` later than `listed_at`. `jobs/expire-posts.ts` closes any that have passed. | A CHECK cannot compare to the clock, so the job enforces the rest |
| Views once per student per post per day, never the owner | invariant | UNIQUE (`post_id`, `viewer_id`, `day`), and `posts/views.ts` skips the owner | |

### Edge cases

| Edge case | Home |
| --- | --- |
| Email already used | UNIQUE on `student.email`, message from the sign-in action |
| Wrong, expired, used, cancelled, or locked code: same message | The sign-in action maps all failures to one reply |
| Non-`.edu.ph` request | The `sendVerificationOTP` callback sends nothing, plus a form hint |
| Repeated code requests | `rate-limit.ts` |
| Handle already taken | UNIQUE index, sign-up form error |
| No photo, or zero or negative amount | `posts/schema.ts` and CHECKs |
| Photo upload fails midway | `posts/create.ts` stores nothing until all uploads succeed, and the form keeps its values |
| Offer on reserved, closed, hidden, or own post | `deals/offers.ts` and the offer trigger |
| Two offers accepted at once | The partial UNIQUE on `deal(post_id)`, loser gets declined |
| Offer on a post withdrawn in the meantime | `deals/offers.ts` re-checks status inside its transaction |
| Price changed while offer pending | `offer.amount` is stored on the offer |
| Reserve on a negotiable post | `deals/offers.ts` and the UI hides the button |
| Meet-up time outside availability | `deals/schedule.ts` |
| One side never confirms handover | `jobs/expire-deals.ts` and `jobs/reminders.ts`, then `deals/cancel.ts` after 7 days |
| Participant deletes account during a deal | `delete-account.ts` calls `deals/cancel.ts` |
| Deleted student in old reviews and messages | Queries show "deleted student" for `account_status = deleted` |
| Block during a scheduled deal | `safety/block.ts` calls `deals/cancel.ts` |
| Report on own post | CHECK and `safety/report.ts` |
| Three reports from accounts of one person | Not prevented. Admin review. |
| Hidden post with an accepted deal | `safety/admin.ts` and `deals/cancel.ts` |
| Delivery-only post, buyer out of area | No home. The students settle it. |
| Handover method not offered | `deals/schedule.ts` |
| Hearted post unavailable | `social/heart.ts` returns it with an unavailable flag |
| Shared link signed out, or to a closed post | Layout redirect, and the post page shows "no longer available" |
| Calendar feed link leaked | `calendar/feed.ts` regenerate |
| Offline when opening | `public/sw.js` shows `public/offline.html`. While the app is open, `components/connection-notice.tsx` shows the same message. |
| Sign-out on a shared phone | The sign-out action removes the subscription and clears the session |
| Session expires | Better Auth expiry, redirect to sign-in |
| Alert subscription expired | `notifications/push/notify.ts` deletes the row on a "gone" reply |
| iPhone without the app installed | `components/install-help.tsx` and unread counts |
| Verification revoked while owning posts | `discovery/visibility.ts` joins the owner's status |
| Mixed case or spaces in an address | `school-email.ts` normalization |
| Two students message at once | UNIQUE (`post_id`, `responder_id`) |
| Message to a post closed in the meantime | `messaging/send.ts` re-checks inside its transaction |
| Duplicate post | A check in `posts/create.ts` over open posts of the same owner, kind, title, and description |
| Post expires while a message or offer is being written | `messaging/send.ts` and `deals/offers.ts` re-check status inside their transactions |
| Relist reopens the post to messages and offers. Expired offers stay expired | `listingClosedReason` is derived from the post. `offer.status` is not touched by relisting. |
| Reserved post at 30 days | `jobs/expire-posts.ts` skips reserved posts |
| Many relists | The shared open-count helper |
| Many opens of one post in a day, owner opens | UNIQUE on `post_view`, and the owner skip |
| Fewer than 5 conversations for reply time | `messaging/response-time.ts` returns nothing |
| Block removes follows both ways. Followed student deletes account | `safety/block.ts` and `identity/delete-account.ts` delete the `follow` rows |
| Follows nobody | `discovery/feed.ts` ordering falls back to newest first |
| Category without condition | CHECK on `post.condition` and the form |
| Service completed with no item | `deals/confirm.ts`, same path as an item |
| Category renamed or removed | Posts keep their `category_id`. `relist()` requires a current category. |
| Abusive content | Report flow and admin review |

## Orphans
Stage 1 elements with no home in the stack yet.

- **Societies, Events, AI listing**: deferred by decision. No component chosen.
- **Legal page text, community guidelines, and the confirmed category list**: these are inputs only you can supply. The pages and the lookup table exist. Their content does not.

## Unused components
Stack pieces no business element uses.

- **Web app manifest**: used by the overview ("installable app") and the iPhone edge case. Kept.
- **Vitest, Playwright, GitHub Actions CI**: prove elements, and are mapped to none. Kept.
- **Tailwind CSS, scroll-snap, native `<dialog>`**: used by the browse and viewer flows. Kept.
- **`job_run` table**: supports the stale-scheduler warning from stage 2. Kept.
- No other unused component found.

## Gaps found while mapping, fixed in stage 1
Three items were missing from stage 1. I added them:
- **School naming:** a school is identified by its email domain and has a readable name, which the admin can set. Until then the domain is shown.
- **Anonymous hearts:** hearts are private, yet the post owner is notified of one. The notification says the post got a heart, without saying who.
- **More notification types:** deal changes (scheduled, confirmed, cancelled) and moderation notices (post hidden, restored, removed). Stage 1 required telling people, but the list did not include them.
