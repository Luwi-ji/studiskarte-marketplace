import { z } from "zod";

export const POST_KINDS = ["showcase", "wishlist"] as const;
export const TITLE_MAX = 120;

export const newPostSchema = z.object({
  kind: z.enum(POST_KINDS),
  title: z.string().trim().min(1, "Add a title").max(TITLE_MAX, `At most ${TITLE_MAX} characters`),
});

export type NewPost = z.infer<typeof newPostSchema>;
