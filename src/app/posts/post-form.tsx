"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { LeaveGuard } from "@/components/leave-guard";
import { CategoryIcon } from "@/components/category-icon";
import { CategoryList } from "@/components/category-select";
import { uploadPhoto } from "@/lib/images/prepare-photo";
import { PAYMENT_LABEL, PAYMENT_NOTE_MAX, type PaymentMode } from "@/lib/payment";
import type { Category } from "@/lib/posts/categories";
import type { SaveResult } from "@/lib/posts/create";
import { audienceSummary, handoverSummary, paymentSummary, quantitySummary, summarizeAvailability } from "@/lib/posts/form-summary";
import {
  CONDITION_LABEL,
  CONDITIONS,
  DESCRIPTION_MAX,
  PHOTOS_MAX,
  PLACE_MAX,
  QUANTITY_MAX,
  TITLE_MAX,
  AVAILABILITY_MAX,
  type FieldErrors,
  type PostFields,
  type PostKind,
} from "@/lib/posts/schema";
import { DRAFT_DEBOUNCE_MS, clearDraft, loadDraft, saveDraft, savedAgo, type LoadedDraft } from "@/lib/posts/draft";
import { createPostAction, relistPostAction, updatePostAction } from "./actions";
import { checkDraftPhotosAction } from "./draft-actions";
import { AvailabilityPicker } from "./availability-picker";
import { ChoiceList, CheckRow, DrillRow, FieldError, FormSheet, RowGroup, fieldClass, hintClass, labelClass } from "./form-parts";
import { PhotoField, type FormPhoto, type UploadingPhoto } from "./photo-field";

export type { FormPhoto };
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

let uploadCount = 0;

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type SheetId = "category" | "condition" | "quantity" | "handover" | "payment" | "audience" | "availability";

type Props =
  | { mode: "create"; kind: PostKind; categories: Category[]; prefill?: Partial<PostFormValues>; studentId: string }
  | { mode: "edit"; categories: Category[]; postId: string; kind: PostKind; initial: PostFormValues; relist: boolean; wasNegotiable?: boolean };

