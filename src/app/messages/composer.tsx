"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { uploadPhoto } from "@/lib/images/prepare-photo";
import { MESSAGE_MAX, MESSAGE_PHOTOS_MAX } from "@/lib/messaging/rules";
import type { SendResult } from "@/lib/messaging/send";

type Attached = { id: string; thumbUrl: string };

/**
 * The message box: text, up to 4 photos, and Send. `onSend` writes the message;
 * the box clears only when it worked, so nothing typed is lost on a failure.
 */
export function Composer({ onSend, placeholder = "Write a message" }: { onSend: (input: { body: string; imageIds: string[] }) => Promise<SendResult>; placeholder?: string }) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, MESSAGE_PHOTOS_MAX - photos.length - uploading);
    input.value = "";
    if (files.length === 0) return;
    setError(null);
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const uploaded = await uploadPhoto(file, "/api/uploads/message-photo");
        setPhotos((current) => (current.length < MESSAGE_PHOTOS_MAX ? [...current, uploaded] : current));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not upload a photo. Try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending || uploading > 0) return;
    if (text.trim() === "" && photos.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const result = await onSend({ body: text, imageIds: photos.map((p) => p.id) });
      if (result.ok) {
        setText("");
        setPhotos([]);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const empty = text.trim() === "" && photos.length === 0;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {photos.length > 0 || uploading > 0 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {photos.map((photo) => (
            <li key={photo.id} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((p) => p.id !== photo.id))}
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black text-white"
              >
                ×
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`up-${i}`} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-800">
              …
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={photos.length + uploading >= MESSAGE_PHOTOS_MAX}
          aria-label="Add photos"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="m21 16-5-5-8 8" />
          </svg>
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          maxLength={MESSAGE_MAX}
          placeholder={placeholder}
          aria-label="Message"
          enterKeyHint="enter"
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          style={{ fieldSizing: "content" }}
        />
        <button
          type="submit"
          disabled={empty || sending || uploading > 0}
          className="h-11 shrink-0 rounded-full bg-brand px-5 font-medium text-white disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
