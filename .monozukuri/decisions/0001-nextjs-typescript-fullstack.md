# ADR 0001: One full-stack TypeScript application

- Status: accepted
- Date: 2026-10-14
- Deciders: project owner, assistant

## Context
Stage 1 flows are forms, lists, and private threads. Users are students, mostly on phones. There is one team and no separate client apps. Reversing this choice later touches every module.

## Options considered
1. Next.js full-stack in TypeScript — one deployable, server-rendered pages, shared types / larger framework, with its own conventions to learn.
2. Separate SPA and API — clear boundary, reusable API for future apps / two deployables and duplicated validation, with no stage 1 need.
3. Python/Django with templates — mature, with built-in admin / a second language if the UI grows richer.

## Decision
Option 1.

## Why this one
It is the smallest setup that serves all stage 1 flows and keeps validation and types in one place. Nothing in stage 1 requires a public API or a native app.

## Tradeoffs and consequences
We depend on the framework's conventions and release pace. If a native app is added later, we extract the server logic behind an API. Access checks live in one server module so that extraction stays cheap.
