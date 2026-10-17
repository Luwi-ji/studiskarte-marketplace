import { connection } from "next/server";
import { renderFeed } from "@/lib/calendar/feed";

/**
 * A student's private calendar feed. Public by design: the long random token in
 * the file name is the credential, so nothing here reads a session.
 */
export async function GET(request: Request, { params }: RouteContext<"/calendar/[file]">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const result = await renderFeed((await params).file, new URL(request.url).origin);
  if (result.status === 200) {
    return new Response(result.body, {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (result.status === 429) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "3600" } });
  }
  return new Response("Not found", { status: 404 });
}
