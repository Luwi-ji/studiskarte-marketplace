import { NextResponse } from "next/server";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { changeAvatar } from "@/lib/identity/profile";
import { InvalidImageError, MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { getObjectStore } from "@/lib/images/store";
import { UploadLimitError } from "@/lib/images/upload";

// A route handler, not a server action: a server action body is capped at 1 MB.
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const me = await getSignedInStudent(request.headers);
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!hasFinishedSignUp(me)) return NextResponse.json({ error: "Finish sign-up first" }, { status: 403 });

  const form = await request.formData();
  const picture = form.get("picture");
  if (!(picture instanceof File) || picture.size === 0) {
    return NextResponse.json({ error: "Choose a picture" }, { status: 400 });
  }
  if (picture.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That picture is too large" }, { status: 413 });
  }

  try {
    await changeAvatar({ studentId: me.id, bytes: Buffer.from(await picture.arrayBuffer()), store: getObjectStore() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: "Use a JPEG, PNG or WebP picture" }, { status: 400 });
    }
    if (error instanceof UploadLimitError) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
    console.error("changing a profile picture failed", error);
    return NextResponse.json({ error: "Could not save the picture. Try again." }, { status: 500 });
  }
}
