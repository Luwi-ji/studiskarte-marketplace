"use client";

import { useRouter } from "next/navigation";
import { Composer } from "../composer";
import { startConversationAction } from "../actions";

/** The first message about a post. On success the conversation opens. `place` is the post's meet-up place, or null. */
export function NewMessage({ postId, place }: { postId: string; place: string | null }) {
  const router = useRouter();
  return (
    <Composer
      placeholder="Ask a question or say hello"
      openers={["Is this still available?", "Can I see more photos?", ...(place ? [`Can we meet at ${place}?`] : [])]}
      onSend={async (input) => {
        const result = await startConversationAction(postId, input);
        if (result.ok) router.replace(`/messages/${result.conversationId}`);
        return result;
      }}
    />
  );
}
