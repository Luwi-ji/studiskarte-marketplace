# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students in the Philippines who buy, sell, give away and look for things inside their own school community, usually on an Android phone with 2 GB of RAM and prepaid mobile data, often between classes. Also faculty, staff and alumni (they may look for things and post wishlists; only students post Showcase listings). Visitors with no school email are supported in code but switched off. Members must be 16 or older; members under 18 are allowed. First-time sellers dominate: someone clearing a dorm room or a finished textbook, not a shop. The person on the other side is usually a stranger from the same school.

## Product Purpose

Studiskarte Marketplace (studiskarte.com, installable web app) is a chat-led student marketplace. A member posts a Showcase (something offered, for a price or free) or a Wishlist item (something wanted), other members message, make an offer or reserve, and the two agree a time and a public place on campus to hand it over. The app never handles money: payment is cash or an outside method, agreed between the two members. Success is a completed handover that both sides would repeat, not time spent in the app.

## Positioning

Closest peers are Facebook Marketplace and Carousell Philippines, not Vinted or Depop. What a neighbour cannot copy: every account is tied to a school email, the whole deal (chat, offer, handover, review) lives in one thread, meet-ups are limited to 6:00 AM to 8:00 PM, and the product says plainly that it holds no money and gives no payment protection.

## Operating Context

- Meet-ups happen on campus in daylight; the handover form is the safety feature.
- Payment is cash at the meet-up or an outside method such as GCash. The main scam is paying and never receiving the goods, so copy tells people not to pay before the handover is agreed.
- Alerts: the in-app notification list is the main channel; push works on Android and on iPhones only for Home Screen installs.
- One owner runs the service alone, reviews reports through an admin area, and promises to read child-safety and urgent reports within 24 hours.
- Optional ID check (school ID or, for graduates, proof of graduation, plus a photo holding it) gives an "ID checked" badge; pictures are deleted when the owner decides.

## Capabilities and Constraints

- Roles: student, faculty or teacher, staff, alumni, visitor. A school email is required for the first four.
- Listing kinds: Showcase (students only) and Wishlist. A Showcase can allow non-students to buy; default is students only. Without an ID check a student may have one open Showcase.
- Reservations, offers, handover scheduling, review after a completed deal, reports, blocks, perks, push alerts, calendar link.
- Philippine law shapes the product: Data Privacy Act, RA 11930 (child safety), consent screens that are separate and as easy to withdraw as to give. Legal text is unreviewed by a lawyer.
- Free tiers: 100 emails a day, about 0.5 GB database, 10 GB photo storage. Pages must stay light.
- Undecided: the mascot's name; whether the feed defaults to the student's own school; the Taglish copy test with students.

## Brand Commitments

Name: Studiskarte Marketplace (short: Studiskarte). Tagline: "Where student hustle meets student needs." The logo is a white S-shaped student character with a navy graduation cap and gold backpack on brand blue (`public/logo.png`). Blue `#0365fc`, gold `#f5b301`, tinted neutrals, Figtree font, English for navigation, errors and anything legal or safety, a light Taglish touch only in low-stakes moments. Feeling: friendly, trustworthy, quick. Details in `docs/design/brand.md`.

## Evidence on Hand

- Design research: `docs/design/research/evidence.md`, `teardown.md`, `philippines.md`, and the 24 rules in `docs/design/principles.md`.
- A UI audit of the member screens: `docs/design/audit/`.
- No real student users, reviews, testimonials or usage numbers yet; none may be invented. Seed data in development is fake.

## Product Principles

1. The person comes first: on a chat-led marketplace the seller card is the product (school, stars with count, items sold, replies-within, badge state; "New" for a new seller).
2. Say what a badge checked, never more: "School email", "ID checked".
3. The shortest listing is one photo, a title, a price and a category; everything else has a safe default.
4. Never imply the app holds or protects money; make the safe handover the easy path.
5. Keep the deal in one thread, and make leaving the app look suspicious.
6. Consent and deletion are designed in: separate, specific, and as easy to withdraw as to give.

## Accessibility & Inclusion

Phone first at 360 px; tap targets 44 px or more; text contrast 4.5:1 or better in light and dark mode; meaning never by colour alone; inputs 16 px so iPhones do not zoom; plain English for a readership that may use English as a second language; small data cost (resize photos in the browser, reserve image space).
