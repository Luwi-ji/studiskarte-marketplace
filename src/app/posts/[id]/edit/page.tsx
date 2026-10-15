import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { listCategories } from "@/lib/posts/categories";
import { CONDITIONS, PRICE_KINDS, toManilaLocal } from "@/lib/posts/schema";
import { getEditablePost } from "@/lib/posts/update";
import { PostForm } from "../../post-form";

export const metadata = { title: "Edit post · Studiskarte Marketplace" };

const PREVIEW_LINK_SECONDS = 60 * 60;

export default function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <Link href="/me/posts" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← My posts
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Edit post</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Editor params={params} />
      </Suspense>
    </main>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveStudent();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const editable = await getEditablePost(me.id, id.data);
  if (!editable) notFound();
  const { post, photos, windows } = editable;
  const store = getObjectStore();

  return (
    <PostForm
      mode="edit"
      categories={await listCategories()}
      postId={post.id}
      kind={post.kind === "wishlist" ? "wishlist" : "showcase"}
      initial={{
        title: post.title,
        description: post.description,
        categoryId: post.categoryId,
        // The database stores these as text; its CHECKs allow only these values.
        condition: CONDITIONS.find((value) => value === post.condition) ?? null,
        priceKind: PRICE_KINDS.find((value) => value === post.priceKind) ?? "negotiable",
        priceAmount: post.priceAmount === null ? "" : String(post.priceAmount),
        exchangeMeetup: post.exchangeMeetup,
        exchangeDelivery: post.exchangeDelivery,
        meetupLocation: post.meetupLocation ?? "",
        deliveryArea: post.deliveryArea ?? "",
        availability: windows.map((window) => ({
          startsAt: toManilaLocal(window.startsAt),
          endsAt: toManilaLocal(window.endsAt),
        })),
        photos: await Promise.all(
          photos.map(async (photo) => ({ id: photo.id, thumbUrl: await store.signedUrl(photo.thumbKey, PREVIEW_LINK_SECONDS) })),
        ),
      }}
    />
  );
}
