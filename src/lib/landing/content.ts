/** A value still holding a {{PLACEHOLDER}} (or blank) is "not filled": its section is not rendered. */
export const isFilled = (value: string): boolean => value.trim() !== "" && !value.includes("{{");

export const SURVEY_N = "From our survey of 47 students from several schools.";
// Counted from the raw responses sheet (Form responses 1), all 47 respondents. "Which of these problems have you
// personally experienced?" gives 29 buried and 22 repost; "Have you ever had a bad experience...?" gives 25 ghosted.
// Recount from the sheet if the data changes.
export const TOP_FINDINGS: readonly { figure: string; text: string }[] = [
  { figure: "29 of 47", text: "said their selling posts get buried quickly." },
  { figure: "22 of 47", text: "said they have to repeatedly repost." },
  { figure: "25 of 47", text: "had a seller or buyer stop replying (ghosted)." },
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
  photoFile: "founder-320.webp",
} as const;

/** Founding User: the landing page promises a badge to the first 100 members (src/lib/founding/config.ts). Set to false when the places run out. */
export const FOUNDING_USER_ENABLED = true;
