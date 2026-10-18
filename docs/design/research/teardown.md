# Marketplace teardown: Facebook Marketplace, Carousell (PH), Vinted, Depop, Mercari, and campus marketplaces

Date of research: 2026-10-18. Author: ResearchTeardown (research only; no application code touched).

## 0. How to read this document

**Scope.** Eight areas per app: first run, feed and browse, listing creation, listing page, messaging and offers, handover and reviews, notifications, scams and safety. Then campus-specific marketplaces. It ends with (a) a table of patterns found in 3+ apps and (b) a list of patterns that differ, with the reason.

**Evidence labels.** Every source has an ID such as `[C5]`. Section 9 maps each ID to its URL and one-line confidence (strong, medium, weak). A claim with no ID is my inference and carries the tag `[INFERENCE]`.

- **strong**: first-party help centre or newsroom, or a peer-reviewed study.
- **medium**: credible press or practitioner analysis, or first-party blog that may be dated.
- **weak**: vendor marketing, a single anecdote, or a search-result snippet I could not open in full.
- **(obs)**: my own first-hand look, 2026-10-18, logged out, headless Chromium at 390×844 px (phone width), **mobile web, not the native apps**. Facebook, Carousell, Vinted, Depop and Mercari websites were opened. I did not sign in, so anything behind a login (chat screens, the listing form, seller dashboards) is described from help centres, not seen. App and web layouts can differ. Treat (obs) as medium confidence.

**Known gaps (stated once, plainly).**
- Facebook's help pages are JavaScript pages. I read them through a real browser, but the Facebook listing form, chat and rate-seller screens could not be seen (login wall). Facebook's photo limit for a listing was not found.
- Facebook "Rate a Facebook Marketplace seller" opens only on phone apps, so I could not read it `[F3-rate]`.
- The CHI 2024 Facebook Marketplace paper itself returned HTTP 403; I rely on the UBC summary of it `[F12]`.
- Mercari's engineering post on price guidance returned HTTP 403; I cite only its title and the search snippet `[M6]`.
- Carousell's PH blog guides date from 2019–2020. Where help-centre or live (obs) evidence is newer I say so.
- "Yaak" as a campus marketplace: **I found none.** Searches returned only an API-client tool and Yik Yak (an anonymous campus chat app, not a marketplace) `[K7]`. Not used.
- Nobody publishes measured "time to list". The only figures are marketing claims (Carousell "30 seconds" to photograph and list `[C1]`; Univo "10 seconds" `[K2]`). No independent measurement found.

## 1. Why these five, and the key difference from Studiskarte

| App | Money handled by platform? | Closest to Studiskarte because… |
|---|---|---|
| Facebook Marketplace (PH) | No in-app payment in PH: Meta's own page says Messenger payments are not available in the Philippines `[F14]`. Local pickup and chat. | Same "no money" position, same Philippine market, the app students already use. |
| Carousell (PH) | Per its PH blog, "Carousell is not involved in payments or delivery" (2019–20) `[C1]`; a "Buy" button with buyer protection exists in some categories and regions `[C5][C6]`; whether it is live in PH today is **unverified**. | Same market, chat + offer + reviews flow, services categories, school-based groups `[C3]`. |
| Vinted | Yes: money held until the buyer confirms; shipping labels `[V5][V2]`. | Best-documented offer, review, notification and photo guidance. |
| Depop | Yes: payments and Buyer Protection `[D1][D5]`. | Best social proof on the listing page; younger audience. |
| Mercari | Yes: charged on accepted offer, released after buyer rates `[M2][M3]`. | Binding-offer contrast; "Known for" review design. |

**Consequence.** Vinted, Depop and Mercari solve trust with escrow, tracking and refunds. None of that transfers to a system that never moves money. The patterns that transfer are the ones about presentation, negotiation, reputation and notification. Facebook and Carousell PH are the true peers on safety, and both rely on advice and reporting, not guarantees `[F1][F4][C6]`.

---

## 2. Facebook Marketplace

### 2.1 First run and onboarding
- No separate onboarding. Marketplace is a menu item and tab inside the Facebook app (Menu → Marketplace) `[F2]`. You need a Facebook account; the sign-up form asks name, birthday, gender, mobile or email, and password (obs, facebook.com/r.php).
- Age gate: "You must be an adult, based on the laws in your country" to use Marketplace `[F1]`.
- Logged out, the Manila page shows a grid of live items (price, title, location) and a "See more on Facebook" login overlay on top (obs, facebook.com/marketplace/manila). So browsing is previewed but not freely open.
- Marketplace launched in the Philippines in January 2018 `[F17]` (title and date from the Inquirer headline; article body not read).

### 2.2 Feed and browse
- Two-column photo grid at 390 px. Each card shows price, title and location only; no seller, condition or rating on the card (obs).
- Top controls: a profile chip, **Sell**, **All Categories**, a search box, and a "Today's picks" feed (obs).
- Sorting: Suggested, Distance, Date listed; location can be changed `[F9]`.
- Saved searches with notifications exist; notification categories include updates, saved searches and tips for sellers `[F15]` (snippet only, weak). Users report saved-search alerts being unreliable `[F18]` (weak, anecdote).

### 2.3 Listing creation
- Mobile: Menu → Marketplace → Sell → create listing; add title, price, category, photos (or a video); condition; description; location; pickup/drop-off method; optionally hide from Facebook friends; choose where it appears: public Marketplace, selected groups, or both; Publish `[F2][F11]`.
- "Next" stays grey until required fields are filled. Price 0 marks the item Free `[F2]`.
- Philippine cap: **10 new listings per week** `[F7]`.
- March 2026: Meta AI can build a draft from uploaded photos, fill details and suggest a price from similar nearby items; sellers can pre-write an AI auto-reply for "Is this still available?" `[F10]`. (US/Canada announcement; PH availability not stated.)
- Edit, delete, renew, mark as sold or pending are all under Selling → Your listings `[F8]`.
- Multi-quantity listings show remaining stock when 10 or fewer are left; a single item reads "Only 1 for sale" `[F8]`.

