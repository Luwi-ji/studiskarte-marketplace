const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** Two rows of grey cards where the grid will be, so the page does not jump when the posts arrive. */
export function CardGridSkeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-2 motion-safe:animate-pulse sm:grid-cols-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-2 p-2">
            <div className={`h-5 w-1/2 ${block}`} />
            <div className={`h-4 w-5/6 ${block}`} />
            <div className={`h-3 w-2/3 ${block}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A photo, a price, a title and a seller row where a post will be. */
export function PostSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-md motion-safe:animate-pulse">
      <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className={`h-7 w-1/3 ${block}`} />
        <div className={`h-6 w-3/4 ${block}`} />
        <div className={`h-14 w-full ${block}`} />
      </div>
    </div>
  );
}
