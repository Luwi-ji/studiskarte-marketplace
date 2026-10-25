import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recordStage } from "@/lib/funnel/events";
import { parseUtm, serializeUtm, UTM_COOKIE, UTM_COOKIE_MAX_AGE } from "@/lib/funnel/utm";
import { clientIp } from "@/lib/identity/auth";
import { consume } from "@/lib/rate-limit";

/** Counts one landing view and remembers the campaign tags in a cookie. Body: { query: window.location.search }. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let query = "";
  let consent = false;
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object") {
      if ("consent" in body) consent = body.consent === true;
      if ("query" in body && typeof body.query === "string") query = body.query.slice(0, 500);
    }
  } catch {
    query = "";
  }
  // Without a yes from the visitor nothing is counted and no cookie is set; a "no" also drops an earlier campaign cookie.
  if (!consent) {
    const declined = new NextResponse(null, { status: 204 });
    declined.cookies.delete(UTM_COOKIE);
    return declined;
  }
  const allowed = await consume({
    action: "funnel_landing",
    key: clientIp(request.headers) ?? "unknown",
    max: 120,
    windowSeconds: 3600,
  });
  if (!allowed) return new NextResponse(null, { status: 204 });

  const utm = parseUtm(new URLSearchParams(query));
  try {
    await recordStage(getDb(), "landing_view", { utm });
  } catch (error) {
    console.error("recording landing_view failed", error);
  }
  const response = new NextResponse(null, { status: 204 });
  // A visit with no tags never clears an existing cookie.
  if (utm) {
    response.cookies.set(UTM_COOKIE, serializeUtm(utm), {
      maxAge: UTM_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}
