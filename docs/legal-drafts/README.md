DRAFT for lawyer review, not live.

# Legal drafts for review (2026-10-21)

Not legal advice and nothing here says the app is compliant. These are engineering drafts for a Philippine lawyer to correct. They follow `docs/privacy-and-legal-review-2026-10-20.md` (the brief). The live text in `content/legal/` (terms, privacy, guidelines, dated 2026-10-19, `VERSION` 2026-10-19) is **unchanged**: editing it, or its `VERSION`, makes every member accept again.

## The files

| File | What it is | Becomes |
| --- | --- | --- |
| `privacy.md` | Full revised Privacy Policy, with an "At a glance" summary on top, then detail | Replaces `content/legal/privacy.md` |
| `terms.md` | Full revised Terms of Service | Replaces `content/legal/terms.md` |
| `id-verification-consent.md` | Just-in-time consent screen text for ID verification, exact checkbox wording, withdrawal text, what is recorded as proof | App UI text and a consent record; not a legal page |
| `age-confirmation.md` | The "18 or older" sign-up checkbox, the message when someone cannot confirm, what is stored, handling an under-18 account | App UI text and one stored timestamp |
| `breach-response.md` | Internal runbook for a solo owner (detect, contain, assess, notify, log, templates) | Internal; keep outside the public site |
| `rights-requests.md` | Internal procedure for access, correction, erasure, objection, portability requests | Internal |
| `refund.md` | Refund, Returns and Disputes Policy (the app moves no money; Civil Code hidden-defect rule; minors) in the style of marketusm.me/refund | New page `content/legal/refund.md` (add the slug in `src/lib/legal/documents.ts`) |
| `cookies.md` | Cookies and Local Storage Policy from a real inventory of what the app stores | New page `content/legal/cookies.md` (same) |
| `ph-law-research.md` | Research memo: RA 11930, RA 8792, RA 11967, RA 7394, Civil Code, RA 10173, cybercrime and related laws, cookies, regulated goods; where each lands in our pages | Internal |
| `takedown-procedure.md` | Public wording for reporting prohibited or unsafe listings, plus the admin procedure in the existing /admin queue | Part 1 into Terms and Guidelines (or a /report page); Part 2 internal |

**Already live (2026-10-22):** `content/legal/child-safety.md` (Child Safety Standards, RA 11930), the minimum age of 16 in `terms.md`/`privacy.md`/`guidelines.md`, and a new `VERSION`. Everything else in this folder is still a draft.

`privacy.md` and `terms.md` use only what the app's legal-page reader supports (`src/lib/legal/markdown.ts`: headings, paragraphs, bullet and numbered lists, bold, italic, links; **no tables**). They end with a "Notes for the lawyer" section and open with a status note; delete both before publishing.

## What changed against the live text

Privacy Policy:
- Contact changed from `studiskartemarketplace@gmail.com` to `support@studiskarte.com`; added the Data Protection Officer placeholder and the owner's name placeholder.
- "Young people (under 18 with permission)" replaced by a minimum age of 16, under 18 allowed (changed 2026-10-22; first drafted as 18 and over).
- Processor list rewritten: Google (Gmail) sending removed; Resend, Cloudflare (DNS, email routing, R2) and Sentry added; Google sign-in and push services now described as "only if you choose"; Vercel and Neon kept. Each with where it is and what it gets. Cross-border statement added (Data Privacy Act Sec 21).
- Layered: short "At a glance" first.
- Added: how we collect, legal reason for each purpose, retention list (now includes unused photos after 24 hours, withdrawn and expired listing visibility, closed-account row, reports, backups and pre-change database copies, consent proof), the rights list with how to use them, response time placeholder, withdrawing consent, how to complain to the NPC, breach promise, and the ID verification section (marked "applies once ID verification opens").
- The deletion paragraph now matches `src/lib/identity/delete-account.ts`, and says plainly what stays (messages, message pictures, finished reservations, reviews, listing text and photos, reports).

Terms:
- Minimum age 16, under 18 allowed (changed 2026-10-22; was 18+); roles and what each may do (only students post a Showcase; others post a Wishlist; non-students may contact a Showcase seller only if the seller allowed it, per `src/lib/posts/audience.ts`); venue not a party; no money handled.
- New "Reporting a problem and taking listings down" section with response time placeholders and an appeal route.
- Suspension section; content licence made explicit; occasional-seller and permit sentences added.
- Limitation of liability reworded so it does not claim to override statute.
- Changes and Law kept, with a court venue placeholder.

Not drafted, but needs a matching edit (the task scope was these files only): `content/legal/guidelines.md` still has the old Gmail address, no age rule and the older reporting text. Adopt it together with Terms.

## Sources read, and not read

Read from official sites (each draft cites by section number only what was read): Data Privacy Act (RA 10173), Secs 1 to 21 on privacy.gov.ph (the penalty sections 25 to 37 were not read, only their headings); its IRR, the contents list and Secs 3 to 6, 34 to 38 (the registration and penalty rules were not read); NPC Circular 16-03 in full; Circular 2023-04 in full; Circular 2022-04, Secs 1 to 29; Advisory 2024-03 on Child-Oriented Transparency and its FAQ in full; the 2021 NPC Rules of Procedure as amended, up to Rule VI (includes Rule II Sec 2); RA 11967 in full (lawphil.net).

