DRAFT for lawyer review, not live.

# ID verification: consent screen text

Applies only when ID verification opens (docs/roles-and-verification-plan.md: upload of an ID or certificate of registration plus a photo holding it, reviewed by an admin; images deleted when a decision is made; status, reviewer, date and reason kept; resubmission limit; 12-month expiry; alumni path). Nothing here is live and no code exists yet.

## Why a separate screen

- The documents show information about a person's education and are issued by a school, so they are sensitive personal information (Data Privacy Act Sec 3(l), as read; the review doc treats the ID and certificate of registration as at least education or age data). Processing needs consent that is specific to the purpose and given before processing (Sec 13(a)).
- NPC Circular 2023-04 (read in full): consent must be freely given, specific, granular, informed, an indication of will, and evidenced (Secs 7 to 11). Consent to processing that is not needed to give the service must not be bundled (Sec 8(B)). Just-in-time and layered notices are the default (Sec 9(C)). Consent can never be assumed (Sec 10(A)). Withdrawal must be as easy as giving it, in the same interface (Sec 13(A), (B)). A waiver of data privacy rights is void (Sec 20).
- So this consent is **not** part of accepting the Terms and Privacy Policy at sign-up. It is asked only when a person chooses to verify, just before they can upload anything.

## When the screen appears

- Only after the person has confirmed they meet the minimum age (see age-confirmation.md).
- Only when they tap "Verify my ID" (from the profile, from onboarding "verify now or later", or from a prompt). Never at sign-up, never in the same step as the Terms.
- Before the camera or file chooser opens. The person cannot reach the upload step without ticking the box.

## Layer 1: the screen (short)

**Check your ID (optional)**

You can ask the owner to check that you really are a student, teacher, staff member or alumnus. If it works, your profile gets an "ID checked" badge.

- **What we ask for:** a picture of your school ID or certificate of registration, and a photo of you holding it. [Optional, owner to decide: you may cover your ID number and anything else we do not need. We only need to see your name, your school and your face.]
- **Why:** only to decide whether to give you the badge. We use the pictures for nothing else.
- **Who sees them:** only the owner, in a private area. Nobody else, and they never appear in the app.
- **What happens next:** as soon as the owner decides, the pictures are deleted. We keep only the result (approved or rejected), who decided, the date and a short reason.
- **You can say no.** The rest of the app still works [limits for unverified students: owner to confirm and list here before launch].
- **You can change your mind** at any time, in Settings, with one tap.

Studiskarte Marketplace is run by Lowel-Jay Rubino. Questions or requests: support@studiskarte.com. Data Protection Officer: Lowel-Jay Rubino, dpo@studiskarte.com.

[How ID checks work, in full] (link to the "ID verification" section of the Privacy Policy, /legal/privacy; a heading anchor is a build item)

**Checkbox (unchecked when the screen opens; it must be ticked by the person):**

> I agree that Studiskarte Marketplace may use the pictures I upload (my ID or certificate of registration, and a photo of me holding it) to check my identity and role, as explained on this screen. I know I can say no and keep using the app, and that I can withdraw this agreement at any time.

**Buttons, equal size and weight:** "Continue" (disabled until the box is ticked) and "Not now". No wording that pressures, guilts or hurries the person (Circular 2023-04 Sec 7(A): no deceptive design patterns).

## Layer 2: where the detail lives

The "ID verification" section of the Privacy Policy (draft in privacy.md) covers: what is collected, why, who sees it, storage, deletion at the decision, what is kept, resubmission limit 3 attempts, 12-month validity, withdrawal, and rights.

## What is recorded as proof of consent

Circular 2023-04 Sec 12(B) requires proof of three things: the information shown, that it was shown at the time of consent, and that the person performed an act to consent. Sec 12(A) says keep only enough to show this and no more. Proposed record, one row per consent or withdrawal:

- **Who:** the student id.
- **Purpose:** a fixed value, `id_verification`.
- **Text version:** an identifier for this exact screen text and checkbox wording (for example `id-consent-2026-11-01`). The full text of every version stays in the repository and is never edited in place, so what was shown can always be reproduced. Any change to the text, purposes or retention makes a new version and a new consent (Circular 2023-04 Sec 21(A)).
- **Policy version shown:** the content of `content/legal/VERSION` at the time.
- **When:** the time of consent, in UTC.
- **The act:** the checkbox was ticked and "Continue" was pressed (stored as the event name).
- **Withdrawal:** the time of withdrawal and the channel (Settings or email), if it happens. The consent row is not overwritten; a withdrawal is a new event.
- **Not recorded:** IP address, browser details, the ID images, or anything copied from the ID. [Lawyer: confirm that this is enough evidence.]

How long the record is kept: while the account exists and for 3 years, so the owner can show consent if challenged (Data Privacy Act Sec 11(e): retention for the establishment, exercise or defense of legal claims).

## Withdrawal screen (Settings, "ID check", one tap)

Shown at the moment of withdrawal, with the effects (Circular 2023-04 Sec 13(C)):

**Withdraw my consent**

- If your pictures are still waiting for a decision, we delete them now and stop the check.
- If we have already decided, your pictures are already deleted.
- Your "ID checked" badge will be removed [lawyer: and the record of the check deleted, or what may be kept].
- You can verify again later if you want.
- This does not undo what was done while you agreed.

Button: "Withdraw my consent". Equal effort to the one tap that gave it.

## Not part of this screen

- Age confirmation: age-confirmation.md.
- Terms and Privacy Policy acceptance at sign-up: unchanged mechanism (`terms_version`, `terms_accepted_at`).

## Notes for the lawyer

- Is consent "freely given" if verification is optional but some features are limited until a person verifies (the plan allows one open Showcase listing for an unverified student; not built)? Circular 2023-04 Sec 7 treats "possibility of adverse consequences for refusal" as a sign that consent is not free. If the limit is kept, say what it is and whether this changes the basis to something other than consent.
- Whether the ID check may also serve as the age check. If yes, the purpose must be declared on this screen (Circular 2023-04 Sec 4(A)); the draft currently says it is only for identity and role. Advisory 2024-03 Sec 2(B)(1) (read) says relying only on a person's own statement of age "may be inadequate for high-risk processing activities".
- Whether the owner may keep the result record after consent is withdrawn.
- Whether covering the ID number on the picture is acceptable for review (data minimisation, Circular 2023-04 Sec 5(D)).
