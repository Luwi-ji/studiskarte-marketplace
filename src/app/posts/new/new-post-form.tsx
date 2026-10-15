"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const MAX_EDGE = 1600;

// Phone photos are several MB. Shrinking here keeps the upload under the
// 4.5 MB request limit; the server re-encodes and strips metadata again.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("could not read that photo");
  return blob;
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
    try {
      data.set("photo", await shrink(photo), "photo.jpg");
      const response = await fetch("/api/posts", { method: "POST", body: data });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save the post. Try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not read that photo. Try another one.");
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
