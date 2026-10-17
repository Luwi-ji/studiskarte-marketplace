# Studiskarte Perks: partner discounts that feed the marketplace

Planning draft, 2026-10-16 (updated the same day: the recommended simple version is first; Parts 1 and 2 are the fuller options kept for later). Nothing in the code changed. Based on the repo as of commit `dac027c` (Phase 10, offers and reserve).

## Recommended: the simplest version (decided direction, 2026-10-16)

The owner chose UNiDAYS-style perks without gamification: besides buying, selling and browsing, students discover discounts from businesses near campus. Students who open the app only for perks are fine.

### What students get
- A **Perks** tab (the feed stays home). Perk cards show the business, the discount, terms and area; filter by school/area and kind (food, clothes, printing, services...).
- On a perk, **Use now** shows a one-time pass valid for 10 minutes: a 6-character code, their photo, name and school, and a moving animation so screenshots are useless.
- Limits per perk (for example 1 a day per student), set per perk.
- After the counter redeems it, the pass shows "Used" and the student taps **I got my discount** (or **Shop refused**).

### What businesses get
- **Apply** with a simple form (start with a Google Form; a page in the app later): business name, address, what they offer students, contact, proof the business is real (business permit or DTI, and a shop photo).
- No business account and no app. You approve them and type the perk in an admin page.
- Counter staff get a **station link** (bookmark on the counter phone, PIN once): type or scan the code, see the photo, tap **Redeem**.
- A monthly count of redemptions, which you send them.

### Pricing
- **First month free** for the first shops (proof that you bring customers).
- Then **₱500 prepaid balance, ₱5 per redemption** (₱5 is a starting guess; ask the first shops). Same fee whatever the discount, so you never need the bill amount.
- The perk hides itself when the balance hits ₱0; the shop tops up to show it again.
- **Unused balance is refundable on request.**
- Payment is manual at first: the shop sends GCash, you record the top-up in the admin page and give a receipt. No payment gateway yet.

### Tables (4 + 1)
```
partner         id, name, kind, area, school_ids null, status (pending, active, paused, ended),
                is_meetup_spot, contact_name, contact_phone, proof_note, created_at
partner_station id, partner_id, label, token_hash, pin_hash, revoked_at
perk            id, partner_id, title, terms, limit_per_student, limit_period (day, week, month, ever),
                starts_at, ends_at null, status (draft, live, paused, ended)
perk_claim      id, perk_id, student_id, code, status (issued, redeemed, expired),
                issued_at, expires_at, redeemed_at, station_id, student_confirmed (null, yes, refused)
partner_topup   id, partner_id, amount, method ('gcash'), reference, note, created_at
```
Balance = sum of top-ups minus ₱5 x redeemed claims after the free period, worked out by a query (no stored balance, like your other counts). A perk shows only while its partner is active and the balance covers one more redemption (or it is still in the free month).

### Leave out for now
XP, levels, quests, streaks, stamp cards, flash drops, barkada deals, maps, shop self-service, online payments, deal-unlock rules. Parts 1 and 2 below keep them for later if the numbers ask for them.

### Watch for
- Staff giving the discount without tapping Redeem (to avoid the fee): compare "I got my discount" taps with station redeems per shop.
- Shops refusing perks: 3 "Shop refused" reports in 30 days pauses the shop for review.
- Business setup before charging anyone: register the business (DTI, then BIR receipts), move Vercel off the free Hobby plan, and add perks and the photo shown to staff to the privacy policy.

### When and how
1. **Now:** sign 3-5 shops near TUP for a free first month (Google Form plus a visit).
2. **Build as one phase** (about the size of Phase 9): the tables, an admin page for partners/perks/top-ups, the Perks tab, the pass, the station page, an expiry job for unused codes, and database tests (a code works once, limits hold under concurrent taps, the hidden-at-₱0 rule). It needs nothing from Phases 11-15, so it can come right after Phase 11 or before release hardening, whichever you prefer.
3. **Pilot 4-6 weeks.** Measure redemptions per shop, refusals, and whether shops say yes to ₱500.
4. **Start charging** once a shop has seen real customers.

---

# Fuller options (for later)

## Short answer

Yes, it is possible, and it fits the app well. The trick that keeps it from becoming a discount-only app: **the best perks are earned by completing deals on Studiskarte, and partner shops become the places where deals happen.** A small welcome perk brings students in; everything better needs real marketplace activity.

