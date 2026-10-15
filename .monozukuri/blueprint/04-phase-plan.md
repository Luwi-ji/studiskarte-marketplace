# Phase plan — Studiskarte Marketplace

Sizes: S one concern, M one module or boundary, L several modules or a data model. Ordered by dependency first, then smallest first. Nothing is opened to real students until phase 16. Each phase ends at a verified checkpoint, named in `exit`. Task lists for a phase are written when it starts.

## Phase 1: Walking skeleton (L, the mandated vertical slice)
- id: 1
- intent: A `.edu.ph` student signs in with an emailed code on the deployed app, creates a post with one photo, and sees it in a feed, with CI green.
- affected: repo and CI, Next.js app and manifest, Neon schema (`student`, `session`, `verification`, `post`, `image`, `post_photo`, `rate_limit_event`), `identity/school-email.ts`, `identity/auth.ts`, `mail.ts`, `rate-limit.ts`, `images/upload.ts`, a plain feed page, Vercel project
- prereqs: external: the Gmail App Password, a Vercel account, a Neon account, a Cloudflare R2 account (check whether it needs a payment method), push access to the GitHub repo
- playbook: feature
- risk: high
- exit: ADR 0004's four checks pass: our send callback sends nothing for a non-`.edu.ph` address or over the limit; Better Auth enforces attempts, expiry and one live code per address; a code reaches `.edu.ph` inboxes at two schools, ideally one on Google mail and one on Microsoft mail; and sign-in completes inside the installed app on an iPhone and an Android phone. Also: a posted photo has its location data stripped, and the cache holds nothing.

## Phase 2: Identity completion (M)
- id: 2
- intent: A new student chooses a unique handle and display name, is placed in a named school, and can edit their profile picture and names.
- affected: `student` columns, `school` table and admin naming, `identity/onboarding.ts`, `identity/profile.ts`, `src/app/me/settings/`, avatar images
- prereqs: 1
- playbook: feature
- risk: high
- exit: handles are unique case-insensitively; the school shows its domain until renamed; no response anywhere contains a school email.

## Phase 3: Full listing (M)
- id: 3
- intent: A student creates, edits, and withdraws a Showcase or Wishlist post, including services, with every field in stage 1.
- affected: `post`, `availability_window`, `category` (starter list seeded), `post_photo` (many photos), `posts/schema.ts`, `posts/create.ts`, `posts/update.ts`, `posts/transitions.ts`, `src/app/posts/new/`, `src/app/me/posts/`
- prereqs: 1; external: the owner confirms the starter category list
- playbook: feature
- risk: medium
- exit: every required-field rule and CHECK rejects bad input (no photo, negative amount, missing place for a chosen exchange option, condition for a category that has none); a failed photo upload creates nothing; the open-post limit holds.

## Phase 4: Listing lifecycle (S-M)
- id: 4
- intent: Posts expire after 30 days, owners are warned, and an owner relists an expired post. The owner also sees views, hearts, messages and offers on their posts.
- affected: `post.expires_at`, `jobs/expire-posts.ts`, `jobs/expiry-warnings.ts`, `jobs/job-run.ts`, `src/app/api/jobs/`, Vercel cron, the GitHub Actions scheduled workflow, `posts/views.ts`, `post_view`, the owner insights view
- prereqs: 3
- playbook: feature
- risk: medium
- exit: a post whose time has passed is expired by the job and relisting restores it; running a job twice changes nothing; the scheduler calls the protected endpoint from GitHub Actions and the admin staleness check detects a stopped scheduler; views count once per student per day and never for the owner. This phase also retires the scheduler unknown early.

## Phase 5: Social basics (S-M)
- id: 5
- intent: A student follows and unfollows others, hearts posts privately, and opens a public profile with follower count and active listings.
- affected: `follow`, `heart`, `social/follow.ts`, `social/heart.ts`, `identity/profile.ts`, profile pages, the owner's heart count
- prereqs: 2, 3
- playbook: feature
- risk: medium
- exit: no self-follow, no duplicate follow or heart; the post owner sees a heart count but never who gave it.

## Phase 6: Browse (M)
- id: 6
- intent: Students browse a two-column feed of cards, swipe small cards, open a post with a full-screen swipeable photo viewer, and see followed students' posts first.
- affected: `discovery/visibility.ts`, `discovery/feed.ts`, cards, post detail page, photo viewer, hide-on-scroll navigation, keyset pagination
- prereqs: 3, 5
- playbook: feature
- risk: medium
- exit: the feed lists only open and reserved posts; followed students come first, then newest; a viewer who follows nobody sees newest first; opening a post records one view; the offline page and connection notice are not yet needed.