### 2.4 Listing page
- Logged out I could not open an item (login wall) (obs). From help text: the seller profile shows seller and product ratings (4–5 stars count as positive, 3 or below negative), seller badges (Very Responsive, Reliable Shipper, Super Seller, Highly Rated), and a link to the personal profile for mutual friends and join date `[F3]`.
- A Meta AI profile summary now shows how long the seller has been on Facebook, friend count, listing history, item types and ratings `[F10]`.

### 2.5 Messaging and offers
- Buyers either send a custom message or tap one button that sends "Is this available?" `[F6]`. This ritual is so common that Meta built AI auto-replies for it `[F10]`.
- Negotiation is by Messenger. I found no first-party description of a formal offer object in the sources I could read; Business Insider only advises saying you are "open to offers" and lists slang (OBO, PUP, NIL) `[F11]`.

### 2.6 Handover and reviews
- Sellers set **Pending**, **Sold** or **Available**. Marking Pending or Sold automatically messages everyone who asked about the item; Sold hides the listing from everyone else `[F5]`. Marking Available reopens archived chats `[F5]`.
- Ratings: after a purchase on the phone app, buyers can rate a seller; 4–5 stars are "positive" `[F3]`.
- Evidence of friction: in a 42-person interview study, "many participants hesitated to rate sellers, citing physical safety concerns and the challenge of balancing feedback with anonymity" `[F12]`.

### 2.7 Notifications and re-engagement
- Marketplace notifications are a separate settings category (updates, saved searches, tips for sellers) `[F15]` (weak). New-listing alerts rely on saved searches.

### 2.8 Scams and safety
- Meta names four scam families: overpayment or refund tricks, off-platform contacts (phone or email early in the chat; most common in vehicles, rentals, home goods), phishing links, and defective or fake items (underpriced, rushed buyer) `[F1]`.
- Users can report the buyer, the seller or the listing `[F1]`. If an order goes wrong, contact the seller first; after 2 business days without a reply, contact Facebook `[F1]`.
- Meeting advice: public, well-lit place; do not change the agreed place; keep home address private; share the plan with a friend; **"Send plan" in Messenger** sends location, date and time and removes it after the meeting; share live location `[F4]`.
- Research: interviewees watched transactional signals (politeness, odd grammar, negotiation tone) because the platform gave few; researchers recommended profile verification balanced with privacy `[F12]`.
- Philippine practitioner guide (weak to medium): reservation-fee scams, fake GCash or Maya screenshots, stolen photos, OTP requests; Facebook Purchase Protection shown as unavailable in the PH `[F13]`.

---

## 3. Carousell (Philippines)

### 3.1 First run and onboarding
- Browse first, register later. Logged out, the home page has search, a trending-searches line, category tiles and a "Stay safe from ticket scams" banner; Register and Login sit top right (obs, carousell.ph).
- The gate is at the first commitment: on a listing, the offer button reads "Sign in to make offer" (obs).
- On mobile the first screen after sign-in is **Explore**, built around categories `[C3]`.
- Profile trust starts with **phone verification** `[C1]`; users without it show a "Not Verified" badge in chat `[C7]`.
- A "Carousell College" help hub teaches selling and visibility tools `[C12]`. This is seller education, not a campus programme.

### 3.2 Feed and browse
- Two ways in: category tree (two or three levels, e.g. Mobile Phones & Gadgets → Mobile Phones → iPhone → iPhone 15 Series) and search (obs). In 2019 the platform advertised 194 categories `[C3]`.
- The search box is scoped: it says "Search Carousell" or the category you are in, and keeps recent searches. You can also search users and groups `[C3]`.
- Filters: location (map or distance), category, sort (Popularity, Recency, Price, Nearest), price range, **deal options (meet-up, delivery, both)**, and condition (new or used) `[C4]`. The blog warns that PHP 0 items pollute results and advises setting a minimum price `[C4]`.
- Cards on mobile web show the seller avatar, handle and "time ago" above the photo, then title and price (obs). Result pages have a **"Save this search"** toggle (obs).
- Curated "Special Collections" sit in the Browse tab, refreshed weekly `[C3]`.
- **Groups**: interest-, location- and school-based groups that you can join to buy and sell with similar users `[C3]`.

### 3.3 Listing creation
- Sell (+) → take or choose up to 10 photos → fill required fields → "List it!". If the button is inactive an error names the missing field `[C5]`.
- "List similar item" copies the previous listing's attributes except photos, for batch posting `[C5]`. New items appear at the top of their category `[C5]`.
- Category-specific attributes appear on the finished page: an iPhone listing showed Condition, Model, Storage, Color, Battery Health and Origin of goods (obs). Condition carries a one-line definition ("Like new: Used once or twice. As good as new.") (obs).
- Guidance: never use stock photos; show defects; say why you are selling; give size, colour and use `[C1]`.
- Limits: since Sept 2025 selected PH categories have free monthly quotas (e.g. 5 per month for Mobile Phones); quota is not freed by deleting or marking sold; **listings never expire** `[C8]`.

### 3.4 Listing page (above the fold, mobile web, logged out, obs)
1. Breadcrumb of the category path.
2. Photo carousel.
3. Seller card: avatar, name, @handle, rating ("No ratings yet") and a **Chat** button.
4. Price (PHP 40,000), condition badge, a **Meetup** chip and the named meeting place.
5. Attributes, then description (truncated with "Read more"), "Posted 9 hours ago".
6. "Meet the seller": badge ("Professional Seller"), rating, "2 years on Carousell", reviews, and the line "Reviews are given when a buyer or seller completes a deal."
7. Sticky actions: Chat and Make Offer.

Badge system in chat: Admin, New User, Not Verified (no phone verification), Verified User (ID verification), Verified Business, Certified Partner, Preferred Merchant, Carousell Official `[C7]`.