export function PostForm(props: Props) {
  const router = useRouter();
  const kind = props.kind;
  const startValues: PostFormValues = props.mode === "edit" ? props.initial : { ...EMPTY, ...props.prefill };
  const [values, setValues] = useState<PostFormValues>(startValues);
  // What the form started as, to tell whether leaving would lose anything.
  const [startJson] = useState(() => JSON.stringify(startValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState<UploadingPhoto[]>([]);
  // null: open by itself when a detail has an error or is not the default; true/false: the student's choice.
  const [detailsChoice, setDetailsChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  // Set once the post is saved, so going to its page does not ask whether to leave.
  const saved = useRef(false);
  // A new post keeps a draft on this device, per student and kind. `offer`: undefined while the saved draft is being looked for, null when there is nothing to ask about, else a draft waiting for Continue or Start over.
  const create = props.mode === "create";
  const studentId = props.mode === "create" ? props.studentId : null;
  const [offer, setOffer] = useState<{ draft: LoadedDraft; ago: string } | null | undefined>(props.mode === "create" ? undefined : null);
  const [continuing, setContinuing] = useState(false);

  const dirty = JSON.stringify(values) !== startJson;

  useEffect(() => {
    if (!create) return;
    const now = Date.now();
    const draft = loadDraft(studentId, kind, now);
    setOffer(draft ? { draft, ago: savedAgo(draft.savedAt, now) } : null);
  }, [create, studentId, kind]);

  // Saved shortly after each change, and at once when the page is hidden or closed. Not while an older draft is still waiting for an answer, so it is never replaced unasked. Back to the starting values: nothing worth keeping.
  useEffect(() => {
    if (!create || offer !== null) return;
    if (!dirty) {
      clearDraft(studentId, kind);
      return;
    }
    const write = () => {
      if (!saved.current) saveDraft(studentId, kind, values);
    };
    const hide = () => {
      if (document.visibilityState === "hidden") write();
    };
    const timer = setTimeout(write, DRAFT_DEBOUNCE_MS);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", write);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", write);
    };
  }, [create, offer, dirty, values, studentId, kind]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (saved.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
  const sheetProps = (id: SheetId) => ({ id, open: sheet === id, onOpenChange: (open: boolean) => setSheet((current) => (open ? id : current === id ? null : current)) });
  const chosen = props.categories.find((c) => c.id === values.categoryId);
  const wishlist = kind === "wishlist";
  const services = chosen?.id === "services";
  const free = values.priceKind === "free";
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
  const availabilityError = errors.availability ?? Object.entries(errors).find(([key, message]) => key.startsWith("availability.") && message)?.[1];
  const detailsError = DETAIL_ERRORS.some((key) => errors[key]) || Boolean(availabilityError);
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
        setValues((current) => (current.photos.length < PHOTOS_MAX ? { ...current, photos: [...current.photos, photo] } : current));
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

  function setCaption(id: string, index: number, caption: string) {
    setValues((current) => ({ ...current, photos: current.photos.map((p) => (p.id === id ? { ...p, caption } : p)) }));
    clearErrors(`photos.${index}`);
  }

  function pickCategory(id: string) {
    const next = props.categories.find((c) => c.id === id);
    setValues((current) => ({ ...current, categoryId: id, condition: next?.requiresCondition ? current.condition : null }));
    clearErrors("categoryId", "condition");
    setSheet(null);
  }

  function setQuantity(text: string) {
    set("quantity", text.replace(/[^\d]/g, "").slice(0, 4));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading.length > 0) return;
    setSaving(true);
    setErrors({});
    const { photos, ...rest } = values;
    const input = { ...rest, photos: photos.map((photo) => ({ id: photo.id, caption: photo.caption })) };
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
      let problems = result.errors;
      // A photo the server no longer has (a draft kept it after the upload was cleaned up): drop it and say so.
      if (props.mode === "create" && problems.photos && photos.length > 0) {
        try {
          const usable = new Set((await checkDraftPhotosAction(photos.map((photo) => photo.id))).map((photo) => photo.id));
          const gone = photos.length - photos.filter((photo) => usable.has(photo.id)).length;
          if (gone > 0) {
            setValues((current) => ({ ...current, photos: current.photos.filter((photo) => usable.has(photo.id)) }));
            problems = { ...problems, photos: gone === 1 ? "A photo you added earlier is no longer available and was removed. Add it again." : `${gone} photos you added earlier are no longer available and were removed. Add them again.` };
          }
        } catch {
          // Offline: the server's own message stands.
        }
      }
      setErrors(problems);
      return;
    }
    saved.current = true;
    // Next.js keeps this page alive after navigating away; start fresh next time.
    if (props.mode === "create") {
      clearDraft(studentId, kind);
      setValues(startValues);
      router.push(`/posts/${result.id}?created=1`);
      return;
    }
    router.push(`/me?tab=${kind}`);
  }

  async function continueDraft() {
    if (!offer) return;
    setContinuing(true);
    const stored = offer.draft.values;
    let photos = stored.photos ?? [];
    let gone = 0;
    if (photos.length > 0) {
      try {
        const fresh = new Map((await checkDraftPhotosAction(photos.map((photo) => photo.id))).map((photo) => [photo.id, photo.thumbUrl]));
        const kept = photos.filter((photo) => fresh.has(photo.id)).map((photo) => ({ ...photo, thumbUrl: fresh.get(photo.id) ?? photo.thumbUrl }));
        gone = photos.length - kept.length;
        photos = kept;
      } catch {
        // Offline: keep them as saved; Post checks them again.
      }
    }
    const merged: PostFormValues = { ...startValues, ...stored, photos: photos.slice(0, PHOTOS_MAX) };
    merged.condition = CONDITIONS.find((value) => value === merged.condition) ?? null;
    if (!props.categories.some((c) => c.id === merged.categoryId)) merged.categoryId = "";
    setValues(merged);
    setErrors(gone > 0 ? { photos: gone === 1 ? "A saved photo is no longer available and was removed. Add it again." : `${gone} saved photos are no longer available and were removed. Add them again.` } : {});
    setOffer(null);
    setContinuing(false);
  }

  function startOver() {
    clearDraft(studentId, kind);
    setOffer(null);
  }

  const quantityLabel = wishlist ? "How many do you need" : "How many are available";
  const handoverLabel = wishlist ? "How to receive it" : "How to hand it over";
  const paymentLabel = wishlist ? "How you will pay" : "How you accept payment";
  const quantityNumber = Number(values.quantity) || 0;

  return (
    <>
      <LeaveGuard
        active={dirty && !saving}
        draft={
          create
            ? {
                onSave: () => {
                  saveDraft(studentId, kind, values);
                  setOffer(null);
                },
                // A draft still waiting for an answer is not this form's, so it stays.
                onDiscard: () => {
                  if (offer === null) clearDraft(studentId, kind);
                  setValues(startValues);
                },
              }
            : undefined
        }
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {props.mode === "edit" && props.relist ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This post expired. Check the details, then relist it for another 30 days.
          </p>
        ) : null}

        {offer ? (
          <section aria-label="Saved draft" className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Continue your draft - saved {offer.ago}</p>
              {offer.draft.values.title ? <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{offer.draft.values.title}</p> : null}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={continuing} onClick={continueDraft} className="press flex h-11 flex-1 items-center justify-center rounded-lg bg-brand px-3 font-medium text-white disabled:opacity-60">
                {continuing ? "Loading…" : "Continue"}
              </button>
              <button type="button" disabled={continuing} onClick={startOver} className="press flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 px-3 font-medium disabled:opacity-60 dark:border-zinc-700">
                Start over
              </button>
            </div>
          </section>
        ) : null}

        <PhotoField
          photos={values.photos}
          uploading={uploading}
          errors={errors}
          onAdd={addPhotos}
          onRemove={(id) => set("photos", values.photos.filter((p) => p.id !== id))}
          onMove={movePhoto}
          onCaption={setCaption}
        />

        <label className="flex flex-col gap-2">
          <span className={labelClass}>{wishlist ? "What do you want?" : "Title"}</span>
          <input
            name="title"
            enterKeyHint="next"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={TITLE_MAX}
            placeholder={wishlist ? "e.g. Calculus textbook, any edition" : "e.g. Casio fx-991ES Plus, 2024, small scratch on the back"}
            className={fieldClass}
          />
          <FieldError message={errors.title} />
        </label>

        <div className="flex flex-col gap-2">
          <RowGroup invalid={Boolean(errors.categoryId)}>
            <DrillRow
              id="category"
              label="Category"
              onOpen={() => setSheet("category")}
              describedBy={errors.categoryId ? "error-category" : undefined}
              value={
                chosen ? (
                  <>
                    <CategoryIcon id={chosen.id} className="h-5 w-5 shrink-0" />
                    <span className="truncate">{chosen.name}</span>
                  </>
                ) : (
                  "Choose"
                )
              }
            />
          </RowGroup>
          <FieldError id="error-category" message={errors.categoryId} />
        </div>

        {/* The server asks for a condition in these categories, so it is not tucked away. */}
        {chosen?.requiresCondition ? (
          <div className="flex flex-col gap-2">
            <RowGroup invalid={Boolean(errors.condition)}>
              <DrillRow
                id="condition"
                label={wishlist ? "Condition wanted" : "Condition"}
                onOpen={() => setSheet("condition")}
                describedBy={errors.condition ? "error-condition" : undefined}
                value={values.condition ? <span className="truncate">{CONDITION_LABEL[values.condition]}</span> : "Choose"}
              />
            </RowGroup>
            <FieldError id="error-condition" message={errors.condition} />
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className={`${labelClass} mb-2`}>{wishlist ? "Your budget" : "Price"}</legend>
          <div
            className={`flex items-center rounded-lg border bg-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-text dark:bg-zinc-900 ${errors.priceAmount ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"} ${free ? "opacity-50" : ""}`}
          >
            <span aria-hidden className="pl-3 text-base text-zinc-500">₱</span>
            <input
              name="priceAmount"
              enterKeyHint="next"
              inputMode="numeric"
              autoComplete="off"
              aria-label={wishlist ? "Budget in pesos" : "Price in pesos"}
              aria-invalid={errors.priceAmount ? true : undefined}
              disabled={free}
              value={free ? "" : values.priceAmount}
              onChange={(e) => set("priceAmount", e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
              placeholder="0"
              className="min-h-12 w-full bg-transparent px-2 text-base text-zinc-900 outline-none dark:text-zinc-50"
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              className="h-5 w-5 shrink-0"
              type="checkbox"
              name="free"
              checked={free}
              onChange={(e) => set("priceKind", e.target.checked ? "free" : "amount")}
            />
            {wishlist ? "Free only" : "Free, I am giving it away"}
          </label>
          {props.mode === "edit" && props.wasNegotiable && !free ? <span className={hintClass}>This post used to say Negotiable. Enter an amount, or choose Free.</span> : null}
          <FieldError message={errors.priceAmount ?? errors.priceKind} />
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className={labelClass}>Description</span>
          <textarea
            name="description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            placeholder={wishlist ? "What you need, and by when" : "Any defect, the edition or year, what is included"}
            className={fieldClass}
          />
          <FieldError message={errors.description} />
        </label>

        {/* The place is required when meet-up is on, and has no safe default, so it stays in view. */}
        {values.exchangeMeetup ? (
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Where to meet</span>
            <input name="meetupLocation" enterKeyHint="next" value={values.meetupLocation} onChange={(e) => set("meetupLocation", e.target.value)} maxLength={PLACE_MAX} placeholder="e.g. TUP Manila main gate" className={fieldClass} />
            <span className={hintClass}>For your safety, choose a busy public spot on campus.</span>
            <FieldError message={errors.meetupLocation} />
          </label>
        ) : null}

        <section className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="more-details"
            onClick={() => setDetailsChoice(!detailsOpen)}
            className="press-row flex min-h-11 items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 text-left dark:border-zinc-700"
          >
            <span className="flex flex-col">
              <span className={labelClass}>More details (optional)</span>
              {detailsOpen || detailsChanged ? null : <span className={hintClass}>{detailsDefaults}</span>}
            </span>
            <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 ease-out motion-reduce:transition-none ${detailsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Hidden, not removed, so what the student set keeps its place. */}
          <div id="more-details" hidden={!detailsOpen} className="flex flex-col gap-2">
            <RowGroup invalid={detailsError}>
              <DrillRow id="quantity" label={quantityLabel} onOpen={() => setSheet("quantity")} value={quantitySummary(values.quantity, values.unlimited)} />
              <DrillRow id="handover" label={handoverLabel} onOpen={() => setSheet("handover")} value={handoverSummary(values.exchangeMeetup, values.exchangeDelivery)} />
              {free ? null : <DrillRow id="payment" label={paymentLabel} onOpen={() => setSheet("payment")} value={paymentSummary(values)} />}
              {wishlist ? null : <DrillRow id="audience" label="Who can buy" onOpen={() => setSheet("audience")} value={audienceSummary(values.allowNonStudents)} />}
              <DrillRow id="availability" label="When you are available" onOpen={() => setSheet("availability")} value={summarizeAvailability(values.availability)} />
            </RowGroup>
            <FieldError message={errors.quantity} />
            <FieldError message={errors.exchange} />
            <FieldError message={errors.payment} />
            <FieldError message={errors.paymentNote} />
            <FieldError message={availabilityError} />
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

      {/* The sheets sit outside the form, so Enter in one of them cannot post it. */}
      <FormSheet {...sheetProps("category")} title="Category" tall done={false}>
        <div className="px-2 py-2">
          <CategoryList categories={props.categories} selected={new Set(values.categoryId ? [values.categoryId] : [])} onToggle={pickCategory} />
        </div>
      </FormSheet>

      <FormSheet {...sheetProps("condition")} title="Condition" done={false}>
        <ChoiceList
          name="Condition"
          options={CONDITIONS.map((value) => ({ value, label: CONDITION_LABEL[value] }))}
          value={values.condition ?? ""}
          onPick={(value) => {
            set("condition", CONDITIONS.find((c) => c === value) ?? null);
            setSheet(null);
          }}
        />
      </FormSheet>

      <FormSheet {...sheetProps("quantity")} title={quantityLabel}>
        <div className="flex flex-col">
          <div className="flex items-center justify-center gap-3 px-4 py-6">
            <button
              type="button"
              aria-label="One fewer"
              disabled={values.unlimited || quantityNumber <= 1}
              onClick={() => setQuantity(String(Math.max(1, quantityNumber - 1)))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M5 12h14" />
              </svg>
            </button>
            <input
              name="quantity"
              inputMode="numeric"
              enterKeyHint="done"
              aria-label={quantityLabel}
              aria-invalid={errors.quantity ? true : undefined}
              value={values.unlimited ? "" : values.quantity}
              disabled={values.unlimited}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={values.unlimited ? "No limit" : "1"}
              className={`${fieldClass} h-12 w-28 text-center text-xl disabled:opacity-50`}
            />
            <button
              type="button"
              aria-label="One more"
              disabled={values.unlimited || quantityNumber >= QUANTITY_MAX}
              onClick={() => setQuantity(String(Math.min(QUANTITY_MAX, quantityNumber + 1)))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <FieldError message={errors.quantity} />
          <CheckRow label="Ongoing / No limit" name="unlimited" checked={values.unlimited} onChange={(checked) => set("unlimited", checked)} />
          <p className={`${hintClass} px-4 py-3`}>
            {values.unlimited
              ? "For services and anything you can keep providing. Students can keep reserving, and you accept each one."
              : wishlist
                ? "Students can offer to supply up to this many."
                : "Each accepted reservation uses some up. When none are left the post shows Fully reserved, and a cancelled reservation frees them again."}
          </p>
        </div>
      </FormSheet>

      <FormSheet {...sheetProps("handover")} title={handoverLabel}>
        <CheckRow
          label={services ? "Meet-up (the work is done in person)" : "Meet-up"}
          name="exchangeMeetup"
          checked={values.exchangeMeetup}
          onChange={(checked) => set("exchangeMeetup", checked)}
          hint={values.exchangeMeetup ? "You will say where to meet on the form." : undefined}
        />
        <CheckRow
          label="Delivery"
          name="exchangeDelivery"
          checked={values.exchangeDelivery}
          onChange={(checked) => set("exchangeDelivery", checked)}
          hint={
            services
              ? "Finished work is sent via third-party delivery apps like Grab or Lalamove."
              : wishlist
                ? "You want it brought, via third-party delivery apps like Grab or Lalamove."
                : "Use third-party delivery apps like Grab or Lalamove."
          }
        />
        {values.exchangeDelivery ? <p className={`${hintClass} px-4 py-3`}>Any delivery fee is agreed between you. The app never handles payment.</p> : null}
        <div className="px-4 py-2">
          <FieldError message={errors.exchange} />
        </div>
      </FormSheet>

      <FormSheet {...sheetProps("payment")} title={paymentLabel}>
        {(
          [
            ["cash", "paymentCash"],
            ["online", "paymentOnline"],
            ["other", "paymentOther"],
          ] satisfies [PaymentMode, "paymentCash" | "paymentOnline" | "paymentOther"][]
        ).map(([mode, key]) => (
          <CheckRow key={mode} label={mode === "other" ? "Other (say how in the note)" : PAYMENT_LABEL[mode]} name={key} checked={values[key]} onChange={(checked) => set(key, checked)} />
        ))}
        {values.paymentOnline || values.paymentOther ? (
          <label className="flex flex-col gap-1 px-4 py-3">
            <span className="text-sm">Note (optional)</span>
            <input name="paymentNote" enterKeyHint="done" value={values.paymentNote} onChange={(e) => set("paymentNote", e.target.value)} maxLength={PAYMENT_NOTE_MAX} placeholder="e.g. GCash 09xx xxx xxxx, or bank transfer" className={fieldClass} />
            <span className={hintClass}>Only the two of you see this, once a reservation is accepted. The app never handles the money.</span>
            <FieldError message={errors.paymentNote} />
          </label>
        ) : null}
        <div className="px-4 py-2">
          <FieldError message={errors.payment} />
        </div>
      </FormSheet>

      <FormSheet {...sheetProps("audience")} title="Who can buy" done={false}>
        <ChoiceList
          name="Who can buy"
          options={[
            { value: "students", label: "Students only", hint: "Only students can contact you about this post." },
            { value: "everyone", label: "Students and others", hint: "Faculty, staff, alumni and guests can also message, make offers and reserve." },
          ]}
          value={values.allowNonStudents ? "everyone" : "students"}
          onPick={(value) => {
            set("allowNonStudents", value === "everyone");
            setSheet(null);
          }}
        />
      </FormSheet>

      <FormSheet {...sheetProps("availability")} title="When you are available" tall>
        <AvailabilityPicker
          value={values.availability}
          errors={errors}
          meetup={values.exchangeMeetup}
          onChange={(update) => {
            setValues((current) => ({ ...current, availability: update(current.availability) }));
            clearErrors("availability", ...Array.from({ length: AVAILABILITY_MAX }, (_, i) => `availability.${i}`));
          }}
        />
      </FormSheet>
    </>
  );
}
