/** A value still holding a {{PLACEHOLDER}} (or blank) is "not filled": its section is not rendered. */
export const isFilled = (value: string): boolean => value.trim() !== "" && !value.includes("{{");

export const SURVEY_N = "From our survey of 47 students from several schools.";
// Counted from the raw responses sheet (Form responses 1), all 47 respondents. "Which of these problems have you
// personally experienced?" gives 29 buried and 22 repost; "Have you ever had a bad experience...?" gives 25 ghosted.
// Recount from the sheet if the data changes.
export const TOP_FINDINGS: readonly string[] = [
  "29 of 47 said their selling posts get buried quickly.",
  "22 of 47 said they have to repeatedly repost.",
  "25 of 47 had a seller or buyer stop replying (ghosted).",
];

/** Verbatim from the survey answers, unattributed (the last is trimmed at the start). */
export const QUOTES: readonly string[] = [
  "kinain ako ng hiya kaya di na ko umulit",
  "it takes a full long week for them to approve your post",
  "Finding the product you want then the feed refreshes and it disappears.",
  "ang dami kong post sa mga fb group pages umabot panga sa point na nag me-message nako sa ibang tao para lang makita nila na meron akong bine-benta",
  "…magkasing price ‘yung brand new (from univ mismo) at secondhand na binebenta ng seniors tapos walang size ko.",
];

export const FOUNDER = {
  name: "Lowel",
  nickname: "Luwiji",
  instagramHandle: "lowel_j",
  instagramUrl: "https://www.instagram.com/lowel_j/",
  photoFile: "founder.jpg",
} as const;

/** Founding Seller: the landing page promises a badge to the first 100 students (src/lib/founding/config.ts). Set to false when the places run out. */
export const FOUNDING_SELLER_ENABLED = true;
