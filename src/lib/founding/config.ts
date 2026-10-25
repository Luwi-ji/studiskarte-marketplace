/**
 * Founding User badge: the first FOUNDING_LIMIT students to finish sign-up on or after FOUNDING_OPENS_AT get it,
 * once, for good (see grantFoundingUser). Set FOUNDING_OPENS_AT to the day the landing page goes live so members who
 * joined earlier do not use up the places. When the places run out, set FOUNDING_USER_ENABLED to false in
 * src/lib/landing/content.ts so the landing page stops promising it.
 */
export const FOUNDING_LIMIT = 100;
export const FOUNDING_OPENS_AT = new Date("2026-10-26T00:00:00+08:00");
/** Any stable number: the lock that keeps two sign-ups at once from taking the last place twice. */
export const FOUNDING_LOCK_KEY = 4_100_100;
