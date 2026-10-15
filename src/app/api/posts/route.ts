import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { InvalidImageError, MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { getObjectStore } from "@/lib/images/store";
import { UploadLimitError } from "@/lib/images/upload";
import { createPost } from "@/lib/posts/create";

// A route handler, not a server action: a server action body is capped at 1 MB.
export async function POST(request: Request) {
  // The session cookie is SameSite=Lax, but state-changing calls also insist
  // on a same-origin request.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const me = await getSignedInStudent(request.headers);
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!hasFinishedSignUp(me)) return NextResponse.json({ error: "Finish sign-up first" }, { status: 403 });

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "Add a photo" }, { status: 400 });
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is too large" }, { status: 413 });
  }

  try {
    const created = await createPost({
      ownerId: me.id,
      input: { kind: form.get("kind"), title: form.get("title") },
      photo: Buffer.from(await photo.arrayBuffer()),
      store: getObjectStore(),
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Check the form" }, { status: 400 });
    }
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo" }, { status: 400 });
    }
    if (error instanceof UploadLimitError) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
    console.error("creating a post failed", error);
    return NextResponse.json({ error: "Could not save the post. Try again." }, { status: 500 });
  }
}
