# Admin runbook for the owner

Written 2026-10-23. One page of habits and steps for running Studiskarte Marketplace alone. Not legal advice; the legal duties are in `docs/legal-drafts/ph-law-research.md` and are still waiting for a lawyer.

You promised members (live Terms, Child Safety Standards): urgent and child safety reports read within **24 hours**, other reports within **3 working days**, appeals answered within **7 days**. Check twice a day so you can keep that.

## Every morning and evening (10 minutes)

1. **Email.** `support@` and `dpo@` arrive in your own inbox. A subject starting "URGENT: child safety report" means do the child safety steps below now. "New report waiting" is sent at most once an hour.
2. **Admin, Moderation.** Child safety reports sit at the top. Then posts to review (hidden ones first), students reported, **Deal problems**, and **Recent decisions**.
3. **Admin, ID checks.** Review anything waiting. Pictures are deleted after 7 days if you do not decide.
4. **Admin, System.** Free-tier limits (mail, photo storage, database) and the scheduled jobs. A job marked overdue or failed needs a look at the GitHub "Scheduled jobs" workflow. GitHub also emails you when that workflow fails.

## When a report or a person needs a decision

- **Remove** a post: asks for a reason, which the poster reads. **Restore**: the reason is optional. **Dismiss reports**: nothing is shown to anyone. **Suspend** a person: asks for a reason (kept in the record); they are signed out everywhere and see "Your account is suspended" only if they give the right password.
- Every decision is written to the admin record (who, what, why, when). Use plain reasons you would be happy for the person to read.
- To find a post nobody reported, use Admin, Posts (search by title or owner).
- **Appeals:** the person writes to `support@` from their account email. Answer within 7 days. To reverse: Restore the post, or Restore the person (Users tab or Suspended students list), with a short reason. A child safety removal is final.

## Child safety report: the first hour

A report with the child safety reason hides the post at once, and you get an email.

1. Open the post in Admin. Look only as much as you need. **Do not download, copy, screenshot or forward the material**, to anyone, including the authorities (they will ask you for links and times, not files).
2. Write down, outside the app, in a private note: post link, handle of the poster, handle of the reporter, date and time with time zone, what you saw in a sentence.
3. If it is clearly child sexual abuse or exploitation material, or grooming: **Remove** the post (reason: "Child safety"), then **Suspend** the poster (reason: "Child safety"). Do this within 24 hours of the report (RA 11930 Sec 9(a)(3), as I read it).
4. **Report to the authorities** within 3 days, in writing, with the facts from step 2: DOJ Office of Cybercrime (cybercrime@doj.gov.ph, (02) 8524-8216) and the NCC-OSAEC-CSAEM Secretariat (ncc.osaec.csaem@doj.gov.ph, (02) 8524-8939). More contacts are on the Child Safety Standards page. Keep a copy of what you sent and the date. If a child is in danger now, call 911.
5. **Do not tell the account holder** about the report or the referral. Do not reply to them about it.
6. **Keep the evidence.** Do not delete the post, the account records or the messages. If the poster is a minor who sent a picture of themselves, treat them as the victim, not the offender: do not shame them and do not publish who they are.
7. If a report turns out to be a mistake: **Restore** the post with a reason and dismiss. A report made in good faith is not punished.

**Known gap (build item):** a person can delete their own account from Settings, which erases their email and other details even if you are holding them for a child safety case. There is no "legal hold" yet. Until it exists, write the handle, post id and date down in step 2 before you suspend, and do not wait. Tell a lawyer about this gap.

## ID check review

The member's pictures open only through short links, and every view is written down. Look at the checklist on the page: name, school, role, same person holding the same document, document shows they are at least 16 (graduates: the document shows they graduated). Approve confirms identity, role and age. Reject needs a reason the member reads; they can try 3 times in total.

## Requests from members about their data

Access, correction, deletion, objection: answer within 15 days (`docs/legal-drafts/rights-requests.md`). Write to the member from the address on their account. Account deletion is in Settings; messages, finished reservations and reviews stay under "Deleted account".

## If something breaks or leaks

- **Site down or errors:** Sentry (errors), Vercel (deployments and logs), Neon (database). To roll back a bad deploy: Vercel, Deployments, promote the last good one. Migrations only move forward; named `pre-...` Neon branches are rollback copies (keep the latest few; the limit is 10 branches).
- **Personal data breach:** follow `docs/legal-drafts/breach-response.md`. The clock for telling the National Privacy Commission and the people affected is 72 hours from knowing (NPC Circular 16-03 as I read it).
- **ID checks must stop:** remove `R2_ID_BUCKET` in Vercel and redeploy. Nothing is lost; the check screens return 404 and the showcase limit switches off.

## Every week

- Look at Admin, System: mail used per day, photo storage, database size.
- Delete old `pre-...` Neon branches you no longer need.
- Check the GitHub "Scheduled jobs" and CI runs are green.

## Before opening to more people

Load check (public pages): `node scripts/load-check.mjs https://studiskarte.com`. The result on 2026-10-23 was 200 requests at a time of 20 with no failures: /sign-in p50 335 ms and p95 2.6 s, /api/health/db p50 289 ms and p95 2.4 s. The database connection is what slows first on the free plan.
