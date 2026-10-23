import { STATUS_LABEL } from "@/lib/posts/format";

/**
 * How My posts is sliced: by type (the post's kind) and by status group. Pure, so the page, the tab strip in the
 * browser and the tests all read the address the same way. Nothing here touches the database.
 */

export const OWN_TYPES = ["all", "showcase", "wishlist"] as const;
export type OwnType = (typeof OWN_TYPES)[number];

export const OWN_STATUSES = ["all", "open", "reserved", "fulfilled", "expired", "withdrawn", "hidden"] as const;
export type OwnStatus = (typeof OWN_STATUSES)[number];
export type OwnStatusGroup = Exclude<OwnStatus, "all">;

export const OWN_TYPE_LABEL: Record<OwnType, string> = { all: "All", showcase: "Showcase", wishlist: "Wishlist" };
export const OWN_STATUS_LABEL: Record<OwnStatus, string> = {
  all: "All",
  open: "Open",
  reserved: "Reserved",
  fulfilled: "Finished",
  expired: "Expired",
  withdrawn: "Withdrawn",
  hidden: "Hidden",
};

/** The word on a row's status chip: the strip's word where there is one, else the usual label ("Hidden pending review", "Removed"). */
export function rowStatusLabel(status: string): string {
  if (status === "fulfilled") return "Finished";
  return STATUS_LABEL[status] ?? status;
}

/** Which status tab a post sits under. Hidden and removed posts (taken off by review) share one tab. */
export function statusGroup(status: string): OwnStatusGroup {
  if (status === "open" || status === "reserved" || status === "fulfilled" || status === "expired" || status === "withdrawn") return status;
  return "hidden";
}

export type OwnView = { type: OwnType; status: OwnStatus };

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The view an address asks for. `tab` is the older name for the type (the post page links to `?tab=showcase`); anything unknown is "All". */
export function parseOwnView(params: Record<string, string | string[] | undefined>): OwnView {
  const type = one(params.type) ?? one(params.tab);
  const status = one(params.status);
  return {
    type: OWN_TYPES.find((t) => t === type) ?? "all",
    status: OWN_STATUSES.find((s) => s === status) ?? "all",
  };
}

const PATH = "/me/posts";

/** The address of a view; "All" and "All" is the bare page. */
export function ownViewHref(view: OwnView): string {
  const query = new URLSearchParams();
  if (view.type !== "all") query.set("type", view.type);
  if (view.status !== "all") query.set("status", view.status);
  const text = query.toString();
  return text ? `${PATH}?${text}` : PATH;
}

/** The view an address in this page's own space stands for (the pending address while a tab loads); null for any other address. */
export function viewOfHref(href: string): OwnView | null {
  const url = new URL(href, "http://local");
  if (url.pathname !== PATH) return null;
  return parseOwnView(Object.fromEntries(url.searchParams));
}

export type OwnCounts = Record<OwnType, Record<OwnStatus, number>>;

/** How many posts sit under each type and status; "all" adds up the others. */
export function countOwnPosts(posts: { kind: string; status: string }[]): OwnCounts {
  const zero = () => Object.fromEntries(OWN_STATUSES.map((s) => [s, 0])) as Record<OwnStatus, number>;
  const counts: OwnCounts = { all: zero(), showcase: zero(), wishlist: zero() };
  for (const p of posts) {
    const group = statusGroup(p.status);
    const types: OwnType[] = p.kind === "wishlist" ? ["all", "wishlist"] : ["all", "showcase"];
    for (const type of types) {
      counts[type][group] += 1;
      counts[type].all += 1;
    }
  }
  return counts;
}

/** Posts that match a view. */
export function inOwnView<T extends { kind: string; status: string }>(posts: T[], view: OwnView): T[] {
  return posts.filter((p) => (view.type === "all" || p.kind === view.type) && (view.status === "all" || statusGroup(p.status) === view.status));
}

/** What can be done to many posts at once, and to which statuses (the same rules as the single-post actions). */
export const BULK_ACTIONS = ["relist", "withdraw", "delete"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_ELIGIBLE: Record<BulkAction, readonly string[]> = {
  relist: ["expired"],
  withdraw: ["open", "reserved"],
  delete: ["expired", "withdrawn"],
};
