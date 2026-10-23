import { connection } from "next/server";
import { z } from "zod";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { getShareCard } from "@/lib/posts/share-card";
import { renderStoryCard } from "@/lib/posts/share-image";
import { consume } from "@/lib/rate-limit";

/**
 * A listing as a story card, for the Share button. The image holds only what ShareCard allows:
 * never the seller. Members only, like the post page; the answer is private.
 */
export async function GET(request: Request, { params }: RouteContext<"/posts/[id]/share-card">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const me = await getSignedInStudent(request.headers);
  if (!me || !hasFinishedSignUp(me)) return plain("Sign in first", 401);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return plain("Not found", 404);
  if (!(await consume({ action: "share_card", key: me.id, max: 30, windowSeconds: 60 * 60 }))) {
    return plain("Too many share cards. Try again later.", 429);
  }
  const card = await getShareCard(me.id, id.data);
  if (!card) return plain("Not found", 404);

  try {
    return await renderStoryCard(card, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("share card photo failed", error);
    return plain("Could not load the photo", 502);
  }
}

function plain(message: string, status: number) {
  return new Response(message, { status, headers: { "Cache-Control": "private, no-store" } });
}