Accept one thing up front: some students will open the app only for perks. That is fine as long as (a) they still have to pass through the feed to get there, and (b) most perks need a completed deal. UNiDAYS and Student Beans live with discount-only users because those users are their whole business. Studiskarte's business is the marketplace, so perks are the reward, not the product.

## What already exists that this builds on

- **Verified students only**: `.edu.ph` code sign-in, one account per school email, school known from the domain (`student`, `school` tables). This is the same eligibility check UNiDAYS sells to brands, and you already have it.
- **Deals that need both sides to confirm**: `offer` -> `deal` (Phase 10). Phase 11 adds handover confirmation by both students. A *completed* deal is the most trustworthy "real marketplace use" signal you have, which makes it the right thing to reward.
- **Meet-up locations** on posts and deals (free text today).
- **Notifications and Web Push** (Phase 9) to announce unlocked perks.
- **Jobs endpoint** (15-minute tick) to expire claim codes and perks.
- **No money moves through the app.** Perks keep that rule: the partner gives the discount at their counter; Studiskarte never touches payment.

Naming: the codebase already uses **offer** for price proposals. Call partner deals **Perks** in code and UI to avoid two meanings of "offer".

## Data model (new tables, Drizzle, same style as `schema.ts`)

```
partner
  id uuid pk
  name, slug (unique), logo_image_id -> image
  kind text            -- food_drink, clothing, services, print_school, other
  area text            -- free text, like post meet-up places ("near TUP Manila gate")
  school_ids uuid[] null  -- null = every school; otherwise only students of these schools
  status text          -- pending, active, paused, ended
  is_meetup_spot bool  -- partner agreed to be a suggested safe meet-up place
  contact_name, contact_phone   -- never shown to students
  created_at

partner_station          -- one per counter/branch; how staff verify codes
  id uuid pk
  partner_id -> partner
  label text           -- "Main counter"
  token_hash text      -- secret link the staff phone opens; revocable
  pin_hash text        -- 4-6 digit PIN typed once per device
  revoked_at null

perk
  id uuid pk
  partner_id -> partner
  title text           -- "₱10 off any drink"
  terms text           -- "Min spend ₱80. Dine-in only. Not with other promos."
  benefit text         -- amount_off, percent_off, freebie
  value int            -- pesos or percent
  unlock text          -- welcome | deals_completed | meetup_here | seller_tier
  unlock_count int     -- e.g. 1 for "after your first completed deal"
  per_student_limit int, per_student_period text   -- 1 per week, 1 ever...
  total_limit int null -- partner's budget: first 200 redemptions
  category_slug text null  -- surface on posts in this category
  starts_at, ends_at, status (draft, live, paused, ended)

perk_claim               -- one code shown to one student, used once
  id uuid pk
  perk_id -> perk, student_id -> student
  code text            -- 6 chars, no look-alike letters, unique while issued
  status text          -- issued, redeemed, expired, void
  issued_at, expires_at   -- 10 minutes after issue
  redeemed_at null, station_id null -> partner_station
  source_deal_id null -> deal   -- which deal earned it, for meetup_here / audit
  CHECK ((status = 'redeemed') = (redeemed_at is not null and station_id is not null))
  UNIQUE INDEX one_live_claim ON (perk_id, student_id) WHERE status = 'issued'
  UNIQUE INDEX live_code ON (code) WHERE status = 'issued'

perk_report              -- "the shop refused my perk" / "staff said code invalid"
  claim_id, student_id, reason, created_at
```

Eligibility (verified, active, right school, unlock rule met, under per-student and total limits) is a query, not a stored flag, the same way the blueprint already derives items sold and ratings. Enforce limits inside one transaction with an advisory lock on (perk, student), the same pattern you used for the 20-open-posts limit, and write a concurrency test that fails without the lock.

## Redemption flow (no partner app, no POS integration)

1. Student opens **Perks** (a section on the Me page or a 5th tab, never the home tab), taps a perk they are eligible for, then taps **Use now at the counter**.
2. The app creates a `perk_claim` and shows a full-screen pass: the 6-character code, a QR of the same code, the student's profile photo, display name and school, and a **moving clock/animation** so a screenshot looks obviously dead. Valid for 10 minutes.
3. Staff open their **station link** (bookmarked on the counter phone, PIN once per device), type or scan the code, see the perk title, terms and the student's photo, and tap **Redeem**. The claim becomes `redeemed`; the student's screen flips to "Used ✓" within a few seconds (same polling you use in chat).
4. Unused claims expire via the jobs tick; the student can claim again later.
5. The student can tap **Shop didn't honor this** on the claim, which writes a `perk_report`. Three reports on a partner in 30 days pause it for your review.

