import { NextResponse } from "next/server";
import { perkSuggestion } from "@/db/schema";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/identity/auth";
import { consume } from "@/lib/rate-limit";

const SHOP_MIN = 2;
const SHOP_MAX = 80;

/** One anonymous shop suggestion from the landing page. Body: { shop }. Read by the owner only. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  let shop = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "shop" in body && typeof body.shop === "string") {
      shop = body.shop.replace(/\s+/g, " ").trim();
    }
  } catch {
    shop = "";
  }
  if (shop.length < SHOP_MIN || shop.length > SHOP_MAX) {
    return NextResponse.json({ error: `Write the shop's name, ${SHOP_MIN} to ${SHOP_MAX} characters.` }, { status: 400 });
  }
  const allowed = await consume({
    action: "perk_suggestion",
    key: clientIp(request.headers) ?? "unknown",
    max: 5,
    windowSeconds: 24 * 60 * 60,
  });
  if (!allowed) return NextResponse.json({ error: "Too many suggestions today" }, { status: 429 });
  try {
    await getDb().insert(perkSuggestion).values({ shop });
  } catch (error) {
    console.error("saving a perk suggestion failed", error);
    return NextResponse.json({ error: "Could not save your suggestion" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
