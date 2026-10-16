import { WEEKDAY_LABEL, type Availability } from "@/lib/posts/schema";

/** The post type as students see it: "Showcase" (I offer) or "Wishlist" (I seek). */
export function kindLabel(kind: string): string {
  return kind === "wishlist" ? "Wishlist" : "Showcase";
}

/** "₱1,200", "Free" or "Negotiable". */
export function formatPrice(priceKind: string, priceAmount: number | null): string {
  if (priceKind === "free") return "Free";
  if (priceKind === "amount" && priceAmount !== null) return `₱${priceAmount.toLocaleString("en-PH")}`;
  return "Negotiable";
}

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  reserved: "Reserved",
  fulfilled: "Fulfilled",
  withdrawn: "Withdrawn",
  expired: "Expired",
  hidden: "Hidden pending review",
  removed: "Removed",
};

/** "15:00" as "3:00 PM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const DATE = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Every Monday" or "Fri, Oct 16", plus "3:00 PM – 5:30 PM". */
export function formatAvailability(entry: Availability): { day: string; time: string } {
  const day = entry.kind === "weekly" ? `Every ${WEEKDAY_LABEL[entry.weekday]}` : DATE.format(new Date(`${entry.date}T00:00:00Z`));
  return { day, time: `${formatTime(entry.startTime)} – ${formatTime(entry.endTime)}` };
}

/** Owners are warned in the last 3 days of a listing (business logic, "Posts"). */
export const EXPIRY_WARNING_DAYS = 3;

/** How a listing's remaining time reads, and whether it deserves a warning. */
export function expiryNotice(expiresAt: Date, now = new Date()): { text: string; warn: boolean } {
  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return { text: "Expires today", warn: true };
  if (days === 1) return { text: "Expires tomorrow", warn: true };
  return { text: `Expires in ${days} days`, warn: days <= EXPIRY_WARNING_DAYS };
}

/**
 * How many are taken, for a post with more than one (or no limit): "2 of 5
 * reserved", "3 reserved" (ongoing), or "Ongoing, no limit" when none yet.
 * A single item has nothing to count: its status says "Reserved". A Wishlist
 * counts suppliers chosen.
 */
export function quantityLine(kind: string, quantity: number | null, taken: number): string | null {
  const done = kind === "wishlist" ? "supplied" : "reserved";
  if (quantity === null) return taken > 0 ? `${taken} ${done}` : "Ongoing, no limit";
  if (quantity === 1) return null;
  return `${taken} of ${quantity} ${done}`;
}
