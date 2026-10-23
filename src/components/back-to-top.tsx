"use client";

/** A 44 px round up-arrow that scrolls the page back to the top (at once, with reduced motion). */
export function BackToTop({ label = "Back to the top" }: { label?: string }) {
  function backToTop() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "instant" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={backToTop}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 transition-colors duration-200 ease-out active:bg-zinc-100 motion-reduce:transition-none dark:border-zinc-700 dark:active:bg-zinc-800"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