### 3.5 Messaging and offers
- Chat is the core. The blog says you can see if the seller has read your message and their reply time `[C2]`. The help centre has "Response Rate" and "Rate chat" articles `[C7]` (titles only). Chat can be archived; the inbox filters All, Buying, Selling, Archived `[C2]`.
- If the seller listed a mobile number, SMS or call is possible `[C2]`.
- **Make Offer** can be tapped on the listing or inside chat. Carousell treats it as a formal commitment: "it is not in the spirit of Carousell to back out", and the seller's **Accept Offer** "seals the deal" `[C2][C1]`. This acceptance is also what unlocks reviews `[C6]`.
- Sellers may accept more than one offer (an FAQ exists; details not read) `[C5]`.

### 3.6 Handover and reviews
- Payment and delivery are arranged in chat (bank transfer + courier, or cash on delivery and meet-ups) `[C1]`. Help text recommends meeting within 5 days and asking for payment after the item is handed over (or the service completed) `[C5]`.
- Reviews appear only after offer accepted. Buyer and seller each have **14 days**. The review stays hidden until the other side submits or 14 days pass; once published it cannot be edited or deleted. Marking an item Sold **before** an offer is accepted blocks reviews `[C1]`.
- Rating: 1–5 stars on three questions (payment collection, meet-up or shipping, communication) plus a comment `[C2]`.
- Listing states: Active, Inactive (over quota), Reserved, Sold. Reserved and Sold items stay on the profile but accept no new chats or offers `[C8]`.

### 3.7 Notifications and re-engagement
- Push and email are configurable `[C13]` (title only). **Saved Search**: in 2019 up to three saved queries `[C14]` (snippet only, weak); the live toggle is confirmed (obs).
- Notices when listings are hidden for inactivity (help title) `[C15]`.
- Weekly promotions and Special Collections invite sellers to join themes `[C1]`.

### 3.8 Scams and safety
- Official advice: use the Buy button and Buyer Protection where offered; otherwise secure the deal with an offer; meet in well-lit public places; bring a friend; avoid carrying large cash; keep chat on the platform; never share OTP or card data `[C6]`.
- Category checks: electronics (receipt, serial), branded bags (authenticity card), appliances (demo at meet-up), event tickets (terms) `[C6]`.
- A scam section exists in help with **Philippine-specific titles**, e.g. "Commission + Pa-Abono Rider" scam, fake remittance fees, fake ad verification, fake reviews `[C6]` (article list on that page). Home page carries a scam banner (obs).

---

## 4. Vinted

### 4.1 First run and onboarding
- Sign-up page: Google, Apple, Facebook, or email, with a country picker (obs, vinted.com/member/register). Catalogue browsing is open logged out (obs).
- Personalisation: categories, sizes, brands and followed members shape the feed `[V12]` (snippet).
- Trust by **linking Google or Facebook**; others see the verification on your profile `[V9]`.

### 4.2 Feed and browse
- Two-column grid; each card: brand, "size · condition", price, price including the buyer fee, a **"Bumped"** label on paid promotions, and a small integer I read as the favourites count `[INFERENCE]` (obs). A **Filters** button sits under the search bar; results counter reads "500+ results" (obs).
- Browse is catalogue-first: top-level Women, Men, Designer, Kids, Home, Electronics, Entertainment, Hobbies & collectibles, Sports `[V1]`.
- No sale fee for sellers; the buyer pays a protection fee shown as "incl. Vinted fee" `[V2]` (obs).

### 4.3 Listing creation (six steps)
1. Photos, up to 20. First photo is a full view, no collages; use daylight, no flash or filters; show defects; avoid showing your face; no stock photos `[V1][V10]`.
2. Title and description (no unrelated brand hashtags).
3. Category (examples of right and wrong paths are given), then **brand** with a "No brand" fallback.
4. Condition.
5. Price. Guidance by condition: New/Like new 60–80% of retail, Very good 40–60%, Good 20–40%; price lower than the catalogue average to sell faster; $1–$1000 in the US `[V7]`.
6. Package size `[V1]`.
- An automated check follows: usually within 1 minute, sometimes 3–4 days `[V1]`. No duplicate listings: use one listing and say you have several `[V1]`.

### 4.4 Listing page (obs)
- Top: photos with favourites count on the image, breadcrumb, then the details card: title, "8 · Very good · Nike · Uploaded 8 min ago", price and price incl. fee with a shield icon.
- Sticky bar at the bottom: **Make an offer** and **Buy now**. Below: attribute table, "Message seller", a "Shop and sell safely" card explaining refund policy, and the seller card: username, review count, **"Frequent Uploads: Regularly lists 5 or more items"**, **"Last seen 17 min ago"**, more items by the member, similar items (obs).

### 4.5 Messaging and offers
- "Ask seller" opens a chat; help repeats "keep your conversation on the Vinted platform", and suggests Make an offer to get a better price `[V8]`. Anti-spam filters block suspicious message content `[V5]`.
- Offers: up to 40% below the listed price, accepted or rejected by the seller, who can counter. **Non-binding**: the item stays available to others until a buyer presses Buy now. A seller-initiated lower price is shown only to that buyer. Buyers limited to 25 offers a day. Offer covers the item, not postage `[V3]`.
- Bundles with seller discounts exist `[V13]` (snippet).

### 4.6 Handover and reviews
- Shipping flow: send within 5 business days or the order auto-cancels; money released about 2 days after delivery is confirmed `[V2]`.
- Feedback only after a completed order; 1–5 stars with defined meanings (e.g. 3 = "OK or mixed… you got what you ordered, but the experience could have been better"); window **4 days**; **automatic positive feedback** if the buyer does not respond; automatic negative feedback for late shipment or manual cancellation. Authors can edit or delete their own feedback; recipients can reply `[V4]`.
- Feedback is not pre-moderated; removals follow reports `[V4]`.

