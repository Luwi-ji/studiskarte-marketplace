// Browser-only: shrinks a chosen photo before upload. Used by the new-post
// form and the profile picture form.

const MAX_EDGE = 1600;
// The server refuses bigger requests (Vercel's limit is 4.5 MB).
const MAX_RAW_UPLOAD = 4 * 1024 * 1024;
const SERVER_FORMATS: Record<string, true> = { "image/jpeg": true, "image/png": true, "image/webp": true };

// Phone photos are several MB. Shrinking here keeps the upload under the
// request limit; the server re-encodes and strips metadata again.
// Decoding through <img> (not createImageBitmap options) works on iPhone
// Safari, reads HEIC, and applies the camera's rotation.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("canvas produced no image");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The shrunk photo, or the original when the browser cannot shrink it but the server can take it. */
export async function preparePhoto(file: File): Promise<Blob | null> {
  try {
    return await shrink(file);
  } catch (error) {
    console.warn("could not shrink photo in the browser", error);
    return SERVER_FORMATS[file.type] && file.size <= MAX_RAW_UPLOAD ? file : null;
  }
}

/** What the upload routes answer with for a stored photo. */
export type UploadedPhoto = { id: string; thumbUrl: string };

/**
 * Shrinks a chosen photo and sends it to an upload route (one photo per
 * request). Throws an Error whose message is fit to show the student.
 */
export async function uploadPhoto(file: File, endpoint: string): Promise<UploadedPhoto> {
  const prepared = await preparePhoto(file);
  if (!prepared) throw new Error("Could not read one of the photos. Try another one.");
  const body = new FormData();
  body.set("photo", prepared, prepared === file ? file.name : "photo.jpg");
  const response = await fetch(endpoint, { method: "POST", body });
  const reply: unknown = await response.json().catch(() => null);
  if (!response.ok || !reply || typeof reply !== "object" || !("id" in reply) || !("thumbUrl" in reply)) {
    throw new Error(
      reply && typeof reply === "object" && "error" in reply && typeof reply.error === "string"
        ? reply.error
        : "Could not upload a photo. Try again.",
    );
  }
  return { id: String(reply.id), thumbUrl: String(reply.thumbUrl) };
}
