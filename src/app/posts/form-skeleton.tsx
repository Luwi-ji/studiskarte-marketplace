const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** Grey blocks in the shape of the post form (photos, title, category, price), so the page does not jump when the form arrives. Same calm pulse as the other skeletons. */
export function PostFormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6 motion-safe:animate-pulse">
      <div className="flex flex-col gap-2">
        <div className={`h-4 w-24 ${block}`} />
        <div className="h-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="flex flex-col gap-2">
        <div className={`h-4 w-16 ${block}`} />
        <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="h-14 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-2">
        <div className={`h-4 w-20 ${block}`} />
        <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="flex flex-col gap-2">
        <div className={`h-4 w-28 ${block}`} />
        <div className="h-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