### 4.7 Notifications
- Inbox bell lists: followed members list items, a favourited item drops in price or sells, your item is favourited, new follower, feedback received, new message. **In-app notifications cannot be turned off; push and email can.** There is a **daily cap** for non-priority notifications. Notifications stay about 7 days `[V6]`.

### 4.8 Scams and safety
- Purchases made with **Buy now** are protected: refund if the item does not arrive, arrives damaged or not as described (claim within 2 days); money held until the buyer confirms `[V5]`.
- Platform-level: spam filters on messages, risk scoring of listings and orders, 24/7 support, transparency report `[V5]`.
- Member-level: reviews only after real orders, verification, complete profile `[V5]`; "do not move your conversation to another app or SMS" `[V8]`.

---

## 5. Depop

### 5.1 First run and onboarding
- Sign-up web page offers only Apple or email (obs, depop.com/signup). Browsing is open logged out (obs).
- Home page has a taste quiz: "Answer three quick questions and we'll show you styles…" and "Buy safely: Depop Protection" (obs).
- Hero statistics on the home page (49M+ items, 1.1M+ new listings a day) are vendor claims (weak) (obs).

### 5.2 Feed and browse
- Two-column grid; each card shows brand, size and price (obs). Search results offer popular-brand chips, Filter and Sort; filters are Category, Brand, Price, Size, Color, Condition, On sale (obs).
- Visual Search: search with a photo `[D7]` (title only).
- **Saved searches**: up to 10 (tap the star in the search bar); opt-in to a **weekly** push for new matches `[D4]`.

### 5.3 Listing creation
- App: Sell in the bottom nav; up to **four photos and one video** (web: up to eight); description with up to five hashtags; category, shipping price, brand, condition; price with a **suggested range based on similar sold items, description, brand, size and colour**; Post listing `[D1]`. Drafts sync between app and web; "copy listing" speeds repeats `[D1]`. Prohibited terms stop a listing going live `[D1]`.
- Help note on photo count may be stale; the listing I opened showed four slides (obs).

### 5.4 Listing page (obs)
- Photo carousel with favourites count, then two **social-proof chips**: "In 3 people's bags" and "1 offer sent".
- Title, "Size XS • Like new condition • H&M", **Buy now**, sticky bar with price, **Make offer** and **Add to bag**.
- Just below: "All purchases through Depop are covered by Buyer Protection", "This seller often ships in 2 days", seller line "11 sold · Active today · (1)", Visit shop, **Ask a question**.

### 5.5 Messaging and offers
- **Make Offer** from the listing. Seller has **14 days** to accept, decline or counter; one active offer per item; offers are tracked in an Offers tab and in chat with statuses Accepted, Pending, Declined, Expired. Accepted offers give the buyer 14 days to buy at that price; the item is **not reserved**, others can still buy. Sellers may accept several offers; first to buy wins `[D2]`. Sellers can also **send offers**, and set auto-respond `[D2]`.

### 5.6 Handover and reviews
- Feedback: 1–5 stars plus a comment, after confirming the item was received and checked. **Cannot be edited once submitted** (you can delete your own). Rating is computed over a recent window, so it fluctuates. Incentivised reviews must begin with "Commissioned Feedback" `[D3]`.
- A Resolution Centre handles disputes `[D8]` (title only).

### 5.7 Notifications
- Weekly saved-search push; price-drop alerts on liked items (one Reddit user noticed the change; weak `[D9]`).

### 5.8 Scams and safety
- Buyer Protection line on every listing (obs); Depop Protection for sellers and Resolution Centre `[D3][D8]`. Abusive or prohibited terms are blocked at listing time `[D1]`.

---

## 6. Mercari

### 6.1 First run and onboarding
- Logged out you can browse, then hit a gate on action: "To like or purchase an item, or to chat with the seller, please create your account." Options: Google, Facebook, Apple, email; password strength meter; invite code field (obs, mercari.com/signup).
- Home shows category chips, top brands and **"See what's selling"**, a strip of recently **sold** items with prices (obs), which anchors buyers and sellers on real prices.

### 6.2 Feed and browse
- Dense grid (three columns at 390 px on web) showing price, favourite counts, **% price-drop badges** and a SOLD overlay on sold items (obs). Search has "Save this search. Get notified when new items are posted" (obs).

### 6.3 Listing creation
- Up to **12 photos**, cover photo first and reorderable; the app may **recognise the item and prefill details**; add description, brand, category, condition; price $1–$2,000 (up to $5,000 for authenticated categories, identity verification above $2,000); **Smart Pricing** (set a price and a floor, price steps down with demand); **Save draft**; shipping weight step then carrier options `[M1]`.
- "The more accurate a listing is, the higher it will appear in search." `[M1]`
- Mercari engineering describes a machine-learning **price guidance** system that recommends a price range at listing time `[M6]` (snippet; article not opened).

### 6.4 Listing page (obs)
- A **Similar items** strip with price and favourite counts sits **above** the main photo; then a large photo, then price (seen on the mobile web page).

### 6.5 Messaging and offers
- **Binding offers**: the seller has 24 hours to accept, decline or counter; on acceptance the buyer is charged immediately; minimum offer 75% of the listing price; bundle offers (2–10 items) `[M2]`.
- **Promote**: cutting a price by 5% or more boosts search placement and notifies everyone who liked the item `[M4]`.

### 6.6 Handover and reviews
- The buyer rates within 3 days of confirmed delivery; **the seller is paid when ratings are in**; if the buyer does not rate, a 5-star rating is applied automatically `[M3]`.
- Profile shows **"Known for"** compliments (public) and **"Things to improve"** (visible only to the person rated) `[M3]`.

### 6.7 Scams and safety
- Payment held until delivery and rating `[M3]`; identity verification for listings above $2,000 `[M1]`; prohibited items list `[M1]`.

---

## 7. Campus-specific marketplaces

