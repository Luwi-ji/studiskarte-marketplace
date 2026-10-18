import { listCategories } from "@/lib/posts/categories";
import { listSchoolsWithPosts } from "@/lib/discovery/search";

/** The choices in the filter sheet: every category, and the schools that have posts now. */
export async function filterOptions(viewerId: string) {
  const [categories, schools] = await Promise.all([listCategories(), listSchoolsWithPosts(viewerId)]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    schools: schools.map((s) => ({ id: s.domain, name: s.name })),
  };
}