Why not one shared code like "STUDI10"? Shared codes leak to Facebook groups within days and partners stop trusting the program. A one-time, 10-minute code tied to a photo can't be reused, and staff verification takes one tap.

Partners never get student lists. They see one claim at a time, and a monthly count ("143 redemptions, 61 from TUP"). Say this in the privacy policy before launch.

## Tying perks to real marketplace use

Ranked by how strongly each one drives actual deals:

1. **Partner cafés as meet-up spots (the core idea).** Partners with `is_meetup_spot` appear as suggested places when students schedule a handover (Phase 11). A deal completed at a partner spot unlocks that partner's perk for *both* students (`unlock = meetup_here`). The partner gets two paying customers per deal, students get a safe public place plus a coffee discount, and you get completed deals. Nobody else in the UNiDAYS / Student Beans / Booky space can offer this, because they have no marketplace.
2. **Earned tiers from completed deals.** Welcome perk on sign-up (small, 1 per student, ever). Bronze after 1 completed deal, Silver after 3, Gold after 10 in the last 90 days. Most partner perks sit at Bronze or above. Counts come from completed deals, like items sold.
3. **Unlock moment inside the deal.** When both students confirm handover, the confirmation screen says "Deal done. You unlocked ₱10 off at Kape ni Juan" and sends a notification. The reward lands right after the behaviour you want.
4. **Perks inside listings.** On a post in a matching category (Food, Clothing, School supplies, Services), show one relevant partner perk under the details: "Meet here: Kape ni Juan, ₱10 off for Studiskarte deals". Perks follow the marketplace, not the other way round.
5. **Seller perks.** Sellers with recent completed deals and a fast reply time get seller perks (print shop discounts, packaging, photo studio). This keeps supply healthy, which a buyer-only reward never does.
6. **Weekly limits instead of streak pressure.** Per-student limits (1 per perk per week, plus a monthly cap across all perks) protect partners' budgets. If you add streaks later, count *completed deals* or *replies within a day*, never posts or app opens, because those reward spam.

### Stopping deal farming

Once deals unlock perks, two friends will fake deals. Make it costly:

- Count a deal toward tiers only if the price is at least ₱50 (or it is free and both left reviews), and at most **1 counted deal per pair of students per 30 days**.
- Accounts younger than 7 days don't earn tiers.
- `meetup_here` perks need the deal's place to be the partner spot *and* the claim to be redeemed at that partner's station, which a fake deal still has to show up for.
- An admin view of students whose completed deals are mostly with the same 1-2 people.

This doesn't make fraud impossible, only not worth ₱10. Keep perk values small enough that this stays true.

## Launch plan (one person, no team)

**Before building:** Phase 11 (handover) and Phase 13 (reviews) should be done, since earned perks depend on completed deals. A welcome-perk-only pilot could ship earlier but proves little.

1. **Pick one campus** where you already have users (TUP Manila). Walk the street around it.
2. **Target 5-8 partners**: 2-3 cafés or milk tea shops, a print/photocopy shop, a laundry or repair service, one clothing or thrift seller, and one student-run business already selling on Studiskarte.
3. **The pitch (one page):** free to join; you fund only the discount you choose; you set the budget cap; every customer is a verified student; we send you students who meet *at your shop*; you get a monthly redemption count. Booky-style partners care about foot traffic, and meet-up spots deliver it.
4. **Simple written agreement:** partner funds the discount, honours valid codes until the end date, can pause with notice; Studiskarte can pause a partner after complaints; no student data is shared.
5. **Pilot for 6 weeks.** Set up partners yourself through an admin page (no partner sign-up form yet). Measure:
   - share of perk users who complete a deal within 30 days (the key number; aim for over 30%)
   - completed deals at partner spots per week
   - redemptions per partner, and refusals reported
6. **Then expand** campus by campus, and only then consider charging partners (featured placement or a small fee per redemption).

## Honest risks and costs

