import { z } from "zod";
import { PAYMENT_NOTE_MAX } from "@/lib/payment";

// Post input rules (business logic "Posts", decided 2026-10-16). One schema
// for the form and the server; the database CHECKs and triggers repeat the
// rules that must never be broken.

export const POST_KINDS = ["showcase", "wishlist"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const CONDITIONS = ["new", "used_like_new", "used_good", "used_fair"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABEL: Record<Condition, string> = {
  new: "New",
  used_like_new: "Used – like new",
  used_good: "Used – good",
  used_fair: "Used – fair",
};

export const PRICE_KINDS = ["amount", "free", "negotiable"] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const PLACE_MAX = 120;
export const PRICE_MAX = 1_000_000;
export const PHOTOS_MAX = 10;
export const CAPTION_MAX = 300;
export const AVAILABILITY_MAX = 14;
export const AVAILABILITY_DAYS_AHEAD = 60;
export const OPEN_POSTS_MAX = 20;
/** The most units one post can offer or ask for, and the most one offer can request. */
export const QUANTITY_MAX = 1000;

export const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** One availability entry: a weekday (every week) or a date, with a time range. Times are "HH:MM" in Philippine time. */
export type Availability =
  | { kind: "weekly"; weekday: number; startTime: string; endTime: string }
  | { kind: "date"; date: string; startTime: string; endTime: string };

// Phones send "14:00" or "14:00:00" (iPhone Safari can add seconds).
const TIME = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** "14:00", "14:00:00" or "14:00:00.000" as "14:00", or null if not a time of day. */
export function parseTime(value: string): string | null {
  const match = TIME.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${match[1]}:${match[2]}`;
}

/** A "YYYY-MM-DD" that is a real calendar date, or null. */
export function parseDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Today's date in the Philippines (UTC+8, no daylight saving) as "YYYY-MM-DD". */
export function manilaToday(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" plus a number of days. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * What the form sends: only the shape (strings, booleans, lists). Every
 * content rule lives in parseFields, so one submit reports every problem.
 */
export const postFieldsSchema = z.object({
  title: z.string(),
  description: z.string(),
  categoryId: z.string(),
  condition: z.enum(CONDITIONS).nullable(),
  priceKind: z.enum(PRICE_KINDS, { error: "Choose a price." }),
  // Typed as text so "1,200" works; parsed in parseFields.
  priceAmount: z.string(),
  // How many are available (or needed, on a Wishlist). Typed as text; "unlimited" means ongoing, no limit.
  quantity: z.string().default("1"),
  unlimited: z.boolean().default(false),
  exchangeMeetup: z.boolean(),
  exchangeDelivery: z.boolean(),
  meetupLocation: z.string(),
  // How payment is made (ignored for a free post). Cash unless said otherwise.
  paymentCash: z.boolean().default(true),
  paymentOnline: z.boolean().default(false),
  paymentOther: z.boolean().default(false),
  paymentNote: z.string().default(""),
  availability: z.array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("weekly"), weekday: z.number(), startTime: z.string(), endTime: z.string() }),
      z.object({ kind: z.literal("date"), date: z.string(), startTime: z.string(), endTime: z.string() }),
    ]),
  ),
  // In order; the first is the cover. A caption is "" when the photo has none.
  photos: z.array(z.object({ id: z.string(), caption: z.string() })),
});
export type PostFields = z.input<typeof postFieldsSchema>;

export const newPostSchema = postFieldsSchema.extend({ kind: z.enum(POST_KINDS, { error: "Choose Showcase or Wishlist." }) });
export type NewPostInput = z.input<typeof newPostSchema>;

/** Validated, normalized post data ready for the database. */
export type PostData = {
  title: string;
  description: string;
  categoryId: string;
  condition: Condition | null;
  priceKind: PriceKind;
  priceAmount: number | null;
  /** Units available; null when ongoing (no limit). */
  quantity: number | null;
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  meetupLocation: string | null;
  paymentCash: boolean;
  paymentOnline: boolean;
  paymentOther: boolean;
  paymentNote: string | null;
  availability: Availability[];
  photos: { id: string; caption: string | null }[];
};

export type FieldErrors = Partial<Record<string, string>>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** What the rules need to know about the chosen category. */
export type CategoryLookup = (categoryId: string) => { requiresCondition: boolean } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textError(value: string, label: string, max: number): string | undefined {
  if (value.length === 0) return `Add ${label}.`;
  if (value.length > max) return `Use at most ${max} characters.`;
  return undefined;
}

function parseFields(raw: z.output<typeof postFieldsSchema>, lookup: CategoryLookup, now: Date) {
  const errors: FieldErrors = {};

  const title = raw.title.trim();
  const description = raw.description.trim();
  errors.title = textError(title, "a title", TITLE_MAX);
  errors.description = textError(description, "a description", DESCRIPTION_MAX);

  const photoIds = raw.photos.map((p) => p.id);
  if (photoIds.length === 0) errors.photos = "Add at least one photo.";
  else if (photoIds.length > PHOTOS_MAX) errors.photos = `Add at most ${PHOTOS_MAX} photos.`;
  else if (!photoIds.every((id) => UUID.test(id))) errors.photos = "A photo is missing. Upload it again.";
  else if (new Set(photoIds).size !== photoIds.length) errors.photos = "A photo was added twice.";
  const photos = raw.photos.map((p, index) => {
    const caption = p.caption.trim();
    if (caption.length > CAPTION_MAX) errors[`photos.${index}`] = `Use at most ${CAPTION_MAX} characters.`;
    return { id: p.id, caption: caption.length > 0 ? caption : null };
  });

  const category = lookup(raw.categoryId);
  if (!category) errors.categoryId = "Choose a category.";
  else if (category.requiresCondition && !raw.condition) errors.condition = "Choose the condition.";

  let priceAmount: number | null = null;
  if (raw.priceKind === "amount") {
    const digits = raw.priceAmount.replace(/[\s,₱]/g, "");
    priceAmount = /^\d+$/.test(digits) ? Number(digits) : NaN;
    if (!Number.isInteger(priceAmount) || priceAmount < 1 || priceAmount > PRICE_MAX) {
      errors.priceAmount = `Enter a whole amount from ₱1 to ₱${PRICE_MAX.toLocaleString("en-PH")}. Choose "Free" for ₱0.`;
    }
  }

  let quantity: number | null = null;
  if (!raw.unlimited) {
    const digits = raw.quantity.trim();
    quantity = /^\d{1,4}$/.test(digits) ? Number(digits) : NaN;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUANTITY_MAX) {
      errors.quantity = `Enter a whole number from 1 to ${QUANTITY_MAX.toLocaleString("en-PH")}, or choose Ongoing.`;
    }
  }

  if (!raw.exchangeMeetup && !raw.exchangeDelivery) errors.exchange = "Choose meet-up, delivery, or both.";
  const meetupLocation = raw.meetupLocation.trim();
  if (raw.exchangeMeetup && (meetupLocation.length === 0 || meetupLocation.length > PLACE_MAX)) {
    errors.meetupLocation = "Say where to meet (for example, the main gate).";
  }

  // A free post has no payment. Otherwise at least one way, and a note only with online or others.
  const pays = raw.priceKind !== "free";
  const paymentNote = raw.paymentNote.trim();
  if (pays && !raw.paymentCash && !raw.paymentOnline && !raw.paymentOther) errors.payment = "Choose how payment is made.";
  if (pays && (raw.paymentOnline || raw.paymentOther) && paymentNote.length > PAYMENT_NOTE_MAX) errors.paymentNote = `Use at most ${PAYMENT_NOTE_MAX} characters.`;

  if (raw.availability.length === 0) errors.availability = "Choose at least one day or date you are available.";
  else if (raw.availability.length > AVAILABILITY_MAX) errors.availability = `Choose at most ${AVAILABILITY_MAX} days or dates.`;
  const today = manilaToday(now);
  const lastDay = addDays(today, AVAILABILITY_DAYS_AHEAD);
  const seen = new Set<string>();
  const availability: Availability[] = [];
  raw.availability.forEach((entry, index) => {
    const key = `availability.${index}`;
    const startTime = parseTime(entry.startTime);
    const endTime = parseTime(entry.endTime);
    let day: string;
    if (entry.kind === "weekly") {
      if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) {
        errors[key] = "Choose a day of the week.";
        return;
      }
      day = `weekday:${entry.weekday}`;
    } else {
      const date = parseDate(entry.date);
      if (!date) {
        errors[key] = "Choose a date.";
        return;
      }
      if (date < today) {
        errors[key] = "This date has passed.";
        return;
      }
      if (date > lastDay) {
        errors[key] = `Choose a date within ${AVAILABILITY_DAYS_AHEAD} days.`;
        return;
      }
      day = `date:${date}`;
    }
    if (seen.has(day)) errors[key] = "This day is listed twice.";
    else if (!startTime || !endTime) errors[key] = "Choose a start and an end time.";
    else if (endTime <= startTime) errors[key] = "The end time must be after the start time.";
    seen.add(day);
    if (errors[key] || !startTime || !endTime) return;
    availability.push(
      entry.kind === "weekly"
        ? { kind: "weekly", weekday: entry.weekday, startTime, endTime }
        : { kind: "date", date: day.slice(5), startTime, endTime },
    );
  });

  if (Object.values(errors).some(Boolean)) return { ok: false as const, errors };
  // Conditions only belong to categories that ask for one.
  const data: PostData = {
    title,
    description,
    categoryId: raw.categoryId,
    condition: category?.requiresCondition ? raw.condition : null,
    priceKind: raw.priceKind,
    priceAmount,
    quantity,
    exchangeMeetup: raw.exchangeMeetup,
    exchangeDelivery: raw.exchangeDelivery,
    meetupLocation: raw.exchangeMeetup ? meetupLocation : null,
    paymentCash: pays && raw.paymentCash,
    paymentOnline: pays && raw.paymentOnline,
    paymentOther: pays && raw.paymentOther,
    paymentNote: pays && (raw.paymentOnline || raw.paymentOther) && paymentNote.length > 0 ? paymentNote : null,
    availability,
    photos,
  };
  return { ok: true as const, data };
}

function zodErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    // Errors inside the photo list belong to the photo field as a whole.
    const field = key.startsWith("photos") ? "photos" : key;
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Validates a post being created. */
export function parseNewPost(
  input: unknown,
  lookup: CategoryLookup,
  now = new Date(),
): ParseResult<PostData & { kind: PostKind }> {
  const shape = newPostSchema.safeParse(input);
  if (!shape.success) return { ok: false, errors: zodErrors(shape.error) };
  const fields = parseFields(shape.data, lookup, now);
  if (!fields.ok) return fields;
  return { ok: true, data: { ...fields.data, kind: shape.data.kind } };
}

/** Validates an edit. The kind is not part of it: it never changes. */
export function parsePostEdit(input: unknown, lookup: CategoryLookup, now = new Date()): ParseResult<PostData> {
  const shape = postFieldsSchema.safeParse(input);
  if (!shape.success) return { ok: false, errors: zodErrors(shape.error) };
  return parseFields(shape.data, lookup, now);
}
