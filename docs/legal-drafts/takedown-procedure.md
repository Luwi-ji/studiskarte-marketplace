DRAFT for lawyer review, not live.

# Reporting and taking down prohibited or unsafe listings

Part 1 is wording for the public (Terms and Community Guidelines, or a short /report page). Part 2 is the owner's internal procedure, using the existing /admin queue. It is written to work whether or not the Internet Transactions Act (RA 11967) applies to this app; see the notes at the end.

## Part 1: public wording

**Report a listing or a person**

If you see something that breaks the rules, tell us.

- **In the app:** tap **Report** on a listing or on a person, and choose the reason: spam or an advertisement; a scam or fraud; something that is not allowed here; offensive content; harassment or threats; pretending to be someone else; or something else. You can add up to 500 characters.
- **By email:** write to support@studiskarte.com with the link to the listing or the person's handle, what is wrong, your name and a way to reach you. If a listing infringes a right you hold (for example a trademark or copyright), say so and say how you hold the right.
- **Urgent:** if a listing is for something illegal, unsafe or dangerous (for example drugs, weapons, fireworks, counterfeit goods or anything that could hurt someone), say "urgent" in the subject line.

**What we do**

- A listing reported by three different members is hidden at once and goes to the owner. A listing with fewer reports also goes to the owner, but stays up until the owner decides.
- The owner decides whether to restore the listing, remove it, or suspend an account. Urgent reports about illegal, unsafe or dangerous listings come first: we aim to act within 24 hours. We aim to look at every other report within 3 working days.
- If we hide or remove a listing, the member who posted it is told in the app. Any reservation on a removed listing ends.
- If you reported by email, we reply to that email with what we decided.
- We do not tell the member you reported who reported them.
- If a government agency orders a listing removed, we remove it.

**If you disagree with a decision**

If we removed your listing or suspended your account and you think we got it wrong, or if a report you made was ignored, write to support@studiskarte.com. We will answer within 7 days.

## Part 2: internal procedure

### 1. How reports arrive

| Channel | What it creates | Notes |
| --- | --- | --- |
| In-app Report on a listing | A row in `report` (reporter, reason, optional details up to 500 characters, status open). Hides the post at the third different active member. | Reasons: spam, scam, prohibited, offensive, harassment, impersonation, other (`src/lib/safety/report.ts`). A member can send 20 reports an hour. |
| In-app Report on a person | A `report` row against the student. Never suspends by itself. | |
| Email to support@studiskarte.com | Nothing in the app. | Gap: see 3, "Notices that arrive by email". |
| Order or request from a government agency (DTI, police, another regulator) | Nothing in the app. | See 5. |

Read the support mailbox and the /admin queue on a fixed rhythm: [owner to set, for example every morning and evening]. The code does not alert the owner when a report is filed (none was found; not exhaustively checked). A report that sits unseen is the main risk to the response times.

### 2. Triage: set the priority and start the clock

Write the time the notice was received. That is the start of the response time.

- **P1: prohibited, unsafe or dangerous, apparent from the photo or description.** Examples named in the Internet Transactions Act Sec 15(a): endangered animals, illicit drugs, fireworks and other explosives, counterfeit goods; plus anything the Terms forbid outright (medicine, alcohol, tobacco, vapes, weapons, past exams, school IDs). Target: 24 hours.
- **P2: other rule breaks** (scam, misleading listing, spam, impersonation, offensive). Target: 3 working days.
- **P3: harassment or conduct by a person.** Target: 3 working days. Act sooner if there is a safety risk.
- **P4: intellectual property claim** (a right holder says a listing infringes). Treat like P1 once the claim is clear. The Act refers to failing, after notice, to remove or disable goods that infringe intellectual property (Sec 26(b)).
- **P5: government order.** Same day. See 5.

If it is not clear that the item is prohibited, hide first, then ask the poster for proof or an explanation [lawyer: confirm that hiding while we check is acceptable].

### 3. Steps in /admin

Open /admin (an admin account; the flag is re-read from the database on every action).

**Posts to review** lists posts with open reports, hidden ones first, then the most reporters, then the oldest. Each card shows the cover photo, the title (a link to the listing), its status and owner, the number of different reporters and each report's reason and details.

- **Restore** (hidden posts only): the post goes back to what it was before it was hidden (open if unknown). The open reports are dismissed, so three new reports are needed to hide it again, and the owner is told.
- **Remove** (open, reserved or hidden posts; asks you to confirm): takes the post down for good. The open reports are closed as actioned, every reservation being arranged or agreed on it is ended by the system, and the owner is told. The post and its photos stay in the database with status removed, which keeps the evidence.
- **Dismiss reports** (open or reserved posts only): the reports were not a problem; they are closed as dismissed and the post stays.

**Students reported:**

- **Suspend** (asks you to confirm): the person cannot sign in and every session ends. Only for an active account, never yourself or another admin. The person is not told by the app [consider telling them by email, with the reason and how to appeal].
- **Dismiss reports:** no action.

**Suspended students:** **Restore** gives the account back.

For P1 and P4: open the listing, decide, and press **Remove**. Nothing hides a post on demand before it has three reports, so do not wait for the third report: a post that is in the queue (it has at least one open report) and is open, reserved or hidden can be removed straight away.

