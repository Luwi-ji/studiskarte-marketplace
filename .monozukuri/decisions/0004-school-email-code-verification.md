# ADR 0004: Verification by emailed single-use code, restricted to `.edu.ph`

- Status: accepted
- Date: 2026-10-14
- Deciders: project owner (rule and "verify by code" decided, approved), assistant (mechanism)
- Supersedes: ADR 0003

## Context
The owner decided that only students with a school email ending in `.edu.ph` may join, that the app is a PWA, and that verification is by code. Stage 1 requires proof of receiving mail at the address, one account per address, limits on codes sent, and single-use, expiring codes with an attempt limit. Identity and sessions touch every access check and the user table.

ADR 0003 chose emailed links through Auth.js. An installed PWA on iOS has storage separate from Safari and no deep link, so a link that opens in Safari cannot sign in the installed app. One public bug report describes this ([saltV2 #143](https://github.com/eggman0131/saltV2/issues/143)). One report is not a survey, so phase 1 must confirm it on a real iPhone. A typed code does not depend on any of this.

## Options considered
1. Better Auth with the Email OTP plugin, plus our own `.edu.ph` check before sending — typed code, no passwords stored, maintained library / a newer library, and its hooks for the pre-send check and attempt limits are not yet proven.
2. Auth.js with emailed links (ADR 0003) — mature / the link flow is unreliable in an installed iOS PWA.
3. Hand-rolled code table and sessions — full control / security-sensitive code we would own.
4. Password sign-up with emailed confirmation — familiar / we store passwords, and there is more to protect.
5. Studiskarte image upload with manual review — checks a real card / needs reviewers, and the owner did not choose it.

## Decision
Option 1.

## Why this one
A typed code finishes sign-in inside the installed app on every platform. A maintained library handles code issue, expiry, and sessions, so we do not store passwords or write token code. The `.edu.ph` rule stays our own small, separately tested function.

## Tradeoffs and consequences
Phase 1 exit checks, all required:
- Our send-code callback runs on every request, sends nothing for a non-`.edu.ph` address, and sends nothing over the rate limit. Better Auth's own endpoint cannot be used to get a code for another address.
- Better Auth enforces the wrong-attempt limit, the expiry, and one live code per address, as its docs describe.
- A code arrives at real `.edu.ph` inboxes of at least two schools, ideally one on Google mail and one on Microsoft mail.
- Sign-in completes inside an installed PWA on an iPhone and on an Android phone.

If the first two fail, we replace Better Auth with option 3 and supersede this ADR. The rule cannot tell students from faculty and staff, since both hold `.edu.ph` addresses (open question in stage 1). Gmail caps a personal account at 500 recipients per 24 hours and can block server logins, so about 500 codes a day is the ceiling. School mail systems may filter our messages, which would block sign-up for those students.

## Implementation notes (Phase 1)
- Better Auth stores the code **before** it calls our send callback, and a new request rotates the old code. A refusal inside the callback would therefore leave a stored code and could cancel a legitimate student's live code. The `.edu.ph` rule and the rate limits run in a Better Auth `before` hook on `/email-otp/send-verification-otp` and `/sign-in/email-otp`, ahead of any code creation. The callback re-checks the rule and sends only sign-in codes. A `user.create.before` hook and a database CHECK on `student.email` refuse any non-school address that reaches account creation by another path.
- Limits chosen (the stage 1 "limits open" item): 3 code requests per address per 15 minutes, 10 per network address per hour, 10 sign-in tries per address per hour, 30 per network address per hour. Mail stops at 480 sent in 24 hours and warns at 400.
- Checks 1 and 2 are proved by `src/lib/identity/auth.test.ts` (non-school address and over-limit send nothing and store no code, including through the public HTTP handler; wrong tries lock at 3; expiry; one live code; single use). Check 3 so far: one inbox, `tup.edu.ph` (Google mail), received the code in the inbox, not spam, within seconds (2026-10-15). A second school, ideally on Microsoft mail, is still open, as is check 4 (installed iPhone and Android app).
- Better Auth catches any error from `sendVerificationOTP` and still answers success. In production this hid a Gmail login failure: the page said a code was sent when none was. The callback now records the failure in request-scoped storage and `requestSignInCode` reports it, so the form says "could not send" (tested in `auth.test.ts`). Direct calls to the public endpoint still get Better Auth's success reply; the error is in the server log.
- 2026-10-16, owner decision: check 3 is satisfied by one Google-hosted school (`tup.edu.ph`); no Microsoft-hosted inbox will be tested before launch. Context from MX records the same day: of 12 large `.edu.ph` schools, 8 use Google mail (up, ust, dlsu, tip, ue, usc, cpu, slu) and 4 use Microsoft (pup, feu, mapua, adamson). Residual risk: Microsoft-hosted schools could filter our mail. Watch for students from those schools reporting missing codes; the exit path is the sender switch already named in the stack doc.
