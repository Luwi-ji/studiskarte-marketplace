# Roles, verification and onboarding: decided plan (2026-10-18)

Status: **not built.** Waits for the privacy review, the legal text and the mail-provider switch. Review notes and the risks behind each rule are in the conversation of 2026-10-18; the evidence is in `docs/design/principles.md`.

## Decisions (owner)
- Roles: student, faculty or teacher, staff, alumni, visitor. A **school email** means one of the first four, never visitor; a **personal email** means visitor only.
- Sign-in stays the emailed code. Sending moves to a provider without Gmail's 500 a day cap (Resend or Brevo) **before** visitors are allowed in.
- Unverified students can browse, buy and post wishlists. **An unverified student may have one open showcase listing**; verification lifts the limit.
- Faculty, staff, alumni and visitors browse, buy and post wishlists only.
- Each showcase has "allow non-students and visitors to buy" (default off; existing listings stay students-only). Without it the listing cannot be bought or messaged by non-students. Checked at message start, offer and reserve, on every listing.
- Non-students can message only students whose listing allows it. Non-students can redeem perks (**owner to confirm with partners**).
- Bought stays visible only to the student. Sold and granted are public to signed-in people (built 2026-10-18).
- Meet-ups 6:00 AM to 8:00 PM (built 2026-10-18).

## Verification
Upload of ID or COR plus a photo holding it, reviewed by an admin; "verify later" from the profile; status shown in notifications. Built around deletion: private bucket separate from listing photos, admin-only short links, images deleted when a decision is made (keep status, reviewer, date, reason), consent text on the capture screen, limit on resubmissions, expiry after 12 months with re-verification, an alumni path for graduates. Reports and reviews count only from verified students, so sock-puppet visitors cannot hide a listing. The under-18 position must be decided first.

## Onboarding order
Role, then profile (handle, name, short bio), then "verify now or later", then a skippable feature tour.

## Badges
School mark, role, and "ID checked" only when it was. The word "verified" always says what was checked.
