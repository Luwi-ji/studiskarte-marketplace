DRAFT for lawyer review, not live.

# Age confirmation (18 or older)

The owner's decision (docs/privacy-and-legal-review-2026-10-20.md, section 1): the app is for people 18 and over only. This replaces "If you are under 18, use it only with the permission of a parent or guardian" in the live Privacy Policy and Terms. This file gives the wording of the sign-up checkbox, the message for someone who cannot confirm, what is stored, and how an under-18 account is handled. No code exists yet.

## Where it appears

- On the sign-up screen, as its own checkbox, separate from the Terms and Privacy Policy checkbox (the NPC consent guidance asks that things are not bundled, Circular 2023-04 Sec 8(B)). The account cannot be created until both are ticked.
- **Before** the emailed code is sent, so nothing is sent to, or stored for, a person who cannot confirm.
- On every route that creates an account: school email, personal email (when visitor sign-up opens), and Google sign-in.
- For existing accounts: on the same screen that asks them to accept the new version of the legal text (`needsTerms` in src/lib/legal/documents.ts asks again when `content/legal/VERSION` changes). They must confirm before they can go on.

## Checkbox wording (unchecked when the screen opens)

> I am 18 years old or older.

Help line under it, small text:

> Studiskarte Marketplace is only for people aged 18 and over.

## Message when someone cannot confirm

Shown when a person leaves the box unticked and tries to continue (new sign-up), in place of an error code:

> **Studiskarte Marketplace is for people aged 18 and over.**
>
> We cannot create an account for you. We have not saved any of your details. You are welcome to come back when you are 18.

For an **existing account** that chooses "I am under 18" on the re-acceptance screen:

> **Studiskarte Marketplace is for people aged 18 and over.**
>
> We will close your account and delete your details as described in the Privacy Policy. Write to support@studiskarte.com and we will do it for you, or sign out now. Until then you will not be able to use the app.

[Build: the account is suspended at once so the person cannot go on using it; the owner then deletes it as in "Handling an under-18 account" below. Lawyer: confirm the wording.]

## What is stored

- A timestamp that the person confirmed they are 18 or older, kept with the terms acceptance (`terms_version`, `terms_accepted_at` on the student row). Build item: one new column, for example `age_confirmed_at`, set in the same step. Per the review doc, section 5.
- **Not stored:** a date of birth, an ID, or anything else about age. The app does not need it, and collecting it would be more data than the purpose needs (Data Privacy Act Sec 11(d), adequate and not excessive).
- For someone who cannot confirm: nothing.

## Handling an under-18 account (internal)

When a member reports that someone is under 18, or the owner learns it:

1. Do not ask the person for proof of age unless it is necessary to decide; do not ask for an ID by email.
2. Suspend the account in /admin (Students reported, Suspend) so it stops at once. Suspension signs the person out everywhere.
3. Delete the account as in rights-requests.md (erasure), so that the data erased is the data listed in the Privacy Policy. Messages and reviews other members rely on stay as "Deleted account".
4. If a breach involves a person who turns out to be under 18, notify the child and a parent or guardian, in language the child understands (NPC Advisory 2024-03 Sec 4; see breach-response.md).
5. Write one line in the record: date, how it came to light, what was done. No name beyond the account handle.

## Limits and questions for the lawyer

- This is a self-declaration. NPC Advisory 2024-03 Sec 2(B)(1) (read) says relying only on self-declaration "may be inadequate for high-risk processing activities", and Sec 1 applies the advisory to services "likely to be accessed by children". The advisory also asks for a Child Privacy Impact Assessment before launching such a service (Sec 2(A)). Whether this app is "likely to be accessed by children", and what is enough, is a lawyer's question.
- The school email check accepts any address ending in `.edu.ph` (check constraint `student_school_email_shape` in src/db/schema.ts). Such addresses are not limited to colleges; whether they can belong to people under 18 is not established here [to confirm]. A school email therefore does not prove age.
- The ID verification feature, once built, could also serve as an age check; that is only so if the consent screen says so (see id-verification-consent.md).
- No age of digital consent exists in Philippine law and capacity is governed by the Civil Code (NPC FAQ on the advisory, Q6, read); the effect on contracts made by a minor is not covered here [to confirm].
