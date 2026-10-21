DRAFT for lawyer review, not live.

# Personal data breach response (runbook for a solo owner)

Internal. Not public. Based on NPC Circular 16-03 (Personal Data Breach Management, 15 December 2016), read in full, and the Data Privacy Act Sec 20(f) and its IRR Sec 38. Section numbers below are from the Circular unless stated. Timings are the Circular's; the lawyer should confirm they are still current, because the Circular says its details may be amended by announcement on the NPC website (Sec 23).

Review this runbook at least once a year and write the date here (Sec 10): last review [date], next review [date].

## 0. Who does what

- The **owner** is the response team (Sec 5 requires at least one member with authority to make immediate decisions). Functions may be outsourced, but accountability stays with the owner (Sec 5).
- **Data Protection Officer:** Lowel-Jay Rubino, dpo@studiskarte.com. The notification to the NPC must name the DPO and a designated representative (Sec 17(E)). If the DPO is not the one handling the incident, send the DPO a written report of actions taken (Sec 5).
- **Legal help:** [lawyer name and contact].
- The obligation to notify stays with the owner even though Vercel, Neon, Cloudflare, Resend and Sentry process the data (Sec 15). Each should tell us if they have a breach (Sec 16): see the contact list at the end.

## 1. What counts

A **personal data breach** is a security breach that leads to accidental or unlawful destruction, loss, alteration, or unauthorized disclosure of or access to personal data (Sec 3(F)). It can be about availability (data lost or destroyed), integrity (data altered) or confidentiality (someone saw or took it). A **security incident** is wider: anything that affects or tends to affect the availability, integrity or confidentiality of data, including incidents that would have been a breach but for safeguards (Sec 3(J)). Every security incident gets written up (Sec 22), even when nobody has to be told.

Examples for this app: a leaked environment secret; database exported by someone else; the private bucket or an ID image made public; the wrong person reading messages; the admin account taken over; a deploy that shows one member's data to another; a lost laptop with production credentials; a vulnerability that would allow access to data (Sec 14: assess whether a breach occurred).

## 2. Detect

Where news of an incident will come from:

- **Sentry** (errors from the server and browsers, once `NEXT_PUBLIC_SENTRY_DSN` is set).
- **Vercel** runtime logs: they last only about an hour (docs/release.md), so **export what you need at once** if you suspect something.
- **GitHub emails:** the Scheduled jobs workflow failing, or a deploy or CI failure.
- **Neon, Cloudflare, Resend** dashboards and emails (unusual traffic, a key used from somewhere unexpected, a mail quota spike).
- **A member or outsider writing to support@studiskarte.com.** Read the support mailbox every day.
- **A processor's notice.**
- **The admin audit log** (once built; the review doc lists it as a build item) for any unexpected view of an ID image.

**Start the clock.** The 72 hours run from "knowledge of or reasonable belief that a personal data breach has occurred" (Secs 17(A), 18(A)). The moment you have that belief, write the date and time in the log (section 6) as T0. If you are unsure, write down the time you first saw the signal; do not wait for certainty.

## 3. Contain (first hour)

Do the minimum that stops the leak and keeps evidence. Do not delete anything.

1. **Preserve evidence first:** screenshot or export the Sentry issue, the Vercel logs, the dashboards, and the email that raised the alarm. A Neon branch of the current state preserves data as it is now: `npx neonctl branches create --project-id late-dew-47090405 --name incident-<date>` (docs/release.md). Do not run a restore without `--preserve-under-name`.
2. **Stop new exposure:**
   - Bad deploy: Vercel dashboard, Deployments, Promote the last good one (docs/release.md, Rollback).
   - One member abusing: /admin, Suspend (signs them out everywhere).
   - Maintenance page or taking the app down: Vercel, pause the deployment [owner to confirm the exact steps for this plan].
