DRAFT for lawyer review, not live.

# Handling data rights requests (internal procedure)

Internal. Covers requests under the Data Privacy Act of 2012 (RA 10173), read on privacy.gov.ph: Sec 16 (rights to be informed, to access, to correct, to suspend, withdraw, block, remove or destroy, and to damages), Sec 17 (heirs and assigns), Sec 18 (portability), and the IRR Secs 34 and 36 (also read: right to object). The Privacy Policy draft (privacy.md) promises these rights and a response time of 15 days.

Reference point for the response time: the NPC's 2021 Rules of Procedure, as amended, Rule II Sec 2 (read), do not give a complaint due course unless the person first told the controller in writing and the controller did not act in time, or did not respond within 15 calendar days of receiving the written notice. The NPC may waive that. The lawyer may want the published response time to sit within 15 calendar days.

## 1. Receive and log

- Requests arrive at support@studiskarte.com, at the DPO address Lowel-Jay Rubino, dpo@studiskarte.com, or as a complaint about a privacy matter. Read the mailbox daily.
- Open a log row the same day: request id, date received (the day the 15 or [X] day clock starts), channel, type (access, correction, erasure or blocking, objection, portability, withdrawal of consent, other), requester's email as written, the account handle if known, status, date answered, outcome, what was sent.
- Reply within 2 working days to say it was received and when to expect an answer.
- The log holds as little as possible: no copy of the data sent, and no copy of any ID. Retention of the log: 2 years.

## 2. Check who is asking

Only the person the data is about (or their lawful heir or assign, Sec 17, or a representative the person specifically authorised, Data Privacy Act Sec 3(b)) may ask. Ask for no more than needed; never ask for an ID copy for this.

- **Normal case.** The request comes from the email address on the account. For a school email account, either the sign-in email or the confirmed school email matches. Reply to that address only. That is enough for access, correction and portability of ordinary data.
- **Higher-risk requests** (a full copy of messages, erasure of retained items, anything involving ID images): also ask the person to confirm something only the account holder would know, for example the handle and a recent listing's title, or ask them to reply from a signed-in session on the account. [Owner/lawyer: confirm the level of checking.]
- **Different email.** Do not act. Ask them to write from the account's email address.
- **Deleted account.** The email on the row is replaced by a random address, so nothing links a requester to it. Ask for the old handle and details of messages or reservations; do not release data unless a match is certain. Remember that what is left is without a name anyway.
- **Heirs or someone acting for a person.** [Lawyer: what proof to ask for. For a person who cannot act: Sec 17.]

## 3. What the app can do on its own, and what is manual

Self-service today (Settings, under "Me", from `src/app/(tabs)/me/settings/page.tsx`): change profile picture, display name and handle (the handle can be changed again only after a waiting time); switch device alerts on or off; make or remove the calendar link; manage blocked members; sign out; **Delete my account** (not available to an administrator account).

Manual, by the owner:

- A copy of the person's data (access, portability): no export exists; build item "self-service data export (optional)" in the review doc.
- Correcting an email address or school email; changing a role.
- Erasing items that account deletion leaves behind.
- Anything held by a processor.

## 4. Request types

### Access (Sec 16(c))

The person is entitled to reasonable access, on demand, to: (1) the contents of the personal data processed; (2) where it came from; (3) names and addresses of recipients; (4) how it was processed; (5) why it was disclosed to recipients; (6) information on automated processes that are the sole basis of a decision that significantly affects them; (7) when it was last accessed and modified; (8) the identity and address of the controller.

- **Compile from the database** by the student id. Tables that hold a person's data (from `src/db/schema.ts`; check the column names before writing the queries): `student` (profile, role, status, terms version, age confirmation), `session` (network address, browser), `account` (sign-in method link), `verification` (pending codes, stored hashed), `rate_limit_event` (keys can be email, network address or student id), `follow`, `heart`, `block`, `post_view`, `post` and `availability_window` and `post_photo` (their listings), `image` (pictures), `conversation`, `conversation_listing`, `message`, `message_image`, `offer`, `deal`, `deal_report`, `review`, `report` (reports they made and reports about them), `notification`, `push_subscription`. When ID verification exists: its status, reviewer, date and reason records, and the consent record. A read-only query script does not exist yet in the repo [not verified].
- **Hide other people's data.** Messages show the other person's words and name: give the person what they wrote and what they themselves saw; remove other members' personal details beyond what the person already saw in the app.
- **Items 2, 3, 4, 5:** sources are the person, Google sign-in (email only), and the school-email code; recipients are the services in the Privacy Policy ("Who else handles your data"); how it was used is the "Why we use it" section.
- **Item 6:** the app makes no automated decisions about people. Reports hide a listing after three different members report it (`REPORT_HIDE_THRESHOLD`), but a suspension is only ever the owner's decision. Say so in the reply.
- **Item 7:** `updated_at` and `created_at` columns give most of it; sessions give last sign-in.
- **Processors:** the person's email address and the codes' delivery records sit at Resend; support emails at Cloudflare and the owner's mailbox; request logs at Vercel (about an hour). Sentry should hold no identifying data (`src/lib/sentry-options.ts` strips it). Mention these in the reply; there is nothing further to extract from Sentry [confirm in the Sentry project].

