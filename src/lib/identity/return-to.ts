import { z } from "zod";

/**
 * Where to send someone after they sign in: only a listing page on this site, from a shared link. Anything else
 * (another site, another path) is ignored, so the sign-in page cannot be used to bounce people elsewhere.
 */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^\/posts\/([0-9a-fA-F-]{36})$/.exec(value);
  return match && z.uuid().safeParse(match[1]).success ? value : null;
}

/** The sign-in address that comes back to `path` afterwards. */
export function signInUrl(path: string | null): string {
  const returnTo = safeReturnTo(path);
  return returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in";
}

/** `path` with the return address kept on it, for the steps between signing up and the listing. */
export function withReturnTo(path: string, returnTo: unknown): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
