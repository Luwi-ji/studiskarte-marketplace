import { OWN_TYPE_LABEL, OWN_TYPES } from "@/lib/posts/own-view";
import { STRIP_TOP, tabOff } from "./strip-styles";

// Same grey blocks and the same calm pulse as the rest of the app's skeletons (components/skeletons.tsx); still with reduced motion.
const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** The type strip while the page loads: inert labels in the strip's own place, so nothing moves when the real one arrives. */
export function TypeStripSkeleton() {
  return (
    <div className={`sticky ${STRIP_TOP} z-10 border-b border-zinc-200 bg-[var(--background)] dark:border-zinc-800`}>
      <div className="mx-auto flex w-full max-w-3xl px-2">
        {OWN_TYPES.map((type) => (
          <span key={type} className={`${tabOff} opacity-60`}>
            {OWN_TYPE_LABEL[type]}
          </span>
        ))}
      </div>
      <div aria-hidden className="mx-auto flex h-11 w-full max-w-3xl items-center gap-2 overflow-hidden px-3 motion-safe:animate-pulse">
        {[14, 20, 24, 20, 24].map((w, i) => (
          <div key={i} className="h-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    </div>
  );
}

/** The usage line below the sticky type and status strips. */
export function StatusRowSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1 motion-safe:animate-pulse">
      <div className="flex h-11 flex-col justify-center gap-2">
        <div className={`h-3 w-2/5 ${block}`} />
        <div className={`h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800`} />
      </div>
    </div>
  );
}

/** Rows where the list will be: a square photo, two pills, a price and two title lines, at the real rows' height. */
export function OwnPostsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-2 motion-safe:animate-pulse sm:grid sm:grid-cols-2">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl border border-zinc-200/80 p-2.5 dark:border-zinc-800">
          <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex gap-1">
              <div className="h-5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className={`h-5 w-1/3 ${block}`} />
            <div className={`h-4 ${i % 2 === 0 ? "w-5/6" : "w-2/3"} ${block}`} />
            <div className={`h-3 w-1/2 ${block}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
