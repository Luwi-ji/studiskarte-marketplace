/**
 * The exact words of the ID check consent screen. Never edit a version in place: change anything and
 * make a new version (and ask again), so what a person agreed to can always be reproduced from git
 * (NPC Circular 2023-04 Secs 12, 21). Draft rationale: docs/legal-drafts/id-verification-consent.md.
 */
export const ID_CONSENT_VERSION = "id-consent-2026-10-22";

export const ID_CONSENT = {
  title: "Check your ID (optional)",
  intro: "You can ask the owner to check that you really are a student, teacher, staff member or alumnus, and that you are old enough to use the app. If it works, your profile gets an \"ID checked\" badge.",
  points: [
    { label: "What we ask for", text: "A picture of your school ID or certificate of registration, and a photo of you holding it. You may cover your ID number. We only need to see your name, your school, your date of birth or age if it shows, and your face." },
    { label: "Why", text: "Only to decide whether to give you the badge: to check your identity, your role at the school, and that you meet the minimum age. We use the pictures for nothing else." },
    { label: "Who sees them", text: "Only the owner, in a private area. Nobody else, and they never appear in the app. Each time they are opened it is written down." },
    { label: "What happens next", text: "As soon as the owner decides, the pictures are deleted. We keep only the result (approved or rejected), who decided, the date and a short reason. Pictures left waiting for 7 days are deleted too." },
    { label: "You can say no", text: "The rest of the app still works. Without an ID check you can have one open showcase listing at a time." },
    { label: "You can change your mind", text: "At any time, in Settings, with one tap." },
  ],
  controller: "Studiskarte Marketplace is run by Lowel-Jay Rubino. Questions or requests: support@studiskarte.com. Data Protection Officer: Lowel-Jay Rubino, dpo@studiskarte.com.",
  checkbox: "I agree that Studiskarte Marketplace may use the pictures I upload (my ID or certificate of registration, and a photo of me holding it) to check my identity, my role and my age, as explained on this screen. I know I can say no and keep using the app, and that I can withdraw this agreement at any time.",
  agree: "Continue",
  decline: "Not now",
  withdrawTitle: "Withdraw my consent",
  withdrawPoints: [
    "If your pictures are still waiting for a decision, we delete them now and stop the check.",
    "If we have already decided, your pictures are already deleted.",
    "Your \"ID checked\" badge will be removed.",
    "You can check your ID again later if you want.",
    "This does not undo what was done while you agreed.",
  ],
  withdrawButton: "Withdraw my consent",
} as const;
