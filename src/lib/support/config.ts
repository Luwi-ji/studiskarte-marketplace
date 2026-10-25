/** Where the contact, bug and feedback forms in Settings are sent. Replies reach the owner through Cloudflare Email Routing. */
export const SUPPORT_EMAIL = "support@studiskarte.com";

export const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61595363692378";
/** The reviews tab of the Facebook page, where a review is left. */
export const FACEBOOK_REVIEWS_URL = `${FACEBOOK_URL}&sk=reviews`;
export const INSTAGRAM_URL = "https://www.instagram.com/studiskarte/";

/** Where each Settings help page lives. */
export const HELP_PATHS = {
  faq: "/me/settings/faq",
  reportListing: "/me/settings/report/listing",
  reportUser: "/me/settings/report/user",
  bug: "/me/settings/support/bug",
  feedback: "/me/settings/support/feedback",
  contact: "/me/settings/support/contact",
} as const;
