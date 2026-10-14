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
