import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { listCategories } from "@/lib/posts/categories";
import { CONDITIONS, PRICE_KINDS } from "@/lib/posts/schema";
import { getEditablePost } from "@/lib/posts/update";
import { PostForm } from "../../post-form";

export const metadata = { title: "Edit post · Studiskarte Marketplace" };

const PREVIEW_LINK_SECONDS = 60 * 60;

export default function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit post" back="/me/posts" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Editor params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveStudent();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const editable = await getEditablePost(me.id, id.data);
  if (!editable) notFound();
  const { post, photos, availability, relist, lockedReason } = editable;
  if (lockedReason) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 text-center">
        <p className="text-zinc-700 dark:text-zinc-300">{lockedReason}</p>
        <Link href={`/posts/${post.id}`} className="mx-auto flex h-12 items-center rounded-lg border border-zinc-300 px-6 font-medium dark:border-zinc-700">
          Back to the post
        </Link>
      </div>
    );
  }
  const store = getObjectStore();

  return (
    <PostForm
      mode="edit"
      relist={relist}
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
        quantity: post.quantity === null ? "1" : String(post.quantity),
        unlimited: post.quantity === null,
        exchangeMeetup: post.exchangeMeetup,
        exchangeDelivery: post.exchangeDelivery,
        meetupLocation: post.meetupLocation ?? "",
        deliveryArea: post.deliveryArea ?? "",
        availability,
        photos: await Promise.all(
          photos.map(async (photo) => ({
            id: photo.id,
            thumbUrl: await store.signedUrl(photo.thumbKey, PREVIEW_LINK_SECONDS),
            caption: photo.caption ?? "",
          })),
        ),
      }}
    />
  );
}
