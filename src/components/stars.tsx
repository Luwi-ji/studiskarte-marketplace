/** A student's average rating: one star, the number and how many reviews it comes from, like "★ 4.5 (12)". */
export function Stars({ average, count }: { average: number | null; count: number }) {
  if (average === null) return <span className="text-sm text-zinc-500">No reviews yet</span>;
  return (
    <span aria-label={`${average.toFixed(1)} out of 5 from ${count} reviews`} role="img" className="inline-flex items-center gap-1 text-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-amber-500" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
      </svg>
      <span aria-hidden="true" className="font-medium text-zinc-900 dark:text-zinc-100">
        {average.toFixed(1)}
      </span>
      <span aria-hidden="true" className="text-zinc-500">
        ({count})
      </span>
    </span>
  );
}

/** The stars of one review. */
export function StarRow({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} role="img" className="text-amber-500">
      {"★".repeat(rating) + "☆".repeat(5 - rating)}
    </span>
  );
}