## Phase 7: Filters, sort, and search (M)
- id: 7
- intent: Students filter by school, category, type, price, condition and date listed, sort three ways, and search posts, people, and schools.
- affected: `discovery/filters.ts`, `discovery/search.ts`, full-text and `pg_trgm` indexes, filter sheet, search page, expanded search bar
- prereqs: 6
- playbook: feature
- risk: medium
- exit: filters combine with AND; search finds a misspelled handle; closed, suspended and blocked-in-future posts and people do not appear; the follow-first ordering applies only to the default sort.

## Phase 8: Messaging (M)
- id: 8
- intent: Two students hold a private conversation about one post, with text and pictures, a product card at the top, and unread counts.
- affected: `conversation`, `message`, `message_image`, `messaging/` modules, `images/signed-url.ts`, `src/app/messages/`, conversation view with interval refresh
- prereqs: 2, 3
- playbook: feature
- risk: high
- exit: only the two participants can read a message or open a picture; a student cannot message their own post; two simultaneous first messages give two conversations; a closed or expired post makes the conversation read-only and relisting reactivates it.

## Phase 9: Notifications, alerts, and the offline page (M)
- id: 9
- intent: A student sees an in-app notification list with unread counts, turns alerts on per device, gets an alert for a new message, and sees a static page when offline.
- affected: `notification`, `push_subscription`, `notifications/`, `notifications/push/`, `public/sw.js` (add push and notificationclick; the offline page part shipped in Phase 1), alerts toggle, install help, VAPID keys
- prereqs: 8; external: generated VAPID keys, a real iPhone and an Android phone for testing
- playbook: feature
- risk: high
- exit: an alert shows only the post title; signing out removes that device's subscription; the sender is not alerted; an expired subscription is deleted; after browsing signed in, the cache holds exactly one entry; an iPhone without the app installed still sees everything in the app.

## Phase 10: Offers and reserve (M)
- id: 10
- intent: A responder makes an offer or reserves at the asking price, and the owner accepts or declines. Accepting creates a deal and reserves the post.
- affected: `offer`, `deal`, `deals/offers.ts`, `deals/accept.ts`, offer cards inside conversations, offer notifications
- prereqs: 8, 9
- playbook: feature
- risk: high
- exit: two offers accepted at once leave exactly one deal and one declined offer; one pending offer per responder per post; no offer on a reserved, expired, hidden or own post; Reserve is unavailable for "negotiable".

## Phase 11: Handover (M)
- id: 11
- intent: The two students agree a time and place, are reminded, confirm the handover, or cancel, and idle deals cancel themselves.
- affected: `deals/schedule.ts`, `deals/confirm.ts`, `deals/cancel.ts`, `jobs/reminders.ts`, `jobs/expire-deals.ts`, `reminder_log`, deal notifications
- prereqs: 10, 4
- playbook: feature
- risk: high
- exit: a deal completes only after both confirm and no other path completes it; an unscheduled deal after 7 days and an unconfirmed one 7 days after its time are cancelled, and the post returns to open with at least 7 days left; reminders go out once.

## Phase 12: Calendar export (S)
- id: 12
- intent: A student adds a scheduled deal to their calendar and subscribes a calendar app to a private feed link that they can regenerate.
- affected: `calendar/ics.ts`, `calendar/feed.ts`, `src/app/calendar/[token]/`, `student.calendar_token_hash`, settings page
- prereqs: 11
- playbook: feature
- risk: low
- exit: an `.ics` file opens in Google Calendar and iPhone Calendar; the feed lists only that student's scheduled deals with title, time and place; regenerating the link stops the old one.

## Phase 13: Reviews and reputation (S-M)
- id: 13
- intent: After a completed deal each student reviews the other once, and stars, items sold, granted and bought, and "typically replies within" appear on profiles.
- affected: `review`, `deals/review.ts`, `deals/stats.ts`, `messaging/response-time.ts`, `jobs/review-reminders.ts`, profile pages, post detail stars
- prereqs: 11, 8
- playbook: feature
- risk: medium
- exit: a review exists only for a completed deal and only once per reviewer; a review cannot be edited or deleted by its author; counts and ratings come from queries with no stored counter; the reply time is hidden under 5 conversations.

## Phase 14: Safety (M)
- id: 14
- intent: Students report posts and people and block others, three distinct reporters hide a post, and the admin reviews the queue.
- affected: `report`, `block`, `safety/`, `src/app/admin/`, `student.is_admin`, `discovery/visibility.ts`, `messaging/state.ts`, deal cancellation on block or removal
- prereqs: 6, 8, 11; external: the owner is set as admin
- playbook: feature
- risk: high
- exit: three distinct verified reporters hide a post at once and the owner is told; restoring clears earlier reports; a block hides both sides' posts and profiles, makes the conversation read-only, removes follows, and cancels a scheduled deal; no code path suspends a student automatically.

