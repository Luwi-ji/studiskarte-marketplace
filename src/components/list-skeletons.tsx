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

/** Settings while it loads: three groups of rows at the real rows' height, with a subhead each. */
export function SettingsSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      {[3, 2, 4].map((rows, g) => (
        <div key={g}>
          <div className={`mx-4 mb-2 mt-5 h-3 w-20 ${block}`} />
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i} className={`flex items-center gap-3 px-4 ${g === 0 && i === 0 ? "min-h-20" : "min-h-12"}`}>
                <div className={`${g === 0 && i === 0 ? "h-14 w-14 rounded-full" : "h-6 w-6"} shrink-0 bg-zinc-200 dark:bg-zinc-800`} />
                <div className={`h-4 ${i % 2 === 0 ? "w-2/5" : "w-1/3"} ${block}`} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The Edit profile page while it loads: the big picture, then the two rows. */
export function EditProfileSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="h-24 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className={`h-4 w-28 ${block}`} />
      </div>
      <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {[0, 1].map((i) => (
          <li key={i} className="flex min-h-12 items-center justify-between gap-3 px-4">
            <div className={`h-4 w-24 ${block}`} />
            <div className={`h-4 w-28 ${block}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
