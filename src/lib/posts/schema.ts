import { z } from "zod";

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
export const WINDOWS_MAX = 10;
export const OPEN_POSTS_MAX = 20;

// The Philippines has one time zone and no daylight saving time.
const MANILA_OFFSET = "+08:00";
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A `datetime-local` value (Manila time) as a Date, or null if malformed. */
export function fromManilaLocal(value: string): Date | null {
  if (!LOCAL_DATETIME.test(value)) return null;
  const date = new Date(`${value}:00${MANILA_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A Date as a `datetime-local` value in Manila time. */
export function toManilaLocal(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
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
  exchangeMeetup: z.boolean(),
  exchangeDelivery: z.boolean(),
  meetupLocation: z.string(),
  deliveryArea: z.string(),
  availability: z.array(z.object({ startsAt: z.string(), endsAt: z.string() })),
  photoIds: z.array(z.string()),
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
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  meetupLocation: string | null;
  deliveryArea: string | null;
  availability: { startsAt: Date; endsAt: Date }[];
  photoIds: string[];
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

  if (raw.photoIds.length === 0) errors.photoIds = "Add at least one photo.";
  else if (raw.photoIds.length > PHOTOS_MAX) errors.photoIds = `Add at most ${PHOTOS_MAX} photos.`;
  else if (!raw.photoIds.every((id) => UUID.test(id))) errors.photoIds = "A photo is missing. Upload it again.";
  else if (new Set(raw.photoIds).size !== raw.photoIds.length) errors.photoIds = "A photo was added twice.";

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

  if (!raw.exchangeMeetup && !raw.exchangeDelivery) errors.exchange = "Choose meet-up, delivery, or both.";
  const meetupLocation = raw.meetupLocation.trim();
  const deliveryArea = raw.deliveryArea.trim();
  if (raw.exchangeMeetup && (meetupLocation.length === 0 || meetupLocation.length > PLACE_MAX)) {
    errors.meetupLocation = "Say where to meet (for example, the main gate).";
  }
  if (raw.exchangeDelivery && (deliveryArea.length === 0 || deliveryArea.length > PLACE_MAX)) {
    errors.deliveryArea = "Say where you deliver (for example, within campus).";
  }

  if (raw.availability.length === 0) errors.availability = "Add at least one time you are available.";
  else if (raw.availability.length > WINDOWS_MAX) errors.availability = `Add at most ${WINDOWS_MAX} times.`;
  const availability: { startsAt: Date; endsAt: Date }[] = [];
  raw.availability.forEach((window, index) => {
    const startsAt = fromManilaLocal(window.startsAt);
    const endsAt = fromManilaLocal(window.endsAt);
    if (!startsAt || !endsAt) errors[`availability.${index}`] = "Enter a start and an end.";
    else if (endsAt <= startsAt) errors[`availability.${index}`] = "The end must be after the start.";
    else if (endsAt <= now) errors[`availability.${index}`] = "This time has already passed.";
    else availability.push({ startsAt, endsAt });
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
    exchangeMeetup: raw.exchangeMeetup,
    exchangeDelivery: raw.exchangeDelivery,
    meetupLocation: raw.exchangeMeetup ? meetupLocation : null,
    deliveryArea: raw.exchangeDelivery ? deliveryArea : null,
    availability,
    photoIds: raw.photoIds,
  };
  return { ok: true as const, data };
}

function zodErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    // Errors inside the photo list belong to the photo field as a whole.
    const field = key.startsWith("photoIds") ? "photoIds" : key;
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
