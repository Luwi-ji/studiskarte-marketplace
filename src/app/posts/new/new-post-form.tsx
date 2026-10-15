"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("canvas produced no image");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The shrunk photo, or the original when the browser cannot shrink it but the server can take it. */
async function preparePhoto(file: File): Promise<Blob | null> {
  try {
    return await shrink(file);
  } catch (error) {
    console.warn("could not shrink photo in the browser", error);
    return SERVER_FORMATS[file.type] && file.size <= MAX_RAW_UPLOAD ? file : null;
  }
}

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function NewPostForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const photo = data.get("photo");
    if (!(photo instanceof File) || photo.size === 0) {
      setError("Add a photo");
      return;
    }
    setBusy(true);
    setError(undefined);
    const prepared = await preparePhoto(photo);
    if (!prepared) {
      setBusy(false);
      setError("Could not read that photo. Try another one, or take a screenshot of it.");
      return;
    }
    data.set("photo", prepared, prepared === photo ? photo.name : "photo.jpg");
    try {
      const response = await fetch("/api/posts", { method: "POST", body: data });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save the post. Try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <fieldset className="flex gap-4">
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="showcase" defaultChecked /> Showcase (I offer)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="wishlist" /> Wishlist (I seek)
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Title</span>
        <input name="title" required maxLength={120} className={field} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Photo</span>
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
      </label>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-zinc-900 px-3 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {busy ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
