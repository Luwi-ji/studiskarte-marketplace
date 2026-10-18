# ADR 0005: Password login, code-verified sign-up, visitors, and a school email that can be added later

- Status: accepted
- Date: 2026-10-19
- Deciders: project owner (the flows), assistant (mechanism)
- Supersedes: the "no passwords" part of ADR 0004. Its code mechanism stays, for sign-up and reset.

## Context
ADR 0004 signed people in with an emailed code alone and rejected passwords because we would store them. The owner noticed that this is not a login: anyone who can read the mailbox for a minute gets in, every time, and each sign-in costs a mail against Gmail's 500 a day. The owner also wants visitors (people without a school email) and a way for a visitor to become a student later (docs/roles-and-verification-plan.md).

## Decision
- **Create account:** an email, a code sent to it (proves the address; no account row exists before the right code), then a password, then the profile. A school address (`.edu.ph`) makes a student, faculty, staff or alumni (the person picks which on the profile step). Any other address makes a visitor. The address decides: the "School email" and "Visitor" choices only stop a mistake.
- **Log in:** email, school email or handle, plus password. One screen for everyone. Every failure gets one answer; a missing or suspended account spends the same hashing time.
- **Forgot password:** a code to the account's sign-in email, then a new password. The same answer whether or not an account exists. A reset ends every other session. This is also how accounts made before this change (they have no password) get their first one.
- **Google:** Better Auth's Google provider. Google's confirmed address is treated like our code: the same address links to the existing account without asking for the password (both were proved by mail), and a new address makes an account the same way a code would (school address, student; otherwise visitor), then asks for a password on the first screen. Names and pictures from Google are not stored. Needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; without them the button is hidden. Only `/api/auth/callback/google` is mounted.
- **A visitor can add a school email** (Settings): a code to it, then the account becomes a member of that school with the chosen role. The sign-in email stays; both work as a login name. `student.school_email` is unique, so one person has one account per school email. Its own code (single use, 10 minutes, 3 tries) is kept in the `verification` table because Better Auth's store is tied to sign-in addresses.
- **Data:** migration 0028. `student.email` is any address; `school_domain` is nullable; new `school_email` (unique) and `role`. CHECKs: school email shaped like a school address and matching the domain; domain set exactly when school email is; role `visitor` exactly when there is no school email. A deleted account releases its school email and keeps no school.
- **Sign-up codes never log anyone in:** an address that already has an account gets no sign-up code (the person is told to log in or reset), and a sign-up code for such an address is refused.
- Passwords: 8 to 128 characters, hashed by Better Auth (scrypt). 10 tries per name and 30 per network address an hour. Plus signs, `%` and `!` stay refused in every address (ADR 0004).

## Consequences
- We now store password hashes. They are in `account.password`, never selected by app code.
- Mail volume falls: codes are sent only at sign-up, school email attach and reset.
- Visitors exist before their rules do. Not built here: the per-listing "allow non-students" flag, the one-showcase limit, ID verification, onboarding tour. So visitor sign-up (any non-school address, by code or Google) is refused unless the deployment sets `ALLOW_VISITORS=true`; turn it on only after those rules and the mail-provider switch exist (docs/roles-and-verification-plan.md). A school email always works.
- Two Gmail addresses that differ only by dots are two accounts for visitors. Accepted: Google returns the address as the person typed it, so folding would break linking.
- Google sign-in at a school's Workspace may be blocked by that school's admin; nothing here can test that.