### Correction (Sec 16(d))

- Do it **immediately** unless the request is vexatious or otherwise unreasonable. Self-service covers name, handle and picture. Anything else, edit by hand with a query and record what changed.
- If the data was already shared with others and they need to know, tell recipients on the person's reasonable request (Sec 16(d)): in practice, the services above hold the same email; fix there only if it is held there.

### Erasure or blocking (Sec 16(e); IRR Sec 34(e))

The right is exercisable on discovery and substantial proof that data is incomplete, outdated, false or unlawfully obtained, used for an unauthorised purpose, no longer needed, consent was withdrawn or the person objects and nothing else justifies keeping it, the processing is unlawful, or the person's rights were violated (IRR Sec 34(e)(1)).

- **Self-service first:** Delete my account (src/lib/identity/delete-account.ts). It erases: email and school email (replaced by a random address), handle, display name, picture file, calendar link, password and Google link (`account`), sessions, device alerts, notifications, follows, hearts, blocks, view history, pending sign-in codes and sign-in attempt rows keyed to the person. It withdraws open listings, closes pending offers, ends reservations being arranged (the other person is told), and dismisses the open reports the person made and the open reports on their listings.
- **What deletion leaves behind** (see the Privacy Policy "How long we keep it"): messages and message pictures, finished reservations, reviews, withdrawn listings with their text and photos, reports the person made, and a closed account row with no name, email or handle but with the terms version and times.
- **If the person wants those removed too:** decide item by item. Erase or anonymise on request unless keeping the item is needed for other members' record or for legal claims (Data Privacy Act Sec 11(e); Sec 13(f)). [Lawyer: set the rule. The review doc flags this as a proportionality question.] Tools: delete the person's listing photos and text; replace message text with a placeholder; keep the other person's side of a conversation unless they ask too.
- **Backups and copies:** the last 6 hours of history at Neon and any named pre-change copies (docs/release.md) may still hold deleted data until removed. Say so in the reply, with the date they go pre-change copies are removed after 30 days.
- **An administrator account** cannot be deleted in the app (`DELETE_ADMIN`); the owner removes admin first.
- Reply listing exactly what was erased and what was kept and why.

### Objection (IRR Sec 34(b))

- After an objection or withheld consent, stop the processing unless the data is needed under a subpoena, for obvious purposes such as the contract or service the person asked for, or to meet a legal duty (IRR Sec 34(b)).
- Things that can stop for one person: device alerts, the calendar link, stored view history (`post_view`). Things that cannot, because the person chose the service: showing their listings and reviews to others while the account exists, session and sign-in security data. Error reports (Sentry) are stripped of identity and cannot be matched to a person. If the person's objection cannot be met, say why in the reply.

### Portability (Sec 18; IRR Sec 36)

- Applies where data is processed electronically in a structured, commonly used format. Give a copy in a structured, common electronic format, such as JSON files (profile, listings, offers, reservations the person is party to, reviews they wrote, messages they sent, follows, hearts, blocks). The NPC may specify a format (Sec 18); none was read here [to confirm].
- **How to send:** not as a plain email attachment if it holds messages. Use a password-protected file and send the password by a different route (for example a message on the app or text), or a short-lived signed link [owner to choose; no export link exists in the app].
- Pictures: send the person's own listing and message pictures as files if asked.

### Withdrawal of consent

- ID verification: see id-verification-consent.md. Withdrawal is one tap in Settings; by email, do the same on the person's behalf, delete pending images immediately, and remove the badge. Confirm in writing.
- Push alerts and the calendar link: self-service.
- Withdrawal does not affect what was done before (Circular 2023-04 Sec 13(D)).

### Other requests

- A person who wants to know whether their data is processed at all, or who the controller is: answer from the Privacy Policy.
- Damages (Sec 16(f)): this is not a procedure we handle; answer politely, say the person may complain to the NPC, and take legal advice before replying in writing [lawyer].

## 5. Answer

- Answer within 15 days of receipt. If more time is needed, say so before the deadline, with the reason and a date.
- State what was done, what was not and why, and the person's right to complain to the NPC (privacy.gov.ph). Write in plain language.
- Record in the log: date answered, outcome, what was sent.
- If a request is vexatious or unreasonable, you may refuse correction (Sec 16(d)); write down why.

## 6. Templates

**Received:** "We got your request on [date]. We will answer by [date]. To make sure the data goes to the right person, [please confirm ...]. Studiskarte Marketplace."

**Done:** "We have [what was done]. This is what stays and why: [...]. The Privacy Policy says how long other things are kept: [link]. If you are not satisfied, you may complain to the National Privacy Commission (privacy.gov.ph)."

**Cannot do all of it:** "We could not [part] because [reason]. You can [other route], and you may complain to the National Privacy Commission (privacy.gov.ph)."
