# Privacy and legal review (2026-10-20)

Not legal advice. This is an engineering review of the app against the sources named below, to give the owner a list of gaps to close and questions for a Philippine lawyer. Nothing here is certified compliant.

## Sources read
- Data Privacy Act of 2012 (RA 10173), full text from privacy.gov.ph.
- NPC Circular 2022-04 (registration of data processing systems, DPO).
- NPC Circular 2023-04 (guidelines on consent).
- NPC Advisory on Child-Oriented Transparency, FAQ of 17 Dec 2024.
- Internet Transactions Act (RA 11967): only secondary summaries (DivinaLaw column, DTI/PNA pages); the Act and its IRR were not read in full.
- Not read, stated from general knowledge and to be checked: Civil Code rules on minors' contracts, NPC Circular 16-03 (breach management), RA 11930 (online child exploitation), the Cybercrime Prevention Act.

## 1. Minors (under 18)
Finding: do not open to minors yet.
- NPC treats a child as under 18 and the DPA applies in full to their data. The December 2024 advisory asks controllers of services "likely to be accessed by children" for a Child Privacy Impact Assessment before launch, a separate child-friendly privacy notice (one notice for adults and children is "not sufficient"), and breach notices to both the child and the parent or guardian. It says self-declaration of age "may be inadequate" for high-risk processing.
- There is no Philippine age of digital consent in law; the NPC says one needs an Act of Congress and capacity to act is governed by the Civil Code. [General knowledge, to confirm:] contracts by unemancipated minors are voidable, which affects every deal on the marketplace.
- Circular 2022-04 names minors as vulnerable data subjects; processing likely to pose a risk to data subjects triggers mandatory registration of the data processing system and a DPO.
- Adding ID photos of minors plus meeting strangers raises the risk further.
- Current text ("If you are under 18, use it only with the permission of a parent or guardian", in the Privacy Policy and Terms) is a weak position. Decision: 18 and over only, stated in both documents and asked at sign-up (see to-do).

## 2. Data Privacy Act points that touch the app
- **Sensitive personal information (Sec 3(l)):** age, education, and government-issued identifiers. School email domain, role, enrolment documents (COR) and ID images are at least education or age data. Processing needs consent specific to the purpose and given before processing (Sec 13(a)).
- **Consent (Circular 2023-04):** freely given, specific, informed, granular, not bundled, not implied, withdrawal as easy as giving, just-in-time and layered notices as the default, and keep proof (what was shown, when, the act of consent). Terms acceptance alone will not cover ID verification: it needs its own just-in-time notice and its own consent step.
- **Proportionality and retention (Sec 11):** collect only what is needed and keep it only as long as needed. The ID plan (delete images on decision, keep status, reviewer, date, reason) fits this. Define and publish retention for logs, error reports and mail.
- **Registration (Circular 2022-04, Sec 5, 6):** mandatory if 250 employees, or sensitive personal information of 1,000 or more individuals, or processing likely to pose a risk to rights and freedoms. Otherwise a sworn declaration (Annex 1) or voluntary registration. Registration needs a named DPO with a dedicated email address (not a personal one) and a business registration document. The owner is an individual; the Circular's "Individual Professional" route may apply. Ask the lawyer which route fits.
- **Breach (Sec 20(f), Circular 16-03):** notify affected people and the NPC. Needs a written incident procedure. [Timing not read: NPC Circular 16-03 is commonly cited as 72 hours; confirm.]
- **Processors and transfers (Sec 14, 21):** the owner stays accountable for Vercel, Neon (US), Cloudflare, Resend and Sentry (US). Policy must name them and where data goes; keep their data-processing terms.
- **Rights:** the policy promises access, correction, erasure, portability, objection and damages. There is no self-service export; it is by email. Set and publish a response time.
- **Penalties (Sec 25 to 32):** unauthorized processing, negligent access, improper disposal, concealment of breaches. Access to ID images must be limited to the admin and logged.

## 3. Internet Transactions Act (secondary sources only)
- The app likely counts as a digital platform that does not retain oversight over the sale (it takes no payment, ships nothing). Reported duties: let people tell commercial from non-commercial accounts, keep a list of accounts that use the platform for e-commerce, require sellers to show name, price, description and condition (the post form already asks for these), act on takedown orders, and be answerable if prohibited, unsafe or dangerous goods stay up after notice.
- "Online merchants" are people selling in the ordinary course of trade; occasional student resales may not be. Whether and when a student seller must register is a lawyer's question.
- A "limitation of liability" clause cannot remove liability the Act imposes. The Terms should not promise more than the law allows.
- Needed in the app: a written takedown and complaint channel with a response time, and an account flag for people who sell regularly (to decide).

## 4. Gaps in the current text (privacy.md, terms.md, dated 2026-10-19)
1. Contact is `studiskartemarketplace@gmail.com`; the app now uses `support@studiskarte.com`.
2. "Google (Gmail) sends our emails" is out of date: mail goes through Resend. Cloudflare (DNS, mail routing, R2) and Sentry (once added) are missing from the processor list.
3. No named DPO or dedicated DPO email, no breach procedure, no response times for rights requests.
4. No cross-border transfer statement beyond "some outside the Philippines".
5. "Young people" (under 18 with permission) conflicts with the decision above.
6. No section for ID verification (images, purpose, who sees them, deletion on decision, withdrawal), to be added with that feature and with its own consent step.
7. No takedown or complaint procedure with timelines (ITA).
8. Terms limit liability broadly; wording should be reviewed so it does not claim to override statute.
9. Consent evidence: the terms version and time are stored; that is good. A stored record of what the ID consent screen said is needed once ID verification exists.

## 5. Build items this review adds
- Age confirmation (18 or over) at sign-up, stored with the terms acceptance.
- A consent screen and consent record for ID verification.
- Admin audit log for every view of an ID image and every moderation action.
- Self-service data export (optional; the policy currently handles it by email).
- Written procedures kept in `docs/`: breach response, rights requests, takedown.

## 6. For the owner and a lawyer
- Registration route with the NPC and the DPO designation.
- Business registration (DTI) and what the ITA requires of the app and of student sellers.
- Final wording of the Privacy Policy, Terms and consent text before ID verification opens.
- Vercel Hobby is for non-commercial use under Vercel's terms [from memory, check]; a marketplace that earns money may need a paid plan.