| Case | What it shows | Confidence |
|---|---|---|
| **Facebook university buy/sell groups** | The incumbent. Rules are set by moderators, e.g. a UGA group admits only current parents, students or alumni "for the safety of all" `[K4]`; the UST Faculty of Engineering group announced on 23 Aug 2026 that it no longer supports buying or selling uniforms, books, notes or reviewers but allows free pass-on `[K8]`; a parent asked for "a better or more secure way" to trade between students and was told to start a group with join questions to keep outsiders out `[K9]`. Posts in PH groups name payment modes in the text (e.g. "MOP: GCASH") `[K10]`. | weak (anecdotes) |
| **Carousell groups** | Interest, locale and **school-based** groups inside a general marketplace `[C3]`. | medium |
| **Hazaar, University of Manchester (Dec 2024)** | University email logins, 2,400 sign-ups, on-campus exchange (no queuing at post offices), items from toasters to textbooks, student ambassadors and four pop-up markets a year, born from end-of-year waste in halls `[K3]`. | medium (university press release) |
| **College Marketplace (US)** | `.edu` email only, 0% seller fees, optional paid featuring, payment arranged in person, "meet in safe public spots on campus" `[K1]` | weak (vendor site) |
| **Univo (US)** | `.edu` verification, in-app payments with buyer protection, "10-second" listing, one campus per launch `[K2]` | weak (vendor, waitlist) |
| **Campus Market (US)** | Sign-in with `.edu` required to see your school's marketplace `[K5]` | weak (snippet) |
| **CampusSwap, others** | Same `.edu` gate (search snippets) `[K6]` | weak |