3. **Rotate whatever may have been exposed** (variable names from README.md). After rotating, update Vercel and redeploy:
   - `DATABASE_URL`, `DATABASE_URL_UNPOOLED`: reset the database role password in Neon.
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: create a new Cloudflare API token, then revoke the old one. Check the bucket has no public access and no `r2.dev` domain (docs/release.md, item 4).
   - `SMTP_PASSWORD`: create a new Resend API key limited to sending, revoke the old one.
   - `BETTER_AUTH_SECRET`: expected to sign every member out [verify the effect before relying on it].
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: expected to invalidate every device alert subscription [verify].
   - `CRON_SECRET`: change it in Vercel and in the GitHub repository secrets.
   - `GOOGLE_CLIENT_SECRET`: rotate in Google Cloud.
   - The Sentry DSN is public by design (docs/release.md); rotating it is not a containment step.
4. **If the admin account is involved:** change the email's own password and two-step sign-in first, then remove admin from the account and end its sessions (the `admin:set` script in package.json, or a query in Neon), then restore it once safe.
5. **Check whether the weakness is still open** (Sec 14, Sec 8(C)(3): secure evidence, contain, restore integrity).

## 4. Assess (same day if possible)

Fill in the log (section 6) as you go.

**A. What happened, what data, how many.** Use the inventory in docs/release.md and the Privacy Policy: email, school email and school, role, handle, display name, picture, session network address and browser, messages and pictures, listings and photos, offers, reservations, reviews, reports, push addresses, calendar-link hash, terms version and age confirmation. If ID verification is open: ID or certificate of registration images and photos of people holding them. Count the people affected (Sec 17(D)(1)(c)).

**B. Is notification required?** All three must hold (Sec 11):

1. The data involves **sensitive personal information** (Data Privacy Act Sec 3(l): age, education, government-issued identifiers and more) or **other information that may enable identity fraud**, which the Circular says includes usernames, passwords and other login data, biometric data, and copies of identification documents (Sec 11(A)). In this app: ID images always count; email plus a way to sign in counts; school and role are education data.
2. There is reason to believe it **may have been acquired by an unauthorized person** (Sec 11(B)).
3. The owner or the NPC believes the acquisition **is likely to give rise to a real risk of serious harm** to any affected person (Sec 11(C)).

A claim that the data was already public does not by itself remove the duty (Sec 12). When unsure, weigh first the likelihood of harm and how telling people would reduce it, and note whether the data involves at least 100 people, confidential data, or vulnerable people (Sec 13). Write down the reasoning either way. **If in doubt, notify.** Concealing a breach is itself an offence under the Data Privacy Act (Sec 30 is headed "Concealment of Security Breaches Involving Sensitive Personal Information"; the penalty was not read here [to confirm]).

**C. Involves a minor?** The app is 18 and over, but if an affected account belongs to someone under 18, notify both the child and the parent or guardian, in language the child understands (NPC Advisory 2024-03 Sec 4, read; and Circular 16-03 Sec 19(C), notification may go through legal representatives).

**D. Criminal element?** If a crime may be involved (an intruder, extortion), consider the police or the NBI cybercrime units, and tell the NPC (Sec 8(E)). Postponing the notice of affected people because of a criminal investigation needs the NPC's authorization (Sec 18(B)).

## 5. Notify

### Timing

| Who | When | Source |
| --- | --- | --- |
| The NPC | Within 72 hours of T0, on the information available. Delay only as far as needed to find the scope, stop more disclosure, or restore integrity; you need not be certain of the scope (Sec 17(B)). | Sec 17(A), (B) |
| Affected people | Within 72 hours of T0, on the information available, in a way that lets them protect themselves. More detail can follow later. | Sec 18(A) |
| No delay allowed | If at least 100 people are affected, or disclosure of sensitive information will harm them. | Sec 17(C) |
| Full report to the NPC | Within 5 days of the first notice, unless the NPC gives more time. | Sec 17(C) |
| If you cannot notify people in time | Ask the NPC for an exemption or postponement, in writing, before the deadline. | Sec 18(B) |

