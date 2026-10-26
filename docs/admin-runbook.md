# Admin runbook for the owner

Written 2026-10-23. One page of habits and steps for running Studiskarte Marketplace alone. Not legal advice; the legal duties are in `docs/legal-drafts/ph-law-research.md` and are still waiting for a lawyer.

You promised members (live Terms, Child Safety Standards): urgent and child safety reports read within **24 hours**, other reports within **3 working days**, appeals answered within **7 days**. Check twice a day so you can keep that.

## Every morning and evening (10 minutes)

1. **Email.** `support@` and `dpo@` arrive in your own inbox. A subject starting "URGENT: child safety report" means do the child safety steps below now. "New report waiting" and "ID check waiting" are each sent at most once an hour.
2. **Admin, Overview.** The "Needs your attention" strip at the top counts child safety reports (red when above zero), other open reports, hidden posts, ID checks waiting and deal problems. Each tile opens the right tab.
3. **Admin, Moderation.** Child safety reports sit at the top. Then posts to review (hidden ones first), students reported, **Deal problems**, and **Recent decisions**.
4. **Admin, ID checks.** Review anything waiting. Pictures are deleted after 7 days if you do not decide.
5. **Admin, System.** Free-tier limits (mail, photo storage, database) and the scheduled jobs. A job marked overdue or failed needs a look at the GitHub "Scheduled jobs" workflow. GitHub also emails you when that workflow fails.
6. **GitHub, Actions.** The latest **Production database backup** must be green. That result means the encrypted object was uploaded, downloaded, decrypted and restored—not only that a dump command ran.

## Admin security

Open Admin, **Security** and enroll an authenticator before using the admin tools in production. Save the recovery codes offline; each works once. Admin access is remembered for 12 hours. Removing posts, suspending or restoring people, deciding ID checks, and revealing a new partner PIN or report link asks again after 15 minutes.

If the authenticator is unavailable, choose **Use a recovery code** on the security check. After using a recovery code, open Admin → Security and replace the remaining codes if anyone else may have seen them.

If both the authenticator and every recovery code are lost, use Neon SQL as the account owner. Verify the target email twice, then run one transaction:

```sql
BEGIN;
DELETE FROM two_factor WHERE student_id = (SELECT id FROM student WHERE email = 'owner@example.com');
UPDATE student SET two_factor_enabled = false WHERE email = 'owner@example.com' AND is_admin = true;
COMMIT;
```

Sign in, enroll again immediately, save new recovery codes, and record the recovery as a security incident. Never disable MFA for convenience.

## When a report or a person needs a decision

- **Remove** a post: asks for a reason, which the poster reads. **Restore**: the reason is optional. **Dismiss reports**: nothing is shown to anyone. **Suspend** a person: asks for a reason (kept in the record); they are signed out everywhere and see "Your account is suspended" only if they give the right password.
- Every decision is written to the admin record (who, what, why, when). Use plain reasons you would be happy for the person to read.
- To find a post nobody reported, use Admin, Posts (search by title or owner).
- **Take a listing off the public web:** shared listing links (`/s/<id>`) show only a photo, price, title and school, and only for a live listing. **Remove** or hide the post (Admin, Posts or the review queue), or suspend its owner, and the page says "This listing is no longer available" at once; the link-card picture that chat apps fetch is cached for 5 minutes, so it is gone within about 5 minutes. A copy already posted in someone's story or saved by a social network is theirs to delete.
- **Appeals:** the person writes to `support@` from their account email. Answer within 7 days. To reverse: Restore the post, or Restore the person (Users tab or Suspended students list), with a short reason. A child safety removal is final.

## School abbreviations

Listing cards show a short school name such as TUP-M instead of the full name. Open Admin, **Schools**: every school is listed with the name cards use now. Until you set one, the card shows the capital letters of the full name (grey in the list). Type an abbreviation (1 to 12 characters) and press **Save**; empty the box and press **Clear** to go back to the automatic one. It shows on feed cards after the next page load. This is a low-risk edit and is not written to the admin record.

## Partner perks

Open Admin, **Perks** to add a shop, then add its live perks. Give the shop its four-digit PIN; the cashier enters it only on the student's voucher screen. If the PIN is shared outside the shop, use **New PIN** and send the replacement privately.

Each shop also has a private, read-only report link. Send it directly to the shop, never post it publicly. **New link** revokes the old link immediately. The report contains claim and redemption totals, voucher codes and times, but no student names or handles. Ask the shop to write the voucher code on the receipt and compare receipts with the report.

