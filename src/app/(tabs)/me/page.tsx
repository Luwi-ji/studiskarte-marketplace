import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireActiveStudent } from "@/lib/access";

/** "My profile" without needing the handle: lets pages that don't know it (the post form) link here. */
export default function MePage({ searchParams }: PageProps<"/me">) {
  return (
    <Suspense fallback={null}>
      <ToProfile searchParams={searchParams} />
    </Suspense>
  );
}

async function ToProfile({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<never> {
  const me = await requireActiveStudent();
  const { tab } = await searchParams;
  redirect(`/u/${me.handle}${tab === "wishlist" ? "?tab=wishlist" : ""}`);
}
