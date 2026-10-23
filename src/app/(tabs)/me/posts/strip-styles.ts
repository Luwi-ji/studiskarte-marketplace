// The type strip uses the feed's tab classes (components/feed-header.tsx): the underline is always there, collapsed, and the
// current tab grows it (under 150 ms, not at all with reduced motion). Kept in step with the feed's by hand.
const tabBase =
  "relative flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ease-out active:opacity-80 motion-reduce:transition-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-text after:transition-transform after:duration-150 after:ease-out motion-reduce:after:transition-none";
export const tabOff = `${tabBase} text-zinc-600 after:scale-x-0 dark:text-zinc-400`;
export const tabOn = `${tabBase} font-semibold text-brand-text after:scale-x-100`;

/** Where the sticky strip sits: right under the page header (56 px, its hairline, and the notch). */
export const STRIP_TOP = "top-[calc(3.5rem+1px+env(safe-area-inset-top))]";
