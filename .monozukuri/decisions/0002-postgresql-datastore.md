# ADR 0002: PostgreSQL carries the business invariants

- Status: accepted
- Date: 2026-10-14
- Deciders: project owner, assistant

## Context
Stage 1 states invariants that must hold under concurrent requests: one conversation per (post, responder), one account per school email, non-negative prices, an immutable post kind. Boards also need text search and category filters. Changing the datastore later touches the whole data model.

## Options considered
1. PostgreSQL — unique, check, and foreign-key constraints, built-in full-text search, managed hosting widely available / needs a hosted instance.
2. SQLite — no server to run / a single writer is awkward on a hosted serverless setup.
3. MongoDB — flexible documents / the invariants would live only in application code.

## Decision
Option 1.

## Why this one
Constraints in the database hold even when two requests race, or when a bug skips an application check. It also covers search with no extra system.

## Tradeoffs and consequences
We run, or pay for, a hosted PostgreSQL. Full-text search is less capable than a dedicated engine. We revisit it if search quality becomes a measured problem.
