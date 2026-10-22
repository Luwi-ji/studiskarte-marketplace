import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listCategories } from "@/lib/posts/categories";
import type { PaymentMode } from "@/lib/payment";
import { PLACE_MAX, type PostKind } from "@/lib/posts/schema";
import { PostForm, type PostFormValues } from "../post-form";

export const metadata = { title: "Create a post · Studiskarte Marketplace" };

export default function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  return (
    <>
      <PageHeader title="Create a post" back="/" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Guarded searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const PAYMENT_MODES: readonly string[] = ["cash", "online", "other"];

// "Post another" from a new post's page opens the form with the same kind, place and payment. Anything unreadable is ignored.
function prefillFrom(raw: Record<string, string | string[] | undefined>): { kind: PostKind; values: Partial<PostFormValues> } | undefined {
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const kind = first("kind");
  if (kind !== "showcase" && kind !== "wishlist") return undefined;
  const values: Partial<PostFormValues> = {};
  const place = first("place")?.trim().slice(0, PLACE_MAX);
  if (place) values.meetupLocation = place;
  const modes = (first("pay") ?? "").split(",").filter((mode): mode is PaymentMode => PAYMENT_MODES.includes(mode));
  if (modes.length > 0) {
    values.paymentCash = modes.includes("cash");
    values.paymentOnline = modes.includes("online");
    values.paymentOther = modes.includes("other");
  }
  return { kind, values };
}

async function Guarded({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const prefill = prefillFrom(await searchParams);
  // A new key starts a fresh form even when Next.js has kept an earlier one alive.
  return <PostForm key={prefill ? JSON.stringify(prefill) : "blank"} mode="create" categories={await listCategories()} canSell={me.role === "student"} prefill={prefill} />;
}
