/** A value still holding a {{PLACEHOLDER}} (or blank) is "not filled": its section is not rendered. */
export const isFilled = (value: string): boolean => value.trim() !== "" && !value.includes("{{");

export const SURVEY_N = "Open-ended answers from students: 33 to 40 per question.";
export const TOP_FINDINGS: readonly string[] = [
  "Reach, algorithms and slow admin approval: 12 mentions in 35 seller answers.",
  "Most common wish: one dedicated campus marketplace (18 mentions in 39 answers).",
];
// Source of both: Studiskarte Student Lived Experiences Report (open-ended survey PDF). "Mentions" are coded themes, not percentages.

/** Verbatim from the survey answers, unattributed. */
export const QUOTES: readonly string[] = [
  "kinain ako ng hiya kaya di na ko umulit",
  "it takes a full long week for them to approve your post",
  "Finding the product you want then the feed refreshes and it disappears.",
  "ang dami kong post sa mga fb group pages umabot panga sa point na nag me-message nako sa ibang tao para lang makita nila na meron akong bine-benta",
  "I would trust and use it if the platform verified student accounts, protected my personal information, provided affordable products, and had a secure and easy way to communicate with sellers and buyers.",
];

export const FOUNDER = {
  name: "Lowel",
  nickname: "Luwiji",
  instagramHandle: "lowel_j",
  instagramUrl: "https://www.instagram.com/lowel_j/",
  photoFile: "founder.jpg",
} as const;

/** Founding Seller badge: copy only. OFF until the owner approves the badge; the flag column, profile badge and live count are NOT built. */
export const FOUNDING_SELLER_ENABLED = false;
