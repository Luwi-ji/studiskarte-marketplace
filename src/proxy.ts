import { NextResponse, type NextRequest } from "next/server";

/**
 * studiskarte.com shows the landing page to a visitor with no session cookie, and the feed to anyone who has one. The
 * cookie is only looked for, not checked: a stale one reaches the feed, which sends the visitor to sign in as before.
 * Better Auth names it `better-auth.session_token`, with a `__Secure-` prefix on https.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.endsWith("better-auth.session_token"));
  if (hasSession) return NextResponse.next();
  return NextResponse.rewrite(new URL("/landing", request.url));
}

export const config = { matcher: "/" };
