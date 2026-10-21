DRAFT for lawyer review, not live.

# Age confirmation (minimum age 16; under 18 allowed)

Changed 2026-10-22. The owner first chose "18 and over only" (commit 97f23ca) and then decided that minors may use the app. The rule is now a **minimum age of 16**, confirmed by a checkbox, with a short nudge for members under 18 to tell a parent or guardian and a link to the Child Safety Standards (`content/legal/child-safety.md`). The number lives in one place, `MIN_AGE` in `src/lib/identity/age.ts`. The lawyer may change it (15? 16? 18?); changing it changes the checkbox, the error message and the text in `content/legal/terms.md` and `privacy.md`, which are plain text and must be edited by hand.

Why 16 and not "any age": the school email check accepts any `.edu.ph` address, and the app's audience is college and senior high school students. A floor keeps young children out. It is a self-declaration and does not prove age.

## What the member sees

At sign-up (`/welcome`) and on re-acceptance (`/accept-terms`), before the code is accepted, one checkbox (required, not pre-ticked), next to the Terms acceptance:

> I am 16 years old or older. If you are under 18, tell a parent or guardian you are using the app. Read our Child Safety Standards.

If the box is not ticked, the form does not go on and says:

> You must be 16 or older to use Studiskarte Marketplace. If you are younger, please do not sign up.

Nothing is saved for someone who cannot confirm.

## What is stored

- `student.age_confirmed_at` (migration 0031, renamed from `adult_confirmed_at`, which 0030 added): the moment the person confirmed they meet the minimum age, set in the same step as the terms acceptance. Members who confirmed "18 or older" under the earlier wording keep their timestamp and meet the new rule.
- **Not stored:** a date of birth, an ID, or anything else about age (Data Privacy Act Sec 11(d), adequate and not excessive).

## Members under 18

- They may use the app like anyone else. They are not given extra features.
- The Terms and Privacy Policy tell them to involve a parent or guardian and point to the Child Safety Standards.
- Reports about content that sexualises a child hide the listing at once and alert the owner (see `docs/admin-dashboard-plan.md`).
- Open design question for the owner: should a member under 18 be reachable by adults the same way? The app does not store who is under 18 (only that they confirmed 16+), so it cannot restrict contact. RA 11930 treats grooming and luring as offences even if the child agrees (Sec 4(m), Sec 5); see `ph-law-research.md`, item 1.

## Handling a member younger than 16 (internal)

When someone reports that a member is younger than 16, or the owner learns it:

1. Do not ask for an ID by email.
2. Suspend the account in /admin (Moderation, Students reported, Suspend). Suspension signs the person out everywhere.
3. Delete the account as in `rights-requests.md` (erasure). Messages and reviews that other members rely on stay as "Deleted account".
4. If a breach involves a child, notify the child and a parent or guardian in language the child understands (NPC Advisory 2024-03 Sec 4; see `breach-response.md`).
5. Write one line in the record: date, how it came to light, what was done. No name beyond the account handle.

## Limits and questions for the lawyer

- Self-declaration only. NPC Advisory 2024-03 Sec 2(B)(1) (read) says relying only on self-declaration "may be inadequate for high-risk processing activities", and Sec 1 applies the advisory to services "likely to be accessed by children". It also asks for a Child Privacy Impact Assessment before launching such a service (Sec 2(A)). Whether this app is "likely to be accessed by children", and what is enough, is a lawyer's question. Because members under 18 are now expressly allowed, the answer is probably yes [to confirm].
- Contracts: no age of digital consent exists in Philippine law and capacity is governed by the Civil Code (NPC FAQ on the advisory, Q6; Civil Code Arts 1327(1), 1390 to 1399). A deal with a minor may be voidable. The Terms and `refund.md` must not promise otherwise.
- Is 16 a defensible floor? Is parental involvement something to require rather than suggest (for example under 18, a guardian's consent)?
- The school email check accepts any address ending in `.edu.ph` (check constraint `student_school_email_shape` in `src/db/schema.ts`). A school email does not prove age.
- ID verification, once built, could also serve as an age check, but only if the consent screen says so (see `id-verification-consent.md`).
