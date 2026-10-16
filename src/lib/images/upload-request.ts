import { NextResponse } from "next/server";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { InvalidImageError, MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { getObjectStore } from "@/lib/images/store";
import { storeImage, UploadLimitError, type ImagePurpose } from "@/lib/images/upload";

const PREVIEW_LINK_SECONDS = 60 * 60;

/**
 * Handles one photo upload request for a signed-in student who finished
 * sign-up. One photo per request: ten phone photos in one request would pass
 * Vercel's 4.5 MB limit. The post or message refers to the stored photo by id
 * when it is saved, and the id is only accepted from the student who uploaded it.
 */
export async function handlePhotoUpload(request: Request, purpose: ImagePurpose): Promise<NextResponse> {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const me = await getSignedInStudent(request.headers);
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!hasFinishedSignUp(me)) return NextResponse.json({ error: "Finish sign-up first" }, { status: 403 });

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "Choose a photo" }, { status: 400 });
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is too large" }, { status: 413 });
  }

  try {
    const store = getObjectStore();
    const stored = await storeImage({
      ownerId: me.id,
      bytes: Buffer.from(await photo.arrayBuffer()),
      purpose,
      store,
    });
    const thumbUrl = await store.signedUrl(stored.keys[1], PREVIEW_LINK_SECONDS);
    return NextResponse.json({ id: stored.id, thumbUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo" }, { status: 400 });
    }
    if (error instanceof UploadLimitError) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
    console.error(`uploading a ${purpose} failed`, error);
    return NextResponse.json({ error: "Could not save the photo. Try again." }, { status: 500 });
  }
}
