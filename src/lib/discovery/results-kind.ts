/** What the results area will show once a navigation lands, so a skeleton of the right shape can stand in meanwhile. */
export type ResultsKind = "grid" | "categories" | "people" | "schools";

// A Posts search with none of these shows the list of categories to tick instead of posts.
const NARROWING = ["q", "kind", "category", "condition", "min", "max", "school", "listed"];

/** The kind of results the page at `href` shows: a card grid, the category list, or the People or Schools list (also where they show only a hint). */
export function resultsKindFor(href: string): ResultsKind {
  const url = new URL(href, "http://local");
  if (url.pathname !== "/search") return "grid";
  const tab = url.searchParams.get("tab");
  if (tab === "people" || tab === "schools") return tab;
  return NARROWING.some((key) => (url.searchParams.get(key) ?? "") !== "") ? "grid" : "categories";
}