The NPC presumes a failure to notify if it has received nothing within 5 days of knowledge (Sec 20). Delay is never excused if used to hide the breach (Sec 17(B)).

### How

- **The NPC:** a report (written or electronic) with the contents in Sec 17(D) (see template A). Sec 23 names `complaints@privacy.gov.ph`; **check privacy.gov.ph for the current channel first** [confirm]. Send by secure means. **The report is not filed until the NPC confirms receipt; keep the confirmation** (Sec 17(E)).
- **Affected people:** individually, by secure means (email to the address on the account), after checking you have the right person, without revealing more data than needed (Sec 18(D)). If that is impossible or disproportionate, ask the NPC to approve public notice (Sec 18(D)). Give them a way to ask questions (Sec 18(D)). Use template B.
- **Children:** template C, to the child and the parent or guardian.

## 6. Log everything

Even incidents that need no notice are written up (Sec 22). One file per incident, kept privately. Fields (Sec 9, Sec 22):

- Incident id and T0 (when you knew or had reason to believe), who found it and how.
- Description, root cause, timeline of events (Sec 9(A)).
- Data and number of people involved; sensitive data or identity-fraud data? minors?
- Actions and decisions taken, with times (Sec 9(B)).
- Notification decision and reasoning; if notified: what was sent, when, to whom, NPC confirmation (Sec 9(D)).
- Outcome and difficulties (Sec 9(C)).
- Post-breach review: what to change (Sec 9, last paragraph).

Annually, send the NPC a summary: number of incidents and breaches, by impact on availability, integrity and confidentiality (Sec 22). The incident log is made available if the NPC asks.

## 7. After

- Fix the cause and write the review within 14 days of closing the incident.
- Tell the processors involved if the cause is on their side, and use their incident channels.
- Offer help to affected people (Sec 8(H)).
- Update this runbook and the Privacy Policy if something changed.

## 8. Templates

### A. Notice to the NPC (Sec 17(D))

- **Nature of the breach:** how it happened and what weakness allowed it; chronology of events up to loss of control over the data; approximate number of people and records; kind of breach (availability, integrity, confidentiality); likely consequences; name and contact details of the DPO or other accountable person.
- **Data possibly involved:** the sensitive personal information; other information that could enable identity fraud.
- **Measures taken:** to address the breach; to secure or recover the data; to reduce harm; how and when people are being told (or the reason for delay); steps to prevent it happening again.
- **Contacts:** DPO Lowel-Jay Rubino, dpo@studiskarte.com; designated representative of the controller: Lowel-Jay Rubino, support@studiskarte.com.

### B. Notice to affected people (Sec 18(C))

> Subject: Important: a security incident at Studiskarte Marketplace
>
> We are writing to tell you about a security incident that may affect you.
>
> **What happened:** [what, when found, in plain words].
> **Your data that may be involved:** [list: for example your email address, your messages].
> **What we have done:** [containment and recovery steps].
> **What we are doing so it does not happen again:** [steps].
> **What you can do:** [for example be careful about emails asking for your code or password, change your password, watch for fake messages from "support"].
> **Who to ask:** Lowel-Jay Rubino, support@studiskarte.com, or our Data Protection Officer Lowel-Jay Rubino, dpo@studiskarte.com. **Help we can give:** [for example help to delete your account or get a copy of your data].
>
> You also have the right to complain to the National Privacy Commission (privacy.gov.ph).

### C. Notice to a child and parent or guardian (Advisory 2024-03 Sec 4)

Send two notices: the same facts as B, to the parent or guardian, and a shorter, plainer version to the child, in words the child understands. Wording to be reviewed by the lawyer [to confirm].

## 9. Contacts

- NPC: privacy.gov.ph [current notification channel to confirm].
- Neon support: [from account]. Vercel support: [from account]. Cloudflare support: [from account]. Resend support: [from account]. Sentry support: [from account].
- Lawyer: [name and contact]. DPO: Lowel-Jay Rubino, dpo@studiskarte.com.
