"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { uploadPhoto } from "@/lib/images/prepare-photo";
import { PAYMENT_LABEL, PAYMENT_NOTE_MAX, type PaymentMode } from "@/lib/payment";
import type { Category } from "@/lib/posts/categories";
import type { SaveResult } from "@/lib/posts/create";
import {
  CONDITION_LABEL,
  CONDITIONS,
  CAPTION_MAX,
  DESCRIPTION_MAX,
  PHOTOS_MAX,
  PLACE_MAX,
  TITLE_MAX,
  AVAILABILITY_MAX,
  type FieldErrors,
  type PostFields,
  type PostKind,
  type PriceKind,
} from "@/lib/posts/schema";
import { createPostAction, relistPostAction, updatePostAction } from "./actions";
import { AvailabilityPicker } from "./availability-picker";

export type FormPhoto = { id: string; thumbUrl: string; caption: string };
export type PostFormValues = Required<Omit<PostFields, "photos">> & { photos: FormPhoto[] };

// Every day, 9:00 AM to 5:00 PM: inside meet-up hours, so the form posts without a choice.
const DEFAULT_AVAILABILITY: PostFormValues["availability"] = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
  kind: "weekly" as const,
  weekday,
  startTime: "09:00",
  endTime: "17:00",
}));
const DETAIL_ERRORS = ["quantity", "exchange", "payment", "paymentNote", "allowNonStudents", "availability"];
const detailsDefaults = "1 available, meet-up, cash, every day";
const EMPTY: PostFormValues = {
  title: "",
  description: "",
  categoryId: "",
  condition: null,
  priceKind: "amount",
  priceAmount: "",
  quantity: "1",
  unlimited: false,
  exchangeMeetup: true,
  exchangeDelivery: false,
  meetupLocation: "",
  paymentCash: true,
  paymentOnline: false,
  paymentOther: false,
  paymentNote: "",
  allowNonStudents: false,
  availability: DEFAULT_AVAILABILITY,
  photos: [],
};

// Which error messages a change to each value answers, so they clear as the student edits.
const ANSWERS: Record<keyof PostFormValues, string[]> = {
  title: ["title"],
  description: ["description"],
  categoryId: ["categoryId", "condition"],
  condition: ["condition"],
  priceKind: ["priceKind", "priceAmount"],
  priceAmount: ["priceAmount"],
  quantity: ["quantity"],
  unlimited: ["quantity"],
  exchangeMeetup: ["exchange", "meetupLocation"],
  exchangeDelivery: ["exchange"],
  meetupLocation: ["meetupLocation"],
  paymentCash: ["payment"],
  paymentOnline: ["payment", "paymentNote"],
  paymentOther: ["payment", "paymentNote"],
  paymentNote: ["paymentNote"],
  allowNonStudents: ["allowNonStudents"],
  availability: ["availability"],
  photos: ["photos"],
};

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const label = "text-sm font-medium";
const hint = "text-xs text-zinc-500";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

let uploadCount = 0;

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}


type Props =
  | { mode: "create"; categories: Category[]; canSell: boolean; prefill?: { kind: PostKind; values: Partial<PostFormValues> } }
  | { mode: "edit"; categories: Category[]; postId: string; kind: PostKind; initial: PostFormValues; relist: boolean };