**Reading.** Credible evidence is thin. The consistent campus pattern is a **membership gate by institutional email**, **per-campus scope**, **in-person exchange on campus** and **no or low fees**. The one outcome datum (Hazaar's 2,400 sign-ups) comes from a press release, not an audit. Nothing found tests Philippine campuses specifically, apart from anecdotes of Philippine school groups on Facebook `[K8][K10]`.

---

## 8. Side-by-side summary (what each app does)

| Topic | Facebook (PH) | Carousell (PH) | Vinted | Depop | Mercari |
|---|---|---|---|---|---|
| Browse before account | login overlay on a grid (obs) | yes (obs) | yes (obs) | yes (obs) | yes, gate at like/chat/buy (obs) |
| Card content | price, title, location (obs) | avatar, handle, time, title, price (obs) | brand, size·condition, price incl. fee, favourites (obs) | brand, size, price (obs) | price, favourites, % drop, SOLD (obs) |
| Filters named in sources | sort by suggested, distance, date `[F9]` | location, category, sort, price, deal option, condition `[C4]` | Filters button (obs) | category, brand, price, size, colour, condition (obs) | brand chips, search (obs) |
| Photos at listing | not found | up to 10 `[C5]` | up to 20 `[V10]` | 4 + 1 video app, 8 web `[D1]` | up to 12 `[M1]` |
| Price help | AI suggestion (US/CA) `[F10]` | blog tips `[C16]` | % of retail by condition `[V7]` | suggested range from sold items `[D1]` | Smart Pricing, guidance `[M1][M6]` |
| Offer | not first-party documented | formal, accept seals deal `[C2]` | non-binding, 40% floor `[V3]` | non-binding, 14 days `[D2]` | binding, 24 h, 75% floor `[M2]` |
| Review window | n/a found | 14 days, blind `[C1]` | 4 days, auto-positive `[V4]` | no window found; no edits `[D3]` | 3 days, auto 5 stars `[M3]` |
| Trust on listing | ratings, badges, join date, mutual friends `[F3]` | rating, badge, years, reviews (obs) | reviews, last seen, frequent uploads (obs) | sold count, active today, ships in 2 days (obs) | not seen |
| Expiry | renew exists `[F2]` | none (PH quota model) `[C8]` | not found | not found | not found |
| Money handled | no (PH) `[F14]` | mostly chat, Buy button regional `[C1][C5]` | escrow `[V5]` | escrow `[D1]` | escrow `[M3]` |

---

## 9. Sources

| ID | URL | Confidence |
|---|---|---|
| F1 | https://www.meta.com/safety/scam-prevention/marketplace-safety/ | strong: Meta first-party |
| F2 | https://www.facebook.com/help/561376580709359 (and fblite variant via search snippet, https://m.facebook.com/help/fblite/561376580709359) | strong |
| F3 | https://www.facebook.com/help/2912273018986831 | strong |
| F3-rate | https://www.facebook.com/help/1049892879215022 (phone-only; not readable) | n/a |
| F4 | https://www.facebook.com/help/2329750133711372 | strong |
| F5 | https://www.facebook.com/help/1680504982210398 | strong |
| F6 | https://www.facebook.com/help/1723922281209915 | strong |
| F7 | https://www.facebook.com/help/811082570742714 | strong |
| F8 | https://www.facebook.com/help/514314075439323 | strong |
| F9 | https://www.facebook.com/help/248514105820200 | strong |
| F10 | https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier | strong (first-party, US/Canada announcement) |
| F11 | https://www.businessinsider.com/guides/tech/how-to-sell-on-facebook-marketplace | medium |
| F12 | https://news.ubc.ca/2024/05/facebook-marketplace-trust-issues (paper: https://dl.acm.org/doi/10.1145/3613904.3641966, not fetched) | strong: peer-reviewed CHI 2024, 42 interviews, via university summary |
| F13 | https://sulit.ph/facebook-marketplace-scams-in-the-philippines-safety-guide | weak–medium: practitioner site |
| F14 | https://srt.facebook.com/help/messenger-app/190158534002528 (Messenger payments in the Philippines: not available; search snippet) | strong (first-party), snippet |
| F14-obs | https://www.facebook.com/marketplace/manila/ (my visit, logged out) | medium (obs) |
| F15 | https://m.facebook.com/help/messenger-app/2229494877335159 (Marketplace notification categories; search snippet) | weak (snippet) |
| F17 | https://technology.inquirer.net/71595/e-commerce-facebook-marketplace-social-media-buy-and-sell | medium (headline and date only) |
| F18 | https://www.reddit.com/r/FacebookMarketplace/comments/1fjuwt0/saved_search_notifications | weak (anecdote) |
| C1 | https://blog.carousell.ph/pro-tips/selling-guide/how-sell-carousell-guide | medium: first-party blog, 2019–20 |
| C2 | https://blog.carousell.ph/pro-tips/how-buy-on-carousell | medium, 2019–20 |
| C3 | https://blog.carousell.ph/pro-tips/categories-search-bar-collections/ | medium, 2019 |
| C4 | https://blog.carousell.ph/pro-tips/carousell-search-filters/ | medium, 2019 |
| C5 | https://support.carousell.com/hc/en-us/articles/115006246207-How-do-I-sell-on-Carousell | strong: help centre |
| C6 | https://support.carousell.com/hc/en-us/articles/115009696128-How-to-deal-safely-on-Carousell (article list shows PH-specific scam titles) | strong |
| C7 | https://support.carousell.com/hc/en-us/articles/36263482237849-Understanding-User-Badges-and-Indicators-in-Chat-A-Guide-to-User-Profiles | strong |
| C8 | https://support.carousell.com/hc/en-us/articles/40570401916441--Philippines-Category-based-listing-quota-for-selected-categories | strong |
| C9 | https://press.carousell.com/2021/12/01/carousell-report-finds-philippines-most-receptiveto-secondhand-in-the-region | medium (vendor survey: 92% of PH respondents bought secondhand) |
| C10 | https://www.carousell.ph/ and a listing page (my visit) | medium (obs) |
| C12 | https://blog.carousell.ph/carousell-college | medium (snippet) |
| C13 | https://support.carousell.com/hc/en-us/articles/115006193447-How-do-I-manage-my-push-and-email-notifications | weak (title only) |
| C14 | https://blog.carousell.ph/pro-tips/carousell-features | weak (snippet) |
| C15 | https://support.carousell.com/hc/en-us/articles/360011698513 | weak (title only) |
| C16 | https://blog.carousell.com/carousell-pro-tips/selling-guide/how-to-price-used-items-carousell | weak (snippet: "Apply the 30% rule") |
| V1 | https://www.vinted.com/help/4/375-uploading-step-by-step | strong |
| V2 | https://www.vinted.com/help/26-how-do-i-sell-my-items | strong |
| V3 | https://www.vinted.com/help/258-how-to-make-an-offer-to-a-buyer | strong |
| V4 | https://www.vinted.com/help/14-feedback-policy | strong |
| V5 | https://www.vinted.com/safety | strong |
| V6 | https://www.vinted.com/help/433 | strong |
| V7 | https://www.vinted.com/help/376 | strong |
| V8 | https://www.vinted.com/help/1594 | strong |
| V9 | https://www.vinted.com/help/406 | strong |
| V10 | https://www.vinted.com/help/48 | strong |
| V12 | https://www.vinted.com/help/31 (snippet) | weak |
| V13 | https://www.vinted.com/help/260-bundles-policy | medium (snippet) |
| D1 | https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item | strong |
| D2 | https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer | strong |
| D3 | https://depophelp.zendesk.com/hc/en-gb/articles/360040511873-Feedback-on-Depop | strong |
| D4 | https://depophelp.zendesk.com/hc/en-gb/articles/360019648117-Saved-Searches | strong |
| D5 | https://www.depop.com/ and a product page (my visit) | medium (obs) |
| D7 | https://depophelp.zendesk.com/hc/en-gb/articles/50943127471377-How-to-use-Visual-Search-on-Depop | medium (snippet) |
| D8 | https://depophelp.zendesk.com/hc/en-gb/articles/4417829104657-Resolution-Centre-as-a-seller | medium (snippet) |
| D9 | https://www.reddit.com/r/Depop/comments/qrm8cq/price_lowered_notification | weak (anecdote) |
| M1 | https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/ | strong |
| M2 | https://www.mercari.com/us/help_center/article/327/ | strong |
| M3 | https://www.mercari.com/us/help_center/topics/ratings/guides/ratings-for-sellers/ | strong |
| M4 | https://www.mercari.com/us/help_center/article/347/ | medium (snippet) |
| M5 | https://www.mercari.com/ and a search/item page (my visit) | medium (obs) |
| M6 | https://medium.com/mercari-engineering/price-guidance-system-74358bd96081 | medium (company engineering blog; HTTP 403, snippet only) |
| K1 | https://mycollegemarketplace.com/ | weak: vendor |
| K2 | https://www.tryunivo.com/ | weak: vendor |
| K3 | https://www.manchester.ac.uk/about/news/university-launches-preloved-marketplace-hazaar-to-drive-campus-sustainability | medium: university press release |
| K4 | https://www.facebook.com/groups/2303430809699968 | weak: group rules (snippet) |
| K5 | https://www.campusmkt.com/ | weak (snippet) |
| K6 | https://campusswap.online/ | weak (snippet) |
| K7 | https://www.yikyak.com/faq and https://fobia.ai/apps/yaak (what "Yaak" returned) | n/a |
| K8 | https://www.facebook.com/groups/tomasino/posts/10165714551411079 | weak: single group post |
| K9 | https://www.facebook.com/groups/201453673355928/posts/3394175644083699 | weak: anecdote |
| K10 | https://www.facebook.com/groups/kolehiyoupdates2025/posts/1435889718360763 | weak: single post (snippet) |

---

## 10. Patterns that appear in three or more apps (candidates to copy)

"Apps" lists those where the pattern is documented or observed. Fit notes refer to `.monozukuri/project.md` (no money, PH students, PWA, mobile-first at 360 px).

| # | Pattern | Apps (count) | Sources | Fit for Studiskarte |
|---|---|---|---|---|
| 1 | **Browse without an account; ask for sign-up at the first committing action** (offer, chat, like, buy) | Carousell, Vinted, Depop, Mercari; Facebook shows a preview behind a login overlay (4–5) | obs; `[F14-obs]` | Likely good for the PWA's first impression. Studiskarte requires a school email, so a read-only preview is the only way to show value before the code step. Decision for owner: is a public feed acceptable privacy-wise? |
| 2 | **Photo-first grid, price on the card** | Facebook, Vinted and Depop at 2 columns and Mercari at 3 columns on 390 px web (obs); Carousell cards are photo-first, its app column count not verified (5) | obs | Matches the current feed. Add a "size · condition" line like Vinted only where the item type uses it. |
| 3 | **Category tree + scoped search + filter sheet + sort** | all 5 | `[C3][C4][F9][V1]`, obs | Already built (Phase 7). Carousell's extra: a **deal-option filter** (meet-up/delivery) `[C4]`; Studiskarte has the data. |
| 4 | **Save this search** with notification | Facebook, Carousell, Depop, Mercari (4) | `[F15][C14][D4]`, obs | Strong candidate. Depop sends **weekly**, which limits noise `[D4]`. |
| 5 | **Favourite/heart with count on listing (public)** | Vinted, Depop, Mercari (3) | obs | Studiskarte hearts are private with owner-only counts. Note the divergence in section 11. |
| 6 | **Sticky bottom bar on the listing page holding the primary actions** | Vinted (Make an offer + Buy now), Depop (price + Make offer + Add to bag), Carousell (Chat + Make Offer) (3) | obs | Matches mobile-first; keep targets ≥44 px. |
| 7 | **Trust summary on the listing page** (rating, time on platform, last active or response, number of sales) | Facebook, Carousell, Vinted, Depop (4) | `[F3][F10]`, obs | Studiskarte has stars, items sold and "typically replies within"; bring them **above the fold** next to the photo, as Depop and Carousell do. |
| 8 | **Social proof chips on listing** ("In 3 people's bags", "1 offer sent") | Depop; Carousell shows time-ago; Vinted shows favourites; Mercari favourites and price drop | obs | Cheap to copy for demand signals without exposing identities. Use only counts you already hold (hearts, offers). |
| 9 | **Condition as a fixed short vocabulary** | Carousell (with a one-line definition, e.g. "Like new: Used once or twice"), Vinted, Depop, Mercari, Facebook (5) | `[V1][D1][M1][F11]`, obs | Already have a condition filter. Add the one-line definitions at post time as Carousell does; it is the only app where I saw them on the page. |
| 10 | **Category-specific attributes** (model, storage, size, brand) | Carousell, Vinted, Depop, Mercari | obs `[V1][D1][M1]` | Useful for textbooks (course, edition) and services (rate, duration). |
| 11 | **Photo guidance: own photos, daylight, show defects, first photo shows the whole item** | Vinted, Mercari, Carousell, (Facebook tips via press) | `[V10][M1][C1][F11]` | Cheap microcopy at upload. |
| 12 | **Price guidance at posting** (any form) | Facebook (AI), Vinted (table), Depop (range), Mercari (Smart Pricing), Carousell (blog) | `[F10][V7][D1][M1][C16]` | Marketplaces with sold data use ranges; **you have no sold-price data yet**, so start with Vinted-style static guidance by condition `[V7]` and consider a "See what's selling" strip like Mercari's later (obs). |
| 13 | **Offer as a price proposal with seller accept, decline, counter** | Carousell, Vinted, Depop, Mercari (4) | `[C2][V3][D2][M2]` | Studiskarte has accept/decline and no counter; **counter-offer** is the one common feature missing. |
| 14 | **Freshness signal** (listing age, or seller "last seen" / "active today") | Carousell ("Posted 9 hours ago", time-ago on cards), Vinted ("Uploaded 7 min ago", "Last seen 17 min ago"), Depop ("Active today") (3) | obs | Cheap trust cue. Studiskarte has "typically replies within" but no last-active; if added, weigh the privacy cost. |
| 15 | **Posting-effort reducers** (copy or relist a past listing, save drafts, prefill) | Carousell ("List similar item"), Depop (copy listing, drafts), Mercari (drafts, item-recognition prefill), Facebook (renew; AI draft from photos) (4) | `[C5][D1][M1][F2][F10]` | Studiskarte has Relist; a "post another like this" shortcut is the missing piece for a student clearing a dorm room. |
| 16 | **Reviews only after a completed transaction** | Carousell, Vinted, Depop, Mercari, Facebook (5) | `[C1][V4][D3][M3][F3]` | Already done. |
| 17 | **1–5 stars + short comment** | all 5 | same | Already done. Consider Carousell's three prompts (payment, meet-up, communication) `[C2]` if comment quality is low. |
| 18 | **Time-boxed review window with a nudge** | Carousell 14 days, Vinted 4 days, Mercari 3 days (3) | `[C1][V4][M3]` | Studiskarte sends a one-day reminder; define an end date too. **Do not** copy auto-positive or auto-5-star defaults: they inflate scores `[INFERENCE]`. |
| 19 | **Rating cannot be freely edited once visible** | Carousell, Depop, Mercari (3); Vinted allows author edits | `[C1][D3][M3][V4]` | Matches Studiskarte "final" reviews. |
| 20 | **Seller sets item status visible to buyers** (Pending, Reserved, Sold) | Facebook, Carousell, Mercari (SOLD overlay), Depop, Vinted | `[F5][C8]`, obs | Studiskarte already has Reserved and Fully reserved. Facebook's **auto-message to everyone who asked** when an item becomes Pending or Sold `[F5]` is a good model for the notification a student gets when someone else's reservation wins. |
| 21 | **One-tap opening message** | Facebook "Is this available?"; Meta AI auto-reply; Depop "Ask a question"; Vinted "Ask seller" | `[F6][F10]`, obs | Quick-reply chips would cut the empty-chat cold start. |
| 22 | **Keep conversation on platform; report scam inside chat** | Facebook (off-platform contact flagged), Carousell, Vinted (3) | `[F1][C6][V8]` | Aligned with Phase 8 and 14. |
| 23 | **Safety microcopy about meeting**: public, well-lit, bring a friend, no large cash | Facebook, Carousell, College Marketplace (3) | `[F4][C6][K1]` | Show in the handover step. Facebook's **"Send plan"** (share place, date, time with a friend) is a distinct, copyable mechanism `[F4]`. |
| 24 | **Notification catalogue**: new message, follower, favourite, price drop on favourite, sold | Vinted, Depop, Mercari, Facebook (4) | `[V6][D4][M4][F15]` | Studiskarte deliberately limits notices to own-post activity; price-drop on a hearted item is the one extra three apps share. |
| 25 | **Block and report from the conversation** | Facebook (report buyer, seller or listing), Carousell (block-user article; report a listing), Vinted (block and report-scam links in chat guidance), Depop (report or block) (4) | `[F1][C7][V8][D3]` | Already covered by Phase 14; keep the entry point inside the thread. |
| 26 | **Tiered identity badges** (Not verified, Verified, Official) | Carousell, Vinted (Google/Facebook link), Facebook (badges), Mercari (ID above $2,000) (4) | `[C7][V9][F3][M1]` | Direct input to the planned roles and ID verification: show badge state in the chat header as Carousell does `[C7]`. |

---

## 11. Patterns that differ, and why

| Difference | Who does what | Sources | Why it differs / note for Studiskarte |
|---|---|---|---|
| **Escrow, shipping and refund** vs none | Vinted, Depop, Mercari hold money and track parcels; Facebook PH and Carousell PH rely on chat and advice | `[V5][D1][M3][F14][C1]` | The business model: marketplace fee funds protection. Studiskarte has no money, so skip refund claims and Buy-now; keep reviews and reporting. |
| **Offer is binding** | Mercari binding (charged on accept); Carousell binding "in spirit"; Vinted and Depop non-binding | `[M2][C2][V3][D2]` | Mercari can charge a card; non-money apps rely on social pressure. Studiskarte offers lock the post on accept, so it is closer to Mercari than the copy suggests; the 3-day expiry limits harm. |
| **Offer floor** | Vinted max 40% off, Mercari min 75% | `[V3][M2]` | Fraud and lowballing control on goods with a retail price. Student items and services have no reference price; a floor would be arbitrary `[INFERENCE]`. |
| **Reviews visible immediately vs blind** | Carousell hides each side's review until both submit or 14 days pass; others publish immediately | `[C1]` vs `[V4][D3][M3]` | Blind reveals reduce retaliation. Studiskarte's reviews are public at once; worth a deliberate decision, especially with small campuses where everyone knows everyone. |
| **Auto-reviews** | Vinted auto-positive after 4 days (auto-negative on cancel or late ship); Mercari auto 5-star after 3 days | `[V4][M3]` | They need volume and escrow-triggered events. For a small community they would produce unearned stars. Do not copy `[INFERENCE]`. |
| **Private criticism channel** | Mercari "Things to improve" visible only to the person rated; "Known for" public compliments | `[M3]` | Unique in this set. Lowers the cost of honest feedback; good fit for peers who meet in person. |
| **Reviewer can edit own review** | Vinted yes; Depop delete only; Carousell edit before publication only; Mercari not by user | `[V4][D3][C1][M3]` | Tradeoff between correcting mistakes and gaming. Studiskarte chose final. |
| **Listing lifetime** | Carousell PH: never expires, but per-category quotas; Facebook: renew model, PH cap 10 per week; Studiskarte: 30-day expiry, 20 open | `[C8][F7][F2]` | Stale listings are a known pain on open marketplaces. Quotas (Carousell) and weekly caps (Facebook) are spam control for strangers; verified students need less. |
| **Listing types** | Only Carousell lists services (Business, Home, Lifestyle, Tuition Services, Jobs) and (in Hong Kong only) "Want-to-buy listings"; Facebook bans jobs and sexual services; Vinted, Depop and Mercari: goods only, as far as their help pages show | obs `[C5]`, `[F11]` | Studiskarte's Wishlist and services have almost no precedent in these apps; no evidence found on how to present a wanted post. Carousell's HK want-to-buy article exists but was not opened. Needs its own usability testing. |
| **Hearts public vs private** | Vinted, Depop, Mercari show counts publicly and use them as popularity cues; Studiskarte hearts are private to the owner | obs vs project.md | Public counts create social proof but also rank pressure. Studiskarte could show counts only (no names) as the others do; decision for owner. |
| **Identity verification depth** | Carousell: phone then ID ("Verified User"); Vinted: Google/Facebook link; Mercari: ID above $2,000; Facebook: profile age and mutual friends; campus apps: institutional email | `[C7][V9][M1][F3][K1]` | Each matches its risk. Studiskarte's `.edu.ph` mail check is the campus pattern; the planned ID verification could follow Carousell's badge ladder. |
| **Ephemeral vs durable notifications** | Vinted keeps them 7 days, cannot disable in-app; Studiskarte has a read/unread list | `[V6]` | Design choice. [INFERENCE] An in-app list that cannot be disabled is acceptable because push is opt-in. |
| **Search ranking and visibility** | Vinted sells Bumps (the "Bumped" label shows in the feed), Carousell sells Buyer Magnet, Mercari boosts a listing when the price is cut 5% or more and says accurate listings rank higher; Studiskarte is newest-first by design | `[V2][C5][M4][M1]`, obs | Others monetise or reward visibility. Studiskarte has no paid placement; keep recency, with follow-first as the only boost. |
| **Where trust cues live** | Vinted and Depop put seller stats mid-page under the buy buttons; Carousell puts the seller card right under the photo; Facebook moves it to a separate profile | obs `[F3]` | [INFERENCE] Chat-led apps (Carousell, Facebook) must show the person first because the person is the product. Studiskarte is chat-led, so seller-first is the better analogue. |