**Not read:** the Internet Transactions Act IRR (JAO 24-03). The DTI site (ecommerce.dti.gov.ph) refused connections from here and the UP Law Center copy returned 404. NPC Circular 2023-06 (cited by the advisory), the Civil Code, the Consumer Act, RA 11930 and the Cybercrime Prevention Act. Anything that leans on these is tagged [to confirm]. Vercel's, Neon's, Cloudflare's, Resend's and Sentry's own data-processing terms were not read.

Findings that differ from the review doc, because the primary sources were read now:
- **ITA Sec 3 excludes consumer-to-consumer transactions** (defined in Sec 4(c)); the review doc worked from summaries. This may take the app, or student occasional sellers, outside the Act. The drafts are written to work either way. First question for the lawyer.
- **Breach timing is no longer a guess:** Circular 16-03 Secs 17(A) and 18(A) give 72 hours to notify the NPC and the affected people from knowledge, no delay if 100 or more people or sensitive data harm, full report within 5 days (Sec 17(C)); IRR Sec 38 repeats the 72 hours. The runbook uses these.
- **Rights response time:** no response period for data subject requests was found in the Act or IRR. The only number found: the NPC's Rules of Procedure Rule II Sec 2 say a complaint is not given due course unless the person first told the controller in writing and the controller did not respond within 15 calendar days. The drafts now use 15 days (lawyer to confirm).
- ITA Sec 24: the platform's internal redress is deemed exhausted if a complaint is unresolved after 7 calendar days.

## Questions for the lawyer

1. Does the ITA apply at all (C2C exclusion, Sec 3; "ordinary course of business", Sec 4(c))? If yes, which duties of Sec 22 bind a platform with no payment or delivery role, and when is a student seller an "online merchant"? What do the IRR require of notices and speed of takedown?
2. Registration with the NPC (Circular 2022-04 Secs 5, 6): mandatory or sworn declaration (Annex 1)? Is the owner an "Individual Professional" (the de facto DPO), and does the Circular require the DPO to be an organic employee otherwise? The Circular wants a dedicated DPO email, separate from personal email (Sec 8). Which route fits an individual owner who runs the app unregistered as a business?
3. Minimum age 16 by self-declaration only: enough, and is 16 the right floor? `.edu.ph` addresses are accepted and may include schools with students under 18 [to confirm]. Is a Child Privacy Impact Assessment required for a service that may be "likely to be accessed by children" (Advisory 2024-03 Secs 1, 2(A))? Effect on contracts if a minor gets in anyway.
4. Response times, now set to 15 days (rights requests), 24 hours (urgent takedown), 3 working days (other), 7 days (appeals): confirm.
5. Consent and ID verification: is consent "freely given" if verification is optional but some features are limited for unverified students (Circular 2023-04 Sec 7)? Should the ID check also serve as the age check, and if so how must the purpose read? What may be kept after consent is withdrawn (status, reviewer, date, reason)? How long to keep proof of consent after account deletion?
6. Do school and role (education data, Data Privacy Act Sec 3(l)) need their own consent line at sign-up, or is acceptance of the Terms and Policy enough (Circular 2023-04 Secs 8, 19)?
7. Retention after account deletion: messages, message pictures, finished reservations, reviews, listing text and photos and reports stay. Proportionate (Sec 11(e), 16(e))? Should the app erase or anonymise them on request?
8. Backups: named pre-change database copies and 6 hours of Neon history can hold deleted data. How long may they be kept, and what does the policy have to say?
9. Cross-border (Sec 21): are each processor's standard data-processing terms enough for "comparable level of protection"? Is anything more needed for the US and other destinations?
10. Liability clause: is the wording safe? Which duties cannot be limited (ITA, Consumer Act, Civil Code)?
11. Takedown: is hiding a post while checking acceptable; what proof may a seller be asked for; is the 3-report threshold consistent with acting "expeditiously" on one clear notice (Sec 26(b), 27)? Must regulated goods (food) show permit or licence information (Sec 22(b))? Should regularly selling accounts be flagged (Sec 22(a), (e))?
12. Notice to the NPC and people within 72 hours: is the Circular still current (its Sec 23 says the channel may be amended)? Is the "within 72 hours" promise in the Privacy Policy appropriate, or should it say "as the law requires"?
13. Governing law and venue; whether to name the owner and an address in the Terms; whether Vercel Hobby's non-commercial limit (from memory, in the review doc) is a legal issue if the app earns money.
14. Perks (the app has `perk` and `partner` tables): not covered by these drafts.

## Decisions for the owner

