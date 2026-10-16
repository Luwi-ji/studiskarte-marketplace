# Studiskarte Perks: partner discounts that feed the marketplace

Planning draft, 2026-10-16. Nothing in the code changed. Based on the repo as of commit `dac027c` (Phase 10, offers and reserve).

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

## Where it fits in the phase plan

Add **"Perks"** as a new phase after Phase 14 (Safety, because it brings the admin page you'd reuse) and before release hardening, or right after Phase 16 if you want launch to stay small. Suggested slices:

1. Tables, admin page to add partners/stations/perks, welcome perk, claim pass, station redeem page, expiry job.
2. Tiers from completed deals, unlock screen and notification after handover, anti-farming rules.
3. Partner meet-up spots in scheduling, `meetup_here` perks, perks shown on matching posts.
4. Reports, auto-pause, monthly partner report.
