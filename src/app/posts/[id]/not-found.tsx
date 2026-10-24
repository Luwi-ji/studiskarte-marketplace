import Link from "next/link";
import { FriendlyPage, PRIMARY_BUTTON, SECONDARY_LINK } from "@/components/friendly-page";

// Business rule: a link to a closed, hidden or missing post says it is no longer available.
export default function PostNotFound() {
  return (
    <FriendlyPage
      title="Listing no longer available"
      actions={
        <>
          <Link href="/" className={PRIMARY_BUTTON}>
            Back to the feed
          </Link>
          <Link href="/search" className={SECONDARY_LINK}>
            Search for something similar
          </Link>
        </>
      }
    >
      This listing is no longer available. It may have been withdrawn, sold or removed.
    </FriendlyPage>
  );
}
