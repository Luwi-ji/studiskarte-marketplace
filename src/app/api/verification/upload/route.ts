import { NextResponse } from "next/server";
import { getSignedInStudent, hasFinishedSignUp } from "@/lib/access";
import { MAX_UPLOAD_BYTES } from "@/lib/images/process";
import { getIdStore } from "@/lib/images/store";
import { verificationEnabled } from "@/lib/verification/config";
import { addPicture } from "@/lib/verification/service";

/**
 * One ID-check picture per request: field `photo`, and `slot` (query or field) is "document" or "holding".
 * The picture goes to the private bucket only; nothing is sent back to look at.
 */
export async function POST(request: Request) {
  if (!verificationEnabled()) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const me = await getSignedInStudent(request.headers);
  if (!me) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!hasFinishedSignUp(me)) return NextResponse.json({ error: "Finish sign-up first" }, { status: 403 });
  if (me.mustAcceptTerms) return NextResponse.json({ error: "Accept the updated terms first" }, { status: 403 });

  const form = await request.formData();
  const rawSlot = url.searchParams.get("slot") ?? form.get("slot");
  if (rawSlot !== "document" && rawSlot !== "holding") {
    return NextResponse.json({ error: "Choose which picture this is" }, { status: 400 });
  }
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "Choose a photo" }, { status: 400 });
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is too large" }, { status: 413 });
  }

  try {
    const result = await addPicture({
      studentId: me.id,
      slot: rawSlot,
      bytes: Buffer.from(await photo.arrayBuffer()),
      store: getIdStore(),
    });
    if (!result.ok) {
      const status = result.error.startsWith("Too many") ? 429 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("uploading an ID picture failed", error);
    return NextResponse.json({ error: "Could not save the photo. Try again." }, { status: 500 });
  }
}
