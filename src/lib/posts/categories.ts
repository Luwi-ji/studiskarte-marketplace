import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { category } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { CategoryLookup } from "@/lib/posts/schema";

export type CategoryTree = {
  id: string;
  name: string;
  requiresCondition: boolean;
  subcategories: { id: string; name: string }[];
}[];

const main = alias(category, "main");

/** Main categories in order, each with its subcategories. */
export async function listCategories(): Promise<CategoryTree> {
  const rows = await getDb()
    .select({
      mainId: main.id,
      mainName: main.name,
      requiresCondition: main.requiresCondition,
      subId: category.id,
      subName: category.name,
    })
    .from(category)
    .innerJoin(main, eq(main.id, category.parentId))
    .orderBy(asc(main.position), asc(category.position));

  const tree: CategoryTree = [];
  for (const row of rows) {
    let entry = tree.at(-1);
    if (entry?.id !== row.mainId) {
      entry = { id: row.mainId, name: row.mainName, requiresCondition: row.requiresCondition, subcategories: [] };
      tree.push(entry);
    }
    entry.subcategories.push({ id: row.subId, name: row.subName });
  }
  return tree;
}

/** Lookup from subcategory id to its main category's condition rule. */
export function categoryLookup(tree: CategoryTree): CategoryLookup {
  const bySub = new Map<string, { requiresCondition: boolean }>();
  for (const entry of tree) {
    for (const sub of entry.subcategories) bySub.set(sub.id, { requiresCondition: entry.requiresCondition });
  }
  return (id) => bySub.get(id);
}
