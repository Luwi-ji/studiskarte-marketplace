import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EditProfileSkeleton } from "@/components/list-skeletons";
import { requireActiveStudent } from "@/lib/access";
import { getOwnProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { DraftProvider } from "./draft";

const PICTURE_LINK_SECONDS = 5 * 60;

/** Loads the saved profile once for Edit profile and its Display name and Handle pages, and keeps their unsaved draft. */
export default function EditProfileLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Edit profile" back="/me/settings" />
          <main className="mx-auto w-full max-w-md flex-1">
            <EditProfileSkeleton />
          </main>
        </>
      }
    >
      <Loaded>{children}</Loaded>
    </Suspense>
  );
}

async function Loaded({ children }: { children: ReactNode }) {
  const me = await requireActiveStudent();
  const profile = await getOwnProfile(me.id);
  if (!profile?.handle) notFound();
  const pictureUrl = profile.avatarKey ? await getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null;
  const handleChangeOn = profile.nextHandleChangeAt
    ? profile.nextHandleChangeAt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })
    : null;
  return <DraftProvider initial={{ displayName: profile.displayName, bio: profile.bio ?? "", handle: profile.handle, pictureUrl, handleChangeOn }}>{children}</DraftProvider>;
}
