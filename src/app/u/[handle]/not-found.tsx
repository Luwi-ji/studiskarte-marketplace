import Link from "next/link";
import { FriendlyPage, PRIMARY_BUTTON, SECONDARY_LINK } from "@/components/friendly-page";

export default function ProfileNotFound() {
  return (
    <FriendlyPage
      title="Profile not found"
      actions={
        <>
          <Link href="/" className={PRIMARY_BUTTON}>
            Back to the feed
          </Link>
          <Link href="/search" className={SECONDARY_LINK}>
            Search
          </Link>
        </>
      }
    >
      This profile does not exist or is no longer available. The handle may have been changed.
    </FriendlyPage>
  );
}
