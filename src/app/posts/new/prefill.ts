import type { PaymentMode } from "@/lib/payment";
import { PLACE_MAX, type PostKind } from "@/lib/posts/schema";
import type { PostFormValues } from "../post-form";

type Raw = Record<string, string | string[] | undefined>;

const PAYMENT_MODES: readonly string[] = ["cash", "online", "other"];

function first(raw: Raw, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

/** The kind named in an address like `/posts/new?kind=wishlist` (the old way in), if it is a real one. */
export function kindFrom(raw: Raw): PostKind | undefined {
  const kind = first(raw, "kind");
  return kind === "showcase" || kind === "wishlist" ? kind : undefined;
}

/** "Post another" from a new post's page opens the form with the same place and payment. Anything unreadable is ignored. */
export function prefillFrom(raw: Raw): Partial<PostFormValues> | undefined {
  const values: Partial<PostFormValues> = {};
  const place = first(raw, "place")?.trim().slice(0, PLACE_MAX);
  if (place) values.meetupLocation = place;
  const modes = (first(raw, "pay") ?? "").split(",").filter((mode): mode is PaymentMode => PAYMENT_MODES.includes(mode));
  if (modes.length > 0) {
    values.paymentCash = modes.includes("cash");
    values.paymentOnline = modes.includes("online");
    values.paymentOther = modes.includes("other");
  }
  return Object.keys(values).length > 0 ? values : undefined;
}

/** The `place` and `pay` parts of an address, kept when the old `?kind=` address is sent on to its own page. */
export function carriedQuery(raw: Raw): string {
  const params = new URLSearchParams();
  for (const key of ["place", "pay"]) {
    const value = first(raw, key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
