"use client";

import { useRouter } from "next/navigation";
import { Composer } from "../composer";
import { startConversationAction } from "../actions";

/** The first message about a post. On success the conversation opens. */
export function NewMessage({ postId }: { postId: string }) {
  const router = useRouter();
  return (
    <Composer
      placeholder="Ask a question or say hello"
      onSend={async (input) => {
        const result = await startConversationAction(postId, input);
        if (result.ok) router.replace(`/messages/${result.conversationId}`);
        return result;
      }}
    />
  );
}
