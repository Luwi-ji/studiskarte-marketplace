const glyphs = (filled: number) => "★".repeat(filled) + "☆".repeat(5 - filled);

/** A student's average rating: five stars, the number and how many reviews it comes from. */
export function Stars({ average, count }: { average: number | null; count: number }) {
  if (average === null) return <span className="text-sm text-zinc-500">No reviews yet</span>;
  return (
    <span aria-label={`${average.toFixed(1)} out of 5 from ${count} reviews`} className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden="true" className="text-amber-500">
        {glyphs(Math.round(average))}
      </span>
      <span aria-hidden="true" className="font-medium">
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
      {glyphs(rating)}
    </span>
  );
}
