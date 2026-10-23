import { connection } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/identity/auth";
import { getPublicShareCard } from "@/lib/posts/share-card";
import { renderUnfurlCard } from "@/lib/posts/share-image";
import { consume } from "@/lib/rate-limit";

/** Short, so a listing that is withdrawn or removed stops showing within minutes. */
const CACHE = "public, max-age=300, s-maxage=300";
const NO_CACHE = "private, no-store";

/**
 * The picture a chat app or social network draws when a shared link `/s/<id>` is pasted (1200 x 630).
 * Open to everyone, signed in or not, because the crawlers that fetch it have no session. It holds only
 * what ShareCard allows (photo, kind, price, title, school abbreviation) and only for a listing the
 * public preview would show.
 */
export async function GET(request: Request, { params }: RouteContext<"/s/[id]/card">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return plain("Not found", 404);
  // Generous: link-card crawlers share addresses, and the cache absorbs repeat fetches of one listing.
  const ip = clientIp(request.headers);
  if (ip && !(await consume({ action: "public_card", key: ip, max: 120, windowSeconds: 10 * 60 }))) {
    return plain("Too many requests. Try again later.", 429);
  }
  const card = await getPublicShareCard(id.data);
  if (!card) return plain("Not found", 404);

  try {
    return await renderUnfurlCard(card, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("public card photo failed", error);
    return plain("Could not load the photo", 502);
  }
}

function plain(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": NO_CACHE } });
}
