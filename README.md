# Studiskarte Marketplace

An installable web app (PWA) where verified students in the Philippines post what they offer and what they seek. Students sign in with an emailed code sent to a `.edu.ph` school address. The system never handles money.

Design lives in `.monozukuri/` (project memory, blueprint, decisions). Read `.monozukuri/project.md` first.

## Local setup

1. `npm install`
2. Create `.env.local` (never committed) with:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon pooled and direct connection strings. **Point these at a development branch, not production.** Tests refuse to run when `NEON_BRANCH=production`. |
   | `NEON_BRANCH` | Name of that branch (e.g. `dev`). |
   | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Session signing secret; the app's public URL (`http://localhost:3000` locally). |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Mail provider over SMTP (Resend: `smtp.resend.com`, `465`, user `resend`, password = API key). `MAIL_FROM` is the sender address on your verified domain. |
   | `MAIL_DAILY_LIMIT` | Optional. The provider's daily send cap; the app stops at 96% and the health job warns at 80%. Default 100 (Resend Free); raise it after upgrading. |
   | `MAIL_TRANSPORT=log` | Local only: print mail to the server log instead of sending. Refused in production. |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 for photos. Needed only to create posts and view photos. |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push alerts. Make a pair with `npx web-push generate-vapid-keys`; the subject is a `mailto:` address. Use a different pair per environment. Without them the app works and shows notifications in the app only. |
   | `CRON_SECRET` | Protects `/api/jobs/run` (at least 16 characters). Needed by Vercel cron and the GitHub Actions workflow. |

3. `npm run db:migrate` applies `src/db/migrations/` to the branch in `.env.local`.
4. `npm run dev`, then open http://localhost:3000.

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Vitest: unit tests and database tests (needs a migrated, non-production database) |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:check` | Prove both Neon connection strings work |

Release, rollback, backup and restore steps, and the pre-launch checklist: `docs/release.md`. The legal text (terms, privacy policy, community guidelines) goes in `content/legal/`; see that file.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, migrations, tests and build against a PostgreSQL service container.