**Notices that arrive by email.** The queue only lists posts that have at least one open report, and email notices create none. Until a way to file a notice from the admin screen is built, file a report on the post from the admin's own account (Report on the listing), so it appears in the queue, then press **Remove** or **Dismiss reports** [verify that the admin account can use Report; the code allows any signed-in member except the post's own owner]. Build item: "record a notice" in /admin with channel, notice text and a reason for the decision.

**If the post is no longer open, reserved or hidden** (withdrawn, expired, removed): **Remove** is refused. A withdrawn or expired post is not shown to others; note this in the log. If it matters (for example a government order), the listing and its photos still exist in the database and can be dealt with by hand [owner to decide].

### 4. After the decision

- **Poster:** told in the app when a post is hidden, restored or removed (notification types `post_hidden`, `post_restored`, `post_removed`). The notice has no reason text today. Build item: let the admin add a reason that the poster sees, so that the poster can understand and appeal.
- **Reporter:** if the report came by email, reply with the outcome within the response time. In-app reporters are not told the outcome today [decide whether to build that before promising it; Part 1 only promises an email reply for email reports].
- **Repeat or serious cases:** suspend the account (see 3) and tell the person by email, with the reason and how to appeal.
- **Appeals:** the owner re-reads the decision with fresh eyes, within 7 days. If it was wrong: **Restore** (if the post was hidden) or ask the poster to post again (a removed post cannot be restored in the app). Write the outcome in the log.
- **Complaints that remain unresolved:** the Act treats the platform's internal redress as exhausted if a complaint is unresolved 7 calendar days after filing (Sec 24, read). Aim to reply well inside that.

### 5. Government takedown orders and requests

Under the Act (Sec 15, read) the DTI Secretary may issue an ex parte takedown order for a listing, for example for prohibited or regulated goods that are apparent from the photo or description, goods under a cease-and-desist order, reposts after an earlier order, and goods that threaten public or personal safety. The order is directed at the merchant and at the owner or operator of the platform, and copies go to others who must help enforce it. The order lasts up to 30 days unless made permanent by a court. The affected seller must be given a chance to be heard within 48 hours of the order. A platform that willfully or unreasonably refuses to comply faces fines (Sec 29(c)).

Steps:

1. Log the order: who, when, what listing, what legal basis.
2. Remove the listing the same day (see 3).
3. Tell the poster, with a copy of the order if allowed.
4. Watch for reposts of the same thing by the same account or by new accounts; remove and suspend (Sec 15(c) treats reposting after a takedown as a ground for a new order).
5. Reply to the agency in writing that the listing was removed, with the time. Take legal advice before replying to anything beyond that [lawyer].
6. Do not hand over personal data about members unless a lawful order or subpoena requires it (Sec 22(e) in the Act: information on a subpoena based on a sworn complaint). Ask the lawyer before releasing anything.

### 6. Record keeping

The app's own record: each `report` row keeps reporter, target, reason, details, status, which admin handled it and when. It does not keep why the admin decided, or reports received by email. Until an admin audit log exists (a build item in the review doc), keep a private log outside the repository, one row per notice:

- Received (date, time, channel), who sent it (name and contact if by email; "in-app" with the report time otherwise).
- What it is about (post id or handle; title), reason, priority.
- Decision and action (Restore, Remove, Dismiss, Suspend, none), by whom, date and time done.
- Poster told (date) and reporter told (date).
- Appeal received and outcome.
- Government order details if any.

Check once a month: how many notices, how many met the target time, any repeat offenders. Keep the log for [period, lawyer to set]. It holds personal data (names, emails of reporters), so it follows the same rules as everything else.

## Notes for the lawyer

- Internet Transactions Act (RA 11967), lawphil.net, read in full: Sec 3 excludes consumer-to-consumer transactions (Sec 4(c): between end-users for personal, family or household purposes and not in the ordinary course of business). If occasional student resales are outside the Act, the platform duties of Sec 22 may not apply; if a seller is a business, they may. The procedure above is deliberately the same either way.
- Sec 22(d): digital platforms that do not retain oversight of the consummation of the transaction must provide an effective and responsive redress mechanism to report a user or information that violates relevant laws. Sec 26(b) and Sec 27: liability if, after notice, the platform fails to act expeditiously to remove goods that infringe intellectual property or are under a takedown order (Sec 26(b)), or goods prohibited by law, imminently injurious, unsafe or dangerous (Sec 27). What "notice" and "expeditiously" mean in practice, and any formal requirements for a notice, are in the Act's Implementing Rules (Joint Administrative Order 24-03), which could not be fetched (the DTI site did not answer) [to confirm].
- Response times (set 2026-10-22 from the owner's legal review, still for the lawyer to confirm against the IRR): 24 hours for urgent and child safety reports (RA 11930 Sec 9(a)(3)), 3 working days for other reports, 7 days for appeals and complaints (ITA Sec 24), 15 days for data rights requests (NPC Rules of Procedure Rule II Sec 2).
- A single formal notice (from a government agency, a rights-holder, or an affected person) about a P1 listing is actioned by the owner at once; the 3-report counter does not apply. Child safety reports already hide a listing on the first report (built, migration 0032).
- Open: whether the app must flag accounts that sell regularly (Sec 22(a), (e)); whether regulated goods such as food need a permit or licence shown on the listing (Sec 22(b)); whether the 3-report threshold is consistent with acting expeditiously on a single clear notice.
