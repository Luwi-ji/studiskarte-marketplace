# ADR 0003: Verification by emailed single-use link, restricted to `.edu.ph`

- Status: superseded by ADR 0004
- Date: 2026-10-14
- Deciders: project owner (rule decided), assistant (mechanism, approval pending)

## Context
The owner decided that only students with a school email ending in `.edu.ph` may join. Stage 1 requires proof of receiving mail at the address, one account per address, and limits on confirmation mail. Identity and sessions touch every access check and the user table.

## Options considered
1. Auth.js with the email provider, plus our own `.edu.ph` check before sending — maintained library, no passwords stored / ties sign-in to its adapter and flow.
2. Hand-rolled token table and session code — full control / security-sensitive code we would own and have to get right.
3. Password sign-up with an emailed confirmation — familiar / we store passwords, and there is more to protect.
4. Studiskarte image upload with manual review — checks a real card / needs reviewers, and the owner did not choose it.

## Decision
Option 1.

## Why this one
Receiving a single-use, expiring link is the proof stage 1 asks for. A maintained library handles tokens and sessions, so we do not store passwords or write token code. The `.edu.ph` rule stays our own small, separately tested function.

## Tradeoffs and consequences
The rule cannot tell students from faculty and staff, since both hold `.edu.ph` addresses (open question in stage 1). Mail is sent through Gmail (owner's choice), which caps a personal account at 500 recipients per 24 hours and can block server logins. School mail systems may also filter our messages, which would block sign-up for those students. Phase 1 must show real delivery to at least one `.edu.ph` inbox. Phase 1 must also confirm that Auth.js lets us reject an address before sending. If not, we switch to option 2 and supersede this ADR.
