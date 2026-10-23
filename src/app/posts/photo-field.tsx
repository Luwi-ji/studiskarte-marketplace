"use client";

import type { ChangeEvent } from "react";
import { CAPTION_MAX, PHOTOS_MAX, type FieldErrors } from "@/lib/posts/schema";
import { FieldError, fieldClass, hintClass, labelClass } from "./form-parts";

export type FormPhoto = { id: string; thumbUrl: string; caption: string };
export type UploadingPhoto = { key: string; size: string };

const ACCEPT = "image/jpeg,image/png,image/webp";
const iconButton = "flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 disabled:invisible dark:text-zinc-300";

const stroke = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "h-5 w-5" } as const;

/**
 * The photos of a post as rows: a thumbnail, its own one-line caption (with a counter and a clear button) and the
 * controls to move or remove it. The first photo is the cover. Captions are optional.
 */
export function PhotoField({
  photos,
  uploading,
  errors,
  onAdd,
  onRemove,
  onMove,
  onCaption,
}: {
  photos: FormPhoto[];
  uploading: UploadingPhoto[];
  errors: FieldErrors;
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, by: -1 | 1) => void;
  onCaption: (id: string, index: number, caption: string) => void;
}) {
  const count = photos.length + uploading.length;
  return (
    <section aria-labelledby="photos-label" className="flex flex-col gap-2">
      <span id="photos-label" className={labelClass}>
        Photos ({photos.length}/{PHOTOS_MAX})
      </span>

      {count > 0 ? (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {photos.map((photo, index) => (
            <li key={photo.id} className="flex gap-3 py-3 first:pt-0">
              <div className="relative h-20 w-20 shrink-0">
                {/* Signed, short-lived link to the uploaded thumbnail. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt={`Photo ${index + 1}`} className="h-20 w-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800" />
                {index === 0 ? <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Cover</span> : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="relative">
                  <input
                    type="text"
                    enterKeyHint="next"
                    aria-label={`Caption for photo ${index + 1}`}
                    aria-invalid={errors[`photos.${index}`] ? true : undefined}
                    value={photo.caption}
                    onChange={(event) => onCaption(photo.id, index, event.target.value)}
                    maxLength={CAPTION_MAX}
                    placeholder={index === 0 ? "Caption, e.g. Front, with the cover" : "Caption (optional)"}
                    className={`${fieldClass} min-h-11 py-2 pr-11`}
                  />
                  {photo.caption.length > 0 ? (
                    <button type="button" onClick={() => onCaption(photo.id, index, "")} aria-label={`Clear caption for photo ${index + 1}`} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-zinc-500">
                      <svg {...stroke}>
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`${hintClass} tabular-nums`}>{photo.caption.length > 0 ? `${photo.caption.length}/${CAPTION_MAX}` : ""}</span>
                  <div className="-mr-2 flex">
                    <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} className={iconButton} aria-label={`Move photo ${index + 1} earlier`}>
                      <svg {...stroke}>
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => onMove(index, 1)} disabled={index === photos.length - 1} className={iconButton} aria-label={`Move photo ${index + 1} later`}>
                      <svg {...stroke}>
                        <path d="M12 5v14M5 12l7 7 7-7" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => onRemove(photo.id)} className={iconButton} aria-label={`Remove photo ${index + 1}`}>
                      <svg {...stroke}>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>
                </div>
                <FieldError message={errors[`photos.${index}`]} />
              </div>
            </li>
          ))}
          {uploading.map((file) => (
            <li key={file.key} className="flex items-center gap-3 py-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-400 dark:border-zinc-600 motion-safe:animate-pulse" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Uploading, {file.size}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {count === 0 ? (
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-400 px-4 py-6 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-text dark:border-zinc-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-8 w-8 text-brand-text">
            <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
          <span className="text-base font-medium">Add photos</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Start with the whole item in daylight. Add a close-up of any scratch or mark.</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Use real photos of your own item.</span>
          <input type="file" name="photos" accept={ACCEPT} multiple onChange={onAdd} className="sr-only" />
        </label>
      ) : count < PHOTOS_MAX ? (
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-400 text-base font-medium text-zinc-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-text dark:border-zinc-600 dark:text-zinc-300">
          <svg {...stroke}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add photos
          <input type="file" name="photos" accept={ACCEPT} multiple onChange={onAdd} className="sr-only" />
        </label>
      ) : null}

      <span className={hintClass}>The first photo is the cover and should show the whole item. Show any damage. Location data is removed from every photo. A caption under each photo is optional.</span>
      <FieldError message={errors.photos} />
    </section>
  );
}
