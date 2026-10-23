import { z } from "zod";
import { checkHandle } from "@/lib/identity/names";

/** Where a profile was opened from: the page its back arrow returns to, and the query that keeps that arrow when the profile's own links are followed. */
export type ProfileOrigin = { back: string; query: string };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * A listing's seller card (`?from=<post id>`), a conversation's name (`?thread=<conversation id>`), or someone's
 * Followers or Following list (`?followers=<handle>`, `?following=<handle>`). Ids are checked as ids and handles as
 * handles, and the arrow only ever points at one of our own pages, so a made-up address can never send anyone elsewhere.
 */
export function profileOrigin(searchParams: SearchParams): ProfileOrigin | null {
  const post = z.uuid().safeParse(searchParams.from);
  if (post.success) return { back: `/posts/${post.data}`, query: `from=${post.data}` };
  const thread = z.uuid().safeParse(searchParams.thread);
  if (thread.success) return { back: `/messages/${thread.data}`, query: `thread=${thread.data}` };
  for (const list of ["followers", "following"] as const) {
    const value = searchParams[list];
    const handle = typeof value === "string" ? checkHandle(value) : null;
    if (handle?.ok) return { back: `/u/${handle.handle}/${list}`, query: `${list}=${handle.handle}` };
  }
  return null;
}
