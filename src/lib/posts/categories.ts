import { asc } from "drizzle-orm";
import { category } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { CategoryLookup } from "@/lib/posts/schema";

export type Category = { id: string; name: string; requiresCondition: boolean };

/** The categories in display order (one level; owner, 2026-10-16). */
export async function listCategories(): Promise<Category[]> {
  return getDb()
    .select({ id: category.id, name: category.name, requiresCondition: category.requiresCondition })
    .from(category)
    .orderBy(asc(category.position));
}

/** Lookup from category id to its condition rule. */
export function categoryLookup(categories: Category[]): CategoryLookup {
  const byId = new Map(categories.map((c) => [c.id, { requiresCondition: c.requiresCondition }]));
  return (id) => byId.get(id);
}
