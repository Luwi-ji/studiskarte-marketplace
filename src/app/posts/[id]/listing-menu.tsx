import { MenuSheet } from "@/app/safety/menu-sheet";

/** The three-dot button over a listing's photo: report the listing or the seller. The sheet is the shared one in the safety folder. */
export function ListingMenu({ postId, sellerHandle, sellerName, reasons }: { postId: string; sellerHandle: string | null; sellerName: string; reasons: readonly { id: string; label: string }[] }) {
  return <MenuSheet trigger="overlay" reasons={reasons} name={sellerName} handle={sellerHandle} postId={postId} />;
}
