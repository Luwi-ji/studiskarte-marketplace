import Link from "next/link";

/** Newer/older links for a list paged with `?page=`. Renders nothing when there is only one page. */
export function Pager({ base, page, hasMore }: { base: string; page: number; hasMore: boolean }) {
  if (page <= 1 && !hasMore) return null;
  const href = (n: number) => (n <= 1 ? base : `${base}?page=${n}`);
  const link = "flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700";
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          ‹ Newer
        </Link>
      ) : (
        <span />
      )}
      {hasMore ? (
        <Link href={href(page + 1)} className={link}>
          Older ›
        </Link>
      ) : null}
    </nav>
  );
}
