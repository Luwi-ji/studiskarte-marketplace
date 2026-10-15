"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { preparePhoto } from "@/lib/images/prepare-photo";

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function NewPostForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read before any await: React clears currentTarget after the handler starts.
    const form = event.currentTarget;
    const data = new FormData(form);
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
      // Next.js keeps this page alive (hidden) after navigating away, so clear
      // it now or the next "New post" opens with this post's title and photo.
      // A draft left without posting is kept on purpose.
      form.reset();
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