Pause a perk or shop to remove it from students immediately without losing history. End it when it will not return. Editing a perk keeps existing claims and limits; to change its per-student limit, end it and add a new perk.

## Child safety report: the first hour

A report with the child safety reason hides the post at once, and you get an email.

1. Open the post in Admin. Look only as much as you need. **Do not download, copy, screenshot or forward the material**, to anyone, including the authorities (they will ask you for links and times, not files).
2. Write down, outside the app, in a private note: post link, handle of the poster, handle of the reporter, date and time with time zone, what you saw in a sentence.
3. If it is clearly child sexual abuse or exploitation material, or grooming: **Remove** the post (reason: "Child safety"), then **Suspend** the poster (reason: "Child safety"). Do this within 24 hours of the report (RA 11930 Sec 9(a)(3), as I read it).
4. **Report to the authorities** within 3 days, in writing, with the facts from step 2: DOJ Office of Cybercrime (cybercrime@doj.gov.ph, (02) 8524-8216) and the NCC-OSAEC-CSAEM Secretariat (ncc.osaec.csaem@doj.gov.ph, (02) 8524-8939). More contacts are on the Child Safety Standards page. Keep a copy of what you sent and the date. If a child is in danger now, call 911.
5. **Do not tell the account holder** about the report or the referral. Do not reply to them about it.
6. **Keep the evidence.** Do not delete the post, the account records or the messages. If the poster is a minor who sent a picture of themselves, treat them as the victim, not the offender: do not shame them and do not publish who they are.
7. If a report turns out to be a mistake: **Restore** the post with a reason and dismiss. A report made in good faith is not punished.

**Legal hold (built 2026-10-23).** A child safety report about a person, or about one of their listings, that is open or was acted on, stops that person from deleting their account (Settings shows only "This account can't be deleted right now. Write to support@studiskarte.com." and does not say why). A dismissed report holds nothing. For any other case, such as a lawful order, use Admin, Users, **Hold records** (a reason is required, and it is written to the admin record); **Lift hold** undoes only a hold you placed, never the one that comes from a child safety report. A suspended person cannot sign in, so they cannot delete anyway. Still write the note in step 2: the hold keeps the records, it does not write your report for you. Tell the lawyer the hold exists and ask whether blocking deletion is the right way to meet the preservation duty.

## ID check review

The member's pictures open only through short links, and every view is written down. Look at the checklist on the page: name, school, role, same person holding the same document, document shows they are at least 16 (graduates: the document shows they graduated). Approve confirms identity, role and age. Reject needs a reason the member reads; they can try 3 times in total.

## Requests from members about their data

Access, correction, deletion, objection: answer within 15 days (`docs/legal-drafts/rights-requests.md`). Write to the member from the address on their account. Account deletion is in Settings; messages, finished reservations and reviews stay under "Deleted account".

## If something breaks or leaks

- **Site down or errors:** Sentry (errors), Vercel (deployments and logs), Neon (database). To roll back a bad deploy: Vercel, Deployments, promote the last good one. Migrations only move forward; named `pre-...` Neon branches are rollback copies (keep the latest few; the limit is 10 branches).
- **Personal data breach:** follow `docs/legal-drafts/breach-response.md`. The clock for telling the National Privacy Commission and the people affected is 72 hours from knowing (NPC Circular 16-03 as I read it).
- **ID checks must stop:** remove `R2_ID_BUCKET` in Vercel and redeploy. Nothing is lost; the check screens return 404 and the showcase limit switches off.
- **Turnstile unavailable:** signup-code, password-reset-code and public-contact requests fail closed. Check the Cloudflare widget status and both Vercel variables (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`); do not bypass the server check in production.
- **Backup failed:** open the failed **Production database backup** job. Fix credentials, R2 access, storage, encryption, or restore errors and rerun it manually. Do not call a stored object usable until the restore step passes.

## Every week

- Look at Admin, System: mail used per day, photo storage, database size.
- Delete old `pre-...` Neon branches you no longer need.
- Check the GitHub "Scheduled jobs" and CI runs are green.
- Check the GitHub **Production database backup** run is green and that the private R2 bucket has recent encrypted `production/*.dump.age` objects but no public domain.

## Before opening to more people

Load check (public pages): `node scripts/load-check.mjs https://studiskarte.com`. The result on 2026-10-23 was 200 requests at a time of 20 with no failures: /sign-in p50 335 ms and p95 2.6 s, /api/health/db p50 289 ms and p95 2.4 s. The database connection is what slows first on the free plan.