## Phase 15: Account deletion (S-M)
- id: 15
- intent: A student deletes their account, erasing their profile and email, withdrawing open posts, cancelling deals, and signing out everywhere.
- affected: `identity/delete-account.ts`, follows, hearts, subscriptions, sessions, old reviews and messages shown as "deleted student"
- prereqs: 11, 5
- playbook: feature
- risk: high
- exit: after deletion no row exposes the email or handle; other students' conversations remain readable; active deals cancel and the other student is told. Deletion is irreversible, so this phase gets a second review.

## Phase 16: Release hardening (L)
- id: 16
- intent: The app opens to real students with legal pages, terms acceptance, observability, backups, a security review, and a rollback path.
- affected: `src/app/(public)/legal/`, terms acceptance and re-acceptance, error tracking, structured logs and quota warnings, CI gates, production environments, backup and restore, security and privacy review, load check on free tiers
- prereqs: 1 to 15; external: the owner's terms of service, privacy policy and community guidelines text, a student data privacy review, an error tracker choice
- playbook: release
- risk: high
- exit: a signed-out visitor reads the legal pages; a student who has not accepted the current terms version is asked to; a restore from backup works; the Gmail quota warning, stale-scheduler warning and storage warnings fire in a test; the pre-launch checklist and rollback steps are written.

## Phase 17: Societies (deferred)
- id: 17
- intent: Students form group chats, like for a student organization. Starts only after its questions are answered (what a society is, who creates it, how members join, how it is moderated).
- affected: new group entities. Conversations stay two-person.
- prereqs: 16; external: owner answers on scope and moderation capacity
- playbook: feature
- risk: high
- exit: set when the phase starts.

## Phase 18: Events (deferred)
- id: 18
- intent: Events appear in notifications and the calendar. Starts only after its questions are answered (who posts events, campus or student-run, tied to societies).
- affected: new event entity, notifications, calendar feed
- prereqs: 16, 12; external: owner answers on scope
- playbook: feature
- risk: medium
- exit: set when the phase starts.

## Phase 19: AI listing (deferred)
- id: 19
- intent: From photos the system drafts a title, description, category and condition, suggests a price, and lists several items at once. Starts only after a provider, cost and privacy check.
- affected: create flow, a model provider, the privacy policy
- prereqs: 16, 3; external: a provider decision, a check that sending student photos to a third party fits the privacy policy
- playbook: feature
- risk: high
- exit: set when the phase starts.

## Phase order rationale
- **Phase 1 retires the biggest unknowns in one thin slice:** Better Auth's callback behavior, Gmail sending from Vercel, delivery to real school inboxes, R2 uploads, and sign-in inside an installed iPhone app. If one fails, the cost is small.
- **Phase 4 retires the scheduler unknown early.** It is small and is the only thing that needs GitHub Actions to call the app. Reminders in phase 11 and phase 13 rely on it.
- **Small before large within a layer.** After phase 3, phases 4 and 5 (each S-M) come before browse, search and messaging (each M). Calendar export (S) comes before reviews (S-M), and both depend on handover.
- **Deals come after messaging and alerts**, because offers live inside conversations and every deal event notifies someone. Handover depends on offers and on the scheduler.
- **Safety comes after deals** because blocking and removal cancel deals, so the cancel path must already exist. Deletion comes after both for the same reason.
- **Release hardening is last and large**, because it needs the whole system and the owner's legal text. It is not split because its pieces only make sense together. Societies, events and AI listing wait until after launch, as decided.
- **The owner's inputs gate phases, not the other way round.** The category confirmation gates phase 3, the VAPID keys and test phones gate phase 9, and the legal text and privacy review gate phase 16.
- **No phase touches money,** so there is no critical-risk phase. Phases 1, 2, 8, 9, 10, 11, 14, 15 and 16 are high because they handle identity, private messages, concurrent deals, or irreversible data.

## External dependencies by phase

| Needed by | What | Owner |
| --- | --- | --- |
| 1 | Gmail App Password (done), Vercel, Neon and Cloudflare R2 accounts, GitHub push access, two schools' `.edu.ph` inboxes, an iPhone and an Android phone | You |
| 3 | Confirmed starter category list | You |
| 9 | VAPID keys (generated then), test phones | Me and you |
| 14 | Your account marked as admin | You |
| 16 | Terms of service, privacy policy, community guidelines, privacy review, error tracker choice | You |
| 17 to 19 | Answers to each phase's open questions | You |