- Name a Data Protection Officer and a dedicated email (Circular 2022-04 Sec 8) and fill the placeholder everywhere.
- Name yourself in the policy (`Lowel-Jay Rubino`).
- Confirm with each provider: data regions (Vercel functions, R2 bucket, Resend, Sentry project), retention (Sentry, Resend, support mail), and that their data-processing terms are accepted.
- Set retention for named pre-change Neon copies.
- Set the ID verification numbers (resubmissions, pending image cleanup, alumni documents, limits for unverified students).
- Decide how often you check /admin and the support mailbox.
- Statements carried from the live text and not re-checked: "the only cookie is the one that keeps you signed in", photos have location and camera data removed on upload, Google sign-in keeps only the email.

## Review input received 2026-10-22

The owner passed on a written review of the 14 questions. Applied to the drafts: response times set to 24 hours (urgent), 3 working days (other reports), 7 days (appeals and complaints), 15 days (data rights requests); takedown draft says a single formal notice bypasses the 3-report counter; refund draft says "as is" does not excuse a known fault. **Not applied, because the review gave no source or it conflicts with the research:** a fixed court venue (Parañaque or Pasig), five-year retention of consent logs, a 30-day cap on pre-change database copies (owner decision), and a dedicated DPO mailbox name. Its claims that a Child Privacy Impact Assessment is "compulsory" and that Vercel Hobby breaches its terms for a marketplace with perks are stated more firmly than the sources read support; both stay questions for the lawyer. Its NPC registration thresholds (1,000 people with sensitive data, 250 staff) match Circular 2022-04 as far as I know but were not re-read [to confirm]. It also says the C2C exception covers occasional resales; the research found the same, and that regular sellers may be presumed businesses.

## Placeholders (all in square brackets)

Set on 2026-10-22 (owner's decisions and the recommended numbers; the lawyer may change any):
- Owner and DPO: Lowel-Jay Rubino, dpo@studiskarte.com.
- Response times: 24 hours (urgent and child safety), 3 working days (other reports), 7 days (appeals), 15 days (rights requests), 2 working days to acknowledge a rights request, 14 days to write an incident review.
- Court venue: Parañaque City.
- Retention: consent proof 3 years after deletion; takedown and rights logs 2 years; support mail 1 year; pre-change database copies 30 days; pending ID pictures 7 days; 3 ID attempts.
- Minimum age 16. Admin rhythm: morning and evening.

Still open, for the owner:
- `[date of adoption]`: privacy.md, terms.md, refund.md, cookies.md
- `[Sentry data region: confirm from the Sentry project settings]`, `[Vercel function region: confirm]`, `[R2 bucket location: confirm]`, `[Resend region: confirm]`, `[Sentry retention: confirm]`, `[Resend retention: confirm]`: privacy.md
- `[mailbox provider: owner to name]`: privacy.md
- `[limits for unverified students: owner to confirm ...]`, `[Graduates (alumni): documents to be decided.]`: privacy.md, id-verification-consent.md
- `[lawyer name and contact]`, `[from account]` support contacts, `[date]` runbook review dates: rights-requests.md, takedown-procedure.md, breach-response.md
- `[applies once ID verification opens]`, `[applies once visitor sign-up opens]`: markers to drop when the feature opens.
- Many inline `[lawyer: confirm ...]` and `[to confirm]` notes.

## Build items the drafts rely on

From the review doc, section 5, plus ones found while drafting. Do not publish a sentence before its item exists.
- Age checkbox and a stored `age_confirmed_at` (built, 2026-10-22; asked at sign-up and on re-acceptance); shown on every sign-up route and on re-acceptance for existing members.
- The ID verification consent screen, consent record, one-tap withdrawal in Settings, deletion at decision, private bucket, an admin audit log of every view of an ID image and every moderation action. The privacy text promises "each time the pictures are opened is logged": that needs the audit log first.
- A heading anchor, or a short page, so the consent screen can link to the ID section of the policy.
- A way to record a notice that arrived by email, and a reason the admin gives that the poster sees; today /admin has no such field and no new-report alert.
- A message to the person when an account is suspended (today they are only signed out).
- Optional: self-service data export (rights-requests.md now handles it by email and by hand).

## Order to adopt

1. Lawyer reviews all seven files; answers the questions above; the owner designates the DPO and decides the NPC registration route.
2. Owner confirms the provider facts and retention numbers; fills the placeholders.
3. Age checkbox and stored confirmation: built (`age_confirmed_at`, migration 0031).
4. Publish `privacy.md`, `terms.md` (with the status note and the lawyer section removed, and the ID section left out), a matching `guidelines.md`, and a new `VERSION`, **in one release**, so members accept once. The age confirmation goes live in the same release.
5. Put the takedown wording (Part 1) in the Terms and Guidelines in the same release, and start following Part 2. Keep `breach-response.md` and `rights-requests.md` ready from the same day (internal; no deploy).
6. Before ALLOW_VISITORS is turned on: the visitor safety rules, and the visitor sentence in the Terms live (drop "[applies once visitor sign-up opens]").
7. When ID verification opens: build the items above, publish the ID section of the Privacy Policy with a new `VERSION` (a change in what is processed needs fresh agreement, Circular 2023-04 Sec 21(A)), and ship the consent screen as its own step, not bundled with the Terms.
