import { NextResponse } from "next/server";
import { perkVote } from "@/db/schema";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/identity/auth";
import { isPerkKind } from "@/lib/perks/kinds";
import { consume } from "@/lib/rate-limit";

/** One anonymous vote for a perk kind from the landing page. Votes are never counted on a public page. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let kind: unknown;
  try {
    const body: unknown = await request.json();
    kind = body && typeof body === "object" && "kind" in body ? body.kind : undefined;
  } catch {
    kind = undefined;
  }
  if (!isPerkKind(kind)) return NextResponse.json({ error: "Unknown perk" }, { status: 400 });
  const allowed = await consume({
    action: "perk_vote",
    key: clientIp(request.headers) ?? "unknown",
    max: 10,
    windowSeconds: 24 * 60 * 60,
  });
  if (!allowed) return NextResponse.json({ error: "Too many votes today" }, { status: 429 });
  try {
    await getDb().insert(perkVote).values({ kind });
  } catch (error) {
    console.error("saving a perk vote failed", error);
    return NextResponse.json({ error: "Could not save your vote" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
