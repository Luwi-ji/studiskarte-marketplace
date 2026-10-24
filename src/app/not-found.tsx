import Link from "next/link";
import { FriendlyPage, PRIMARY_BUTTON, SECONDARY_LINK } from "@/components/friendly-page";

export const metadata = { title: "Page not found · Studiskarte Marketplace" };

export default function NotFound() {
  return (
    <FriendlyPage
      title="We can't find that page"
      actions={
        <>
          <Link href="/" className={PRIMARY_BUTTON}>
            Back to the feed
          </Link>
          <Link href="/messages" className={SECONDARY_LINK}>
            Go to your messages
          </Link>
        </>
      }
    >
      The link may be old or mistyped. Nothing is wrong on your side.
    </FriendlyPage>
  );
}
