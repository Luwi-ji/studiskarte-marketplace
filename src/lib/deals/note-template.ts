import type { OfferKind } from "@/lib/deals/rules";

/**
 * The editable note an offer or reserve starts with. A showcase is asked for ("I want this");
 * a wishlist is answered ("I have this"). An offer names the typed amount once there is one.
 */
export function noteTemplate(postKind: "showcase" | "wishlist", offerKind: OfferKind, amount: string): string {
  const wishlist = postKind === "wishlist";
  if (offerKind === "reserve") return wishlist ? "I have this. Do you want to see it?" : "I want this.";
  const pesos = Number(amount);
  const price = Number.isInteger(pesos) && pesos > 0 ? `₱${pesos.toLocaleString("en-PH")}` : wishlist ? "my price" : "my offered price";
  return `${wishlist ? "I have this" : "I want this"} for ${price}.`;
}
