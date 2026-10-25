/** First-touch campaign tags (?utm_source=ig&utm_medium=bio&utm_campaign=launch), kept in a 7-day cookie. */
export const UTM_COOKIE = "sk_utm";
export const UTM_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export type Utm = { source?: string; medium?: string; campaign?: string };

const SAFE_VALUE = /^[a-z0-9._~-]{1,64}$/;

function clean(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const value = raw.trim().toLowerCase();
  return SAFE_VALUE.test(value) ? value : undefined;
}

/** Reads the three utm_* params; values that are not short, plain tokens are dropped. */
export function parseUtm(params: URLSearchParams): Utm | null {
  const utm: Utm = {};
  const source = clean(params.get("utm_source"));
  const medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"));
  if (source) utm.source = source;
  if (medium) utm.medium = medium;
  if (campaign) utm.campaign = campaign;
  return Object.keys(utm).length > 0 ? utm : null;
}

export function serializeUtm(utm: Utm): string {
  const params = new URLSearchParams();
  if (utm.source) params.set("utm_source", utm.source);
  if (utm.medium) params.set("utm_medium", utm.medium);
  if (utm.campaign) params.set("utm_campaign", utm.campaign);
  return params.toString();
}

/** Re-validates the cookie; never trusts what the browser sends back. */
export function readUtmCookie(value: string | undefined): Utm | null {
  return value ? parseUtm(new URLSearchParams(value)) : null;
}
