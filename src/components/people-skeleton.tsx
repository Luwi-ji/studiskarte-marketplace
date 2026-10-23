const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** Eight rows where a list of people will be: a round picture, a name, a handle and a school, with the row's chevron. Same row height as the real list; calm pulse, still with reduced motion. */
export function PeopleSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col divide-y divide-zinc-200 motion-safe:animate-pulse dark:divide-zinc-800">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="flex min-h-16 items-center gap-3 px-3 py-2">
          <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className={`h-4 ${i % 3 === 0 ? "w-3/5" : i % 3 === 1 ? "w-2/5" : "w-1/2"} ${block}`} />
            <div className={`h-3 ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-1/3" : "w-1/4"} ${block}`} />
          </div>
          <div className={`h-4 w-4 shrink-0 ${block}`} />
        </li>
      ))}
    </ul>
  );
}
