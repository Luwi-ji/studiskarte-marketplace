import { NewPostScreen } from "../new-post-screen";

export const metadata = { title: "New Wishlist post · Studiskarte Marketplace" };

export default function NewWishlistPage({ searchParams }: PageProps<"/posts/new/wishlist">) {
  return <NewPostScreen kind="wishlist" searchParams={searchParams} />;
}