export function PostForm(props: Props) {
  const router = useRouter();
  const startKind: PostKind = props.mode === "edit" ? props.kind : (props.prefill?.kind === "wishlist" || !props.canSell ? "wishlist" : "showcase");
  const startValues: PostFormValues = props.mode === "edit" ? props.initial : { ...EMPTY, ...props.prefill?.values };
  const [kind, setKind] = useState<PostKind>(startKind);
  const [values, setValues] = useState<PostFormValues>(startValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState<{ key: string; size: string }[]>([]);
  // null: open by itself when a detail has an error or is not the default; true/false: the student's choice.
  const [detailsChoice, setDetailsChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  // On when the student wants a description under each photo (owner, 2026-10-16).
  const [perPhoto, setPerPhoto] = useState(() => values.photos.some((p) => p.caption.length > 0));

  const clearErrors = (...keys: string[]) =>
    setErrors((current) => {
      const next: FieldErrors = { ...current, form: undefined };
      for (const key of keys) next[key] = undefined;
      return next;
    });
  const set = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    clearErrors(...ANSWERS[key]);
  };
  const chosen = props.categories.find((c) => c.id === values.categoryId);
  const wishlist = kind === "wishlist";
  const services = chosen?.id === "services";
  const detailsChanged =
    values.unlimited ||
    values.quantity !== "1" ||
    !values.exchangeMeetup ||
    values.exchangeDelivery ||
    !values.paymentCash ||
    values.paymentOnline ||
    values.paymentOther ||
    values.paymentNote !== "" ||
    values.allowNonStudents ||
    JSON.stringify(values.availability) !== JSON.stringify(DEFAULT_AVAILABILITY);
  const detailsError = DETAIL_ERRORS.some((key) => errors[key]) || Object.keys(errors).some((key) => key.startsWith("availability.") && errors[key]);
  const detailsOpen = detailsChoice ?? (detailsChanged || detailsError);

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, PHOTOS_MAX - values.photos.length);
    input.value = "";
    if (files.length === 0) return;
    setErrors((current) => ({ ...current, photos: undefined }));
    // The size is shown at once; the photo is shrunk before it is sent.
    const waiting = files.map((file) => ({ key: `upload-${++uploadCount}`, size: fileSize(file.size) }));
    setUploading((list) => [...list, ...waiting]);
    for (const [i, file] of files.entries()) {
      try {
        const uploaded = await uploadPhoto(file, "/api/uploads/post-photo");
        const photo = { ...uploaded, caption: "" };
        setValues((current) =>
          current.photos.length < PHOTOS_MAX ? { ...current, photos: [...current.photos, photo] } : current,
        );
      } catch (error) {
        setErrors((current) => ({
          ...current,
          photos: error instanceof Error ? error.message : "Could not upload a photo. Try again.",
        }));
      } finally {
        setUploading((list) => list.filter((item) => item.key !== waiting[i].key));
      }
    }
  }

  function movePhoto(index: number, by: -1 | 1) {
    const photos = [...values.photos];
    const target = index + by;
    if (target < 0 || target >= photos.length) return;
    [photos[index], photos[target]] = [photos[target], photos[index]];
    set("photos", photos);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading.length > 0) return;
    setSaving(true);
    setErrors({});
    const { photos, ...rest } = values;
    // With "Describe each photo" off, captions are cleared rather than kept hidden.
    const input = { ...rest, photos: photos.map((photo) => ({ id: photo.id, caption: perPhoto ? photo.caption : "" })) };
    let result: SaveResult;
    try {
      result =
        props.mode === "create"
          ? await createPostAction({ ...input, kind })
          : props.relist
            ? await relistPostAction(props.postId, input)
            : await updatePostAction(props.postId, input);
    } catch {
      setSaving(false);
      setErrors({ form: "Could not reach the server. Check your connection and try again." });
      return;
    }
    setSaving(false);
    if (!result.ok) {
      setDetailsChoice(null);
      setErrors(result.errors);
      return;
    }
    // Next.js keeps this page alive after navigating away; start fresh next time.
    if (props.mode === "create") {
      setValues(startValues);
      setKind(startKind);
      router.push(`/posts/${result.id}?created=1`);
      return;
    }
    router.push(`/me?tab=${kind}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {props.mode === "edit" && props.relist ? (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This post expired. Check the details, then relist it for another 30 days.
        </p>
      ) : null}
      {props.mode === "create" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className={label}>What do you want to do?</legend>
          <div className="flex flex-wrap gap-x-4">
            {props.canSell ? (
              <label className="flex min-h-11 items-center gap-3">
                <input className="h-5 w-5 shrink-0" type="radio" name="kind" checked={!wishlist} onChange={() => setKind("showcase")} />
                I&apos;m selling or giving
              </label>
            ) : null}
            <label className="flex min-h-11 items-center gap-3">
              <input className="h-5 w-5 shrink-0" type="radio" name="kind" checked={wishlist} onChange={() => setKind("wishlist")} />
              I&apos;m looking for
            </label>
          </div>
          {props.canSell ? null : <span className={hint}>Only students can sell or give. You can post what you are looking for.</span>}
        </fieldset>
      ) : null}

      <section className="flex flex-col gap-2">
        <span className={label}>
          Photos ({values.photos.length}/{PHOTOS_MAX})
        </span>
        {values.photos.length + uploading.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {values.photos.map((photo, index) => (
            <li key={photo.id} className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {/* Signed, short-lived link to the uploaded thumbnail. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbUrl} alt={`Photo ${index + 1}`} className="aspect-square w-full object-cover" />
              {/* Each control is a full 44 px target; the visible mark sits inside it. */}
              <button
                type="button"
                onClick={() => set("photos", values.photos.filter((p) => p.id !== photo.id))}
                className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5"
                aria-label="Remove photo"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white">✕</span>
              </button>
              {index === 0 ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">Cover</span>
              ) : null}
              {values.photos.length > 1 ? (
                <div className="absolute inset-x-0 bottom-0 flex justify-between">
                  <button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} className="flex h-11 w-11 items-end justify-start p-1.5 disabled:invisible" aria-label="Move earlier">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white">←</span>
                  </button>
                  <button type="button" onClick={() => movePhoto(index, 1)} disabled={index === values.photos.length - 1} className="flex h-11 w-11 items-end justify-end p-1.5 disabled:invisible" aria-label="Move later">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white">→</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
          {uploading.map((file) => (
            <li key={file.key} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-400 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
              <span>Uploading…</span>
              <span>{file.size}</span>
            </li>
          ))}
          {values.photos.length + uploading.length < PHOTOS_MAX ? (
            <li>
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                + Add photos
                <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} className="sr-only" />
              </label>
            </li>
          ) : null}
        </ul>
        ) : (
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-400 px-4 py-6 text-center dark:border-zinc-600">
            <span aria-hidden className="text-3xl text-brand-text">📷</span>
            <span className="text-base font-medium">Add photos</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Start with the whole item in daylight. Add a close-up of any scratch or mark.</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Use real photos of your own item.</span>
            <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} className="sr-only" />
          </label>
        )}
        <span className={hint}>The first photo is the cover and should show the whole item. Show any damage. Location data is removed from every photo.</span>
        <FieldError message={errors.photos} />
        {values.photos.length > 0 ? (
          <label className="flex min-h-11 items-center gap-3">
            <input className="h-5 w-5 shrink-0" type="checkbox" checked={perPhoto} onChange={(e) => setPerPhoto(e.target.checked)} />
            Describe each photo
          </label>
        ) : null}
        {perPhoto ? (
          <ul className="flex flex-col gap-3">
            {values.photos.map((photo, index) => (
              <li key={photo.id} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <textarea
                    aria-label={`Description of photo ${index + 1}`}
                    value={photo.caption}
                    onChange={(e) => {
                      const caption = e.target.value;
                      setValues((current) => ({
                        ...current,
                        photos: current.photos.map((p) => (p.id === photo.id ? { ...p, caption } : p)),
                      }));
                      clearErrors(`photos.${index}`);
                    }}
                    maxLength={CAPTION_MAX}
                    rows={2}
                    placeholder={index === 0 ? "e.g. Front, with the cover" : "Describe this photo (optional)"}
                    className={field}
                  />
                  <FieldError message={errors[`photos.${index}`]} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <label className="flex flex-col gap-2">
        <span className={label}>Title</span>
        <input
          name="title"
          enterKeyHint="next"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={TITLE_MAX}
          placeholder={wishlist ? "e.g. Calculus textbook, any edition" : "e.g. Casio fx-991ES Plus, 2024, small scratch on the back"}
          className={field}
        />
        <FieldError message={errors.title} />
      </label>

      <label className="flex flex-col gap-2">
        <span className={label}>Category</span>
        <select
          name="categoryId"
          value={values.categoryId}
          onChange={(e) => {
            const next = props.categories.find((c) => c.id === e.target.value);
            setValues((current) => ({
              ...current,
              categoryId: e.target.value,
              condition: next?.requiresCondition ? current.condition : null,
            }));
            clearErrors("categoryId", "condition");
          }}
          className={field}
        >
          <option value="">Choose a category</option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.categoryId} />
      </label>

      {/* The server asks for a condition in these categories, so it is not tucked away. */}
      {chosen?.requiresCondition ? (
        <label className="flex flex-col gap-2">
          <span className={label}>{wishlist ? "Condition wanted" : "Condition"}</span>
          <select
            name="condition"
            value={values.condition ?? ""}
            onChange={(e) => set("condition", CONDITIONS.find((value) => value === e.target.value) ?? null)}
            className={field}
          >
            <option value="">Choose the condition</option>
            {CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {CONDITION_LABEL[value]}
              </option>
            ))}
          </select>
          <FieldError message={errors.condition} />
        </label>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className={label}>{wishlist ? "Your budget" : "Price"}</legend>
        <div className="flex flex-wrap gap-4">
          {(["amount", "free", "negotiable"] as PriceKind[]).map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-3">
              <input className="h-5 w-5 shrink-0" type="radio" name="priceKind" checked={values.priceKind === value} onChange={() => set("priceKind", value)} />
              {value === "amount" ? "Amount" : value === "free" ? "Free" : "Negotiable"}
            </label>
          ))}
        </div>
        {values.priceKind === "amount" ? (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">₱</span>
            <input
              name="priceAmount"
              enterKeyHint="next"
              inputMode="numeric"
              value={values.priceAmount}
              onChange={(e) => set("priceAmount", e.target.value)}
              placeholder="0"
              className={field}
            />
          </div>
        ) : null}
        <FieldError message={errors.priceAmount ?? errors.priceKind} />
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className={label}>{perPhoto ? "Main description" : "Description"}</span>
        <textarea
          name="description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder={wishlist ? "What you need, and by when" : "Any defect, the edition or year, what is included"}
          className={field}
        />
        <FieldError message={errors.description} />
      </label>

      {/* The place is required when meet-up is on, and has no safe default, so it stays in view. */}
      {values.exchangeMeetup ? (
        <label className="flex flex-col gap-1">
          <span className={label}>Where to meet</span>
          <input name="meetupLocation" enterKeyHint="next" value={values.meetupLocation} onChange={(e) => set("meetupLocation", e.target.value)} maxLength={PLACE_MAX} placeholder="e.g. TUP Manila main gate" className={field} />
          <span className={hint}>For your safety, choose a busy public spot on campus.</span>
          <FieldError message={errors.meetupLocation} />
        </label>
      ) : null}

      <section className="flex flex-col gap-4">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="more-details"
          onClick={() => setDetailsChoice(!detailsOpen)}
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 text-left dark:border-zinc-700"
        >
          <span className="flex flex-col">
            <span className={label}>More details (optional)</span>
            {detailsOpen || detailsChanged ? null : <span className={hint}>{detailsDefaults}</span>}
          </span>
          <span aria-hidden className="text-zinc-500">{detailsOpen ? "−" : "+"}</span>
        </button>

        {/* Hidden, not removed, so what the student set keeps its place. */}
        <div id="more-details" hidden={!detailsOpen} className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className={label}>{wishlist ? "How many do you need" : "How many are available"}</legend>
            <div className="flex flex-wrap items-center gap-x-4">
              <input
                name="quantity"
                inputMode="numeric"
                enterKeyHint="next"
                aria-label={wishlist ? "How many you need" : "How many are available"}
                value={values.unlimited ? "" : (values.quantity ?? "1")}
                disabled={values.unlimited}
                onChange={(e) => set("quantity", e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                placeholder={values.unlimited ? "No limit" : "1"}
                className={`${field.replace("w-full", "w-28")} disabled:opacity-50`}
              />
              <label className="flex min-h-11 items-center gap-3">
                <input className="h-5 w-5 shrink-0" type="checkbox" name="unlimited" checked={values.unlimited ?? false} onChange={(e) => set("unlimited", e.target.checked)} />
                Ongoing / No limit
              </label>
            </div>
            <span className={hint}>
              {values.unlimited
                ? "For services and anything you can keep providing. Students can keep reserving, and you accept each one."
                : wishlist
                  ? "Students can offer to supply up to this many."
                  : "Each accepted reservation uses some up. When none are left the post shows Fully reserved, and a cancelled reservation frees them again."}
            </span>
            <FieldError message={errors.quantity} />
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={label}>{wishlist ? "How you'd like to receive it" : "How to hand it over"}</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input className="h-5 w-5 shrink-0" type="checkbox" name="exchangeMeetup" checked={values.exchangeMeetup} onChange={(e) => set("exchangeMeetup", e.target.checked)} />
              {services ? "Meet-up (the work is done in person)" : "Meet-up"}
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input className="h-5 w-5 shrink-0" type="checkbox" name="exchangeDelivery" checked={values.exchangeDelivery} onChange={(e) => set("exchangeDelivery", e.target.checked)} />
              {services
                ? "Delivery (finished work is sent via third-party delivery apps like Grab or Lalamove)"
                : wishlist
                  ? "Delivery (the poster wants it brought, via third-party delivery apps like Grab or Lalamove)"
                  : "Delivery (use third-party delivery apps like Grab or Lalamove)"}
            </label>
            {values.exchangeDelivery ? (
              <span className={`${hint} pl-6`}>Any delivery fee is agreed between you. The app never handles payment.</span>
            ) : null}
            <FieldError message={errors.exchange} />
          </fieldset>

          {values.priceKind !== "free" ? (
            <fieldset className="flex flex-col gap-3">
              <legend className={label}>{wishlist ? "How you will pay" : "How you accept payment"}</legend>
              {(
                [
                  ["cash", "paymentCash"],
                  ["online", "paymentOnline"],
                  ["other", "paymentOther"],
                ] satisfies [PaymentMode, "paymentCash" | "paymentOnline" | "paymentOther"][]
              ).map(([mode, key]) => (
                <label key={mode} className="flex min-h-11 items-center gap-3">
                  <input className="h-5 w-5 shrink-0" type="checkbox" name={key} checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
                  {mode === "other" ? "Other (say how in the note)" : PAYMENT_LABEL[mode]}
                </label>
              ))}
              {values.paymentOnline || values.paymentOther ? (
                <label className="flex flex-col gap-1 pl-6">
                  <span className="text-sm">Note (optional)</span>
                  <input name="paymentNote" enterKeyHint="next" value={values.paymentNote} onChange={(e) => set("paymentNote", e.target.value)} maxLength={PAYMENT_NOTE_MAX} placeholder="e.g. GCash 09xx xxx xxxx, or bank transfer" className={field} />
                  <span className={hint}>Only the two of you see this, once a reservation is accepted. The app never handles the money.</span>
                  <FieldError message={errors.paymentNote} />
                </label>
              ) : null}
              <FieldError message={errors.payment} />
            </fieldset>
          ) : null}

          {wishlist ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Who can buy</legend>
              <label className="flex min-h-11 items-center gap-3">
                <input className="h-5 w-5 shrink-0" type="checkbox" name="allowNonStudents" checked={values.allowNonStudents} onChange={(e) => set("allowNonStudents", e.target.checked)} />
                Also allow faculty, staff, alumni and visitors to message, make offers and reserve
              </label>
              <span className={`${hint} pl-8`}>Off: only students can contact you about this post.</span>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className={label}>When you are available</legend>
            <AvailabilityPicker
              value={values.availability}
              errors={errors}
              meetup={values.exchangeMeetup}
              onChange={(update) => {
                setValues((current) => ({ ...current, availability: update(current.availability) }));
                clearErrors("availability", ...Array.from({ length: AVAILABILITY_MAX }, (_, i) => `availability.${i}`));
              }}
            />
          </fieldset>
        </div>
      </section>

      {/* Sticky so the student never scrolls to the end to post; clears the iPhone home bar. */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-zinc-200 bg-[var(--background)]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800">
        <FieldError message={errors.form ?? errors.kind ?? (Object.values(errors).some(Boolean) ? "Check the fields marked in red." : undefined)} />
        <button
          type="submit"
          disabled={saving || uploading.length > 0}
          className="h-12 rounded-lg bg-brand px-3 text-base font-medium text-white disabled:opacity-60"
        >
          {uploading.length > 0 ? "Waiting for photos…" : saving ? "Saving…" : props.mode === "create" ? "Post" : props.relist ? "Relist for 30 days" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