- **Your time is the biggest cost.** Signing partners, training counter staff, chasing refusals and answering students is sales and support work on top of building. Start with few partners.
- **Code leaking.** Solved mostly by one-time 10-minute codes with photo. Staff who skip the station link and accept any screen are the remaining hole; the "didn't honor / wasn't checked" report and partner reviews catch it.
- **Partner fraud or disappointment.** Partners may stop honouring codes, change terms quietly, or close. Students then blame Studiskarte. Reports, auto-pause and short pilot terms limit the damage. If you ever pay or charge per redemption, a partner could inflate redemptions through fake student accounts, so don't tie money to redemption counts until there is an audit.
- **Deal farming** (above). Keep perk values small.
- **Alumni and dropouts.** Some schools keep email accounts after graduation. Consider re-verifying the school email once a year for perk eligibility.
- **Legal (check, I haven't verified Philippine specifics).** Plain discounts given by a shop are normally the shop's own promotion, but **raffles, contests or "chance to win" promos need a DTI sales promotion permit** in the Philippines, so avoid those. Showing a student's photo and name to partner staff and keeping redemption records is personal data under the **Data Privacy Act (RA 10173)**: add it to the privacy policy you still owe for Phase 16.
- **Hosting.** Vercel's Hobby plan is for non-commercial use. Once you sign businesses, even for free, plan for Vercel Pro (about $20/month) and register the business (DTI, and BIR once it earns). Neon Free should handle the extra tables at pilot scale.
- **Scope creep.** It's another product surface (partner admin, station pages, reports). Keep v1 to the tables and flow above, set up by you through an admin page, and don't build a partner self-serve portal until the pilot proves the meet-up-spot idea.

## Where perks alone fit in the phase plan (superseded by the build order in Part 2)

Add **"Perks"** as a new phase after Phase 14 (Safety, because it brings the admin page you'd reuse) and before release hardening, or right after Phase 16 if you want launch to stay small. Suggested slices:

1. Tables, admin page to add partners/stations/perks, welcome perk, claim pass, station redeem page, expiry job.
2. Tiers from completed deals, unlock screen and notification after handover, anti-farming rules.
3. Partner meet-up spots in scheduling, `meetup_here` perks, perks shown on matching posts.
4. Reports, auto-pause, monthly partner report.


---

# Part 2: Diskarte progress (XP, levels, badges, quests, trust, streaks)

Your direction is right: the discount is the prize, not the product. Here is how to build it on the blueprint so the game rewards *being a good marketplace member*, not just opening the app.

## One rule before anything else

**Opening the app earns nothing.** No XP for logging in, and no daily login streak. If logging in pays, students open, tap and leave, which is exactly the habit you said you don't want. Daily habits come from things worth checking instead: flash drops, quests ending soon, a deal to confirm. XP comes only from actions that make the marketplace better for someone else.

## Five pieces, and how they differ

| Piece | What it measures | Can it go down? | Used for |
|---|---|---|---|
| **XP** | Marketplace actions done | Only when an action is reversed (fake deal, removed post) | Levels |
| **Level** | Total XP bands | Never, except after reversals | Unlocking perks, a profile badge |
| **Trust** | How safe you are to deal with | Yes | Gating the best perks and barkada deals; anti-fraud |
| **Badges** | One-time achievements | No | Profile pride, some unlock a perk |
| **Weekly streak** | Weeks in a row with a meaningful action | Resets | Streak perks, quests |

Keeping **Trust separate from XP** is the most important design choice. XP rewards activity, which can be farmed. Trust is built from things that are hard to fake (completed deals with many different people, ratings from many different people, account age, no upheld reports). The best rewards need *both*.

## Which actions earn XP

| Action | XP | Limit | Code hook |
|---|---|---|---|
| Finish profile (photo, name) | 20 | once | `me/settings/actions.ts` |
| First post | 30 | once | `lib/posts/create.ts` |
| A post gets its first message from another student | 5 | 3 posts a day | `lib/messaging/send.ts` (first message in a conversation) |
| Reply to a new conversation within 1 hour | 3 | 5 a day | `lib/messaging/send.ts` |
| **Complete a deal** (both confirm) | **50** for each side | counted deals only, see abuse rules | Phase 11 `deals/confirm.ts` |
| Complete a deal at a partner meet-up spot | +20 | 1 a day | Phase 11 + perks |
| Leave a review | 10 | once per deal, **same XP whatever the stars** | Phase 13 `deals/review.ts` |
| Receive a 4-5 star review | 10 | counted deals only | Phase 13 |
| Weekly quest completed | 20-100 | per quest | quests job |
| Redeem a stamp card or barkada deal | 10 | 1 a day | perks |

Making a deal is worth far more than anything else, so the fastest way to level up is to trade. Posting earns little on its own, because rewarding posts would fill the feed with junk. Messages earn nothing on their own.

**Levels** (names are only a suggestion): 1 Baguhan (0 XP), 2 Diskarte (150), 3 Madiskarte (500), 4 Diskartero (1,200), 5 Alamat ng Kampus (3,000). Roughly, level 2 means about one completed deal, level 3 about five to six, and level 5 a regular trader over a semester.

**Trust** (0-100, computed nightly and never typed in): counted completed deals with distinct people (up to 40), average rating received from at least 3 distinct reviewers (up to 30), share of completed deals you reviewed (up to 10), account age (up to 10), minus points for upheld reports and deals cancelled by you. Show it as a simple label ("Trusted trader") instead of a number, so nobody chases decimals.

## Weekly streaks, not daily

Deals don't happen every day, so a daily streak would push students into fake activity. Use a **weekly streak**: a Manila week counts if you did at least one of: completed a deal, replied within a day to a buyer, or posted a listing that got a message. Allow one **freeze** a month (a missed week doesn't reset). Rewards at 3, 6 and 12 weeks. That fits a semester rhythm.

## Quests

Short, specific goals, mostly weekly, made by you in the admin page:
- "Complete 1 deal this week" (100 XP)
- "Reply to every new message within a day this week" (40 XP)
- "List 3 school items before finals week" (40 XP, ends on a date)
- Partner quests: "Meet up at Kape ni Juan for a deal" (perk + 30 XP)
- Onboarding quests (one-time): add a photo, follow 3 classmates, make your first offer, finish your first deal

Quest progress is counted from the XP ledger inside the quest's dates, so you never store a running counter that can drift.

## Badges

One-time achievements shown on the profile: First Sale, First Deal, 10 Deals, Fast Replier (reply time "within an hour", Phase 13), Fair Rater (reviewed 10 deals), Meet-up Regular (5 deals at partner spots), Campus Pioneer (one of the first 100 at a school), Streak 6 and 12. Some badges can unlock a perk ("Fast Replier gets ₱20 off printing").

## Data model (adds to Part 1)

```
xp_event                 -- the ledger; everything else is derived from it
  id uuid pk
  student_id -> student
  action text            -- deal_completed, review_given, quest_completed, ...
  points int             -- positive, or negative for a reversal
  source_type text, source_id uuid   -- the deal, review, post, quest...
  counted bool           -- false if an abuse rule refused it (kept for audit)
  created_at
  UNIQUE (student_id, action, source_id)   -- the same deal can't pay twice

badge          (slug pk, name, description, rule text)          -- seeded, like categories
student_badge  (student_id, badge_slug, earned_at, source_id)   -- PK (student_id, badge_slug)

quest
  id, slug, title, description, kind (onboarding, weekly, dated, partner)
  action text, target_count int     -- "deal_completed" x 1
  xp_reward int, perk_id null -> perk
  starts_at, ends_at, status
quest_completion (student_id, quest_id, period_key text, completed_at)
  UNIQUE (student_id, quest_id, period_key)   -- period_key = '2026-W42' for weekly

student_progress         -- a cache rebuilt by a job, never written by hand
  student_id pk, xp int, level int, trust int, streak_weeks int,
  freezes_left int, updated_at

perk (Part 1) gains:  min_level int, min_trust int, badge_slug null,
                      format text  -- single | stamp_card | flash | barkada
                      stamps_needed int null, group_size int null
```

Why a ledger: the blueprint already says counts and ratings are derived and never entered directly. A ledger keeps that rule, lets you reverse XP from a fake deal with one negative row, and lets you change level thresholds later without migrating anything. `student_progress` is just a cache so the feed and profile stay fast on Neon Free.

**How XP is awarded:** inside the same database transaction as the action (the deal confirm, the review insert), through one function, `awardXp(tx, studentId, action, sourceId)`. That function applies the caps and abuse rules and writes `counted = false` with a reason when it refuses. Never award XP from the browser. Add database tests in your existing style: the same deal cannot pay twice, caps hold under concurrent requests (and fail without the lock), and a reversal brings the level back down.

## Abuse rules

| Trick | Defence |
|---|---|
| Two friends fake deals | A deal counts only if the price is ₱50+ (or free with both reviews), **at most 1 counted deal per pair of students per 30 days**, and both accounts are 7+ days old. Trust only rises with *distinct* partners, so farming with one friend stalls fast. |
| Rating swaps (5 stars for 5 stars) | Giving a review pays the same XP for 1 star or 5. Receiving stars only feeds Trust after 3 distinct reviewers. An admin list flags pairs that always rate each other 5. |
| Posting junk for XP | A post pays only when another student messages about it, capped per day. |
| Message spam | Messages pay nothing; only a fast reply to a *new* conversation pays, capped. |
| Many accounts | Each needs a real `.edu.ph` inbox (you already enforce this). Barkada members and deal partners must be different students, and trust gates the valuable perks. |
| Reports | An upheld report (Phase 14) reverses that deal's XP and lowers Trust. |

None of these make cheating impossible. They make it cost more than a ₱10 to ₱30 perk is worth, which is the real goal.

## How levels unlock perks

- **Level 1**: one welcome perk, and you can see every perk with its lock ("Reach Madiskarte to unlock"). Locked perks you can see are the main reason to trade.
- **Level 2+**: everyday partner perks (₱10-₱15 off).
- **Level 3+ and Trust "Trusted"**: flash drops and barkada deals.
- **Level 4+**: better perks, early access to flash drops.
- **Level 5**: special perks partners give to top traders; good for partner marketing too.

## Your four partner formats, fitted in

**Stamp cards.** A perk with `format = stamp_card` and `stamps_needed = 4`. Each visit, the student shows a claim code and staff tap "Add stamp" on the same station page; each stamp is a redeemed `perk_claim` with no discount. After the 4th stamp the app issues the reward claim. Limit 1 stamp per student per partner per day. Small shops like this best, because they pay only on the 5th visit.

**Flash drops.** A perk with `format = flash`, a short `starts_at`/`ends_at` (2:00-2:30 PM) and a small `total_limit` (first 30). Partners pick their dead hours. Send a Web Push alert (Phase 9) only to students who turned on "Flash drops near my school", **at most one alert a day**, so alerts stay welcome. Level 3+ gets the alert 10 minutes early. This is what makes students check the app between classes.

**Barkada deals.** A perk with `format = barkada` and `group_size = 3`. One student starts a group and gets a group code; friends join by tapping the share link (verified students only, each different). When the group is full within 2 hours, everyone shows one group pass at the counter and staff redeem it once. A new student who signs up through a barkada link gives the starter a bonus after the newcomer's **first completed deal**, not on sign-up (otherwise people farm sign-ups). New tables: `perk_group` (perk, starter, code, expires_at, status) and `perk_group_member` (group, student, joined_at), unique per (group, student).

**Tipid maps.** Partners get `price_from`, `tags` (wifi, outlets, aircon, open late, study-friendly) and `area`. You make **guides** in the admin page ("Eat under ₱75 near TUP", "Study spots with outlets under ₱100"): a `guide` table plus `guide_partner` rows in order. Start with simple lists by area, which need no map provider. Add a real map later (Leaflet with OpenStreetMap is free) once there are enough partners to need one. Partner meet-up spots from Part 1 appear in these guides, which ties planning, meeting and trading together.

## Build order, mapped to the blueprint

The blueprint's Stage 1 business logic should get a new **Rewards** domain (Revision 3) with these rules, and go through your usual approval before code, the same way the other phases did.

| Step | When | What ships | Depends on |
|---|---|---|---|
| **G0 Ledger** | Inside Phase 11 (handover) | `xp_event`, `awardXp`, abuse rules for deals; awards recorded quietly, **no UI yet** | Phase 10 (done) |
| **G1 Progress** | Inside Phase 13 (reviews) | Review XP, Trust, levels, badges, `student_progress` job, level and badges on profile | Phase 11, 13 |
| **G2 Perks v1** | New phase after Phase 14 (safety and admin) | Part 1: partners, stations, single perks gated by level and trust, welcome perk, claim pass | Admin page from 14 |
| **G3 Habits** | Next | Weekly streaks with freezes, onboarding and weekly quests, unlock screen after a deal | G1 |
| **G4 Partner formats** | Next | Stamp cards, flash drops with opt-in alerts, partner meet-up spots in Phase 11 scheduling | G2, Phase 9 |
| **G5 Social and discovery** | After the pilot shows it works | Barkada deals with referral bonus, tipid guides, then maps | G4 |

Starting G0 early is cheap and pays off: by the time levels appear, students who have been trading already have their history and start above level 1, which rewards your early users.

## What to measure

- Share of perk users who complete a deal within 30 days (from Part 1; the key number)
- Completed deals per active student per month, before and after levels launch
- Share of counted vs. refused XP (a rising refused share means people are trying to farm)
- Flash drop redemptions per alert sent (if low, send fewer alerts)
- Partner repeat visits from stamp cards (the number that keeps partners in the program)
