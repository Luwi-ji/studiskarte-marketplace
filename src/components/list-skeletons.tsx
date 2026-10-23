// Same grey blocks and the same calm pulse as the rest of the app's skeletons (skeletons.tsx); still with reduced motion.
const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** Six notification rows where the list will be: an icon circle, two lines of different width, a short time at the right. Same row height as the real list. */
export function NotificationsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col divide-y divide-zinc-200 motion-safe:animate-pulse dark:divide-zinc-800">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex min-h-16 items-center gap-3 px-3 py-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-4 ${i % 3 === 0 ? "w-4/5" : i % 3 === 1 ? "w-3/5" : "w-2/3"} ${block}`} />
            <div className={`h-3 ${i % 3 === 0 ? "w-1/2" : i % 3 === 1 ? "w-2/5" : "w-1/3"} ${block}`} />
          </div>
          <div className={`h-3 w-9 shrink-0 ${block}`} />
        </li>
      ))}
    </ul>
  );
}

/** Six cards in the Hearted page's grid (two columns, three from `sm`): a square photo, a price, two title lines, a seller line. */
export function HeartedSkeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-2 motion-safe:animate-pulse sm:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-1 p-2">
            <div className={`h-5 w-1/2 ${block}`} />
            <div className={`h-4 w-5/6 ${block}`} />
            <div className={`h-4 w-2/3 ${block}`} />
            <div className={`h-3 w-1/2 ${block}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
