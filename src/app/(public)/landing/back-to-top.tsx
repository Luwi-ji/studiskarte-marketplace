"use client";

import { useEffect, useState } from "react";

/** A round arrow that appears once the page has been scrolled, and takes the visitor back up. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hidden near the bottom, where the footer has its own link back up.
    const onScroll = () => setVisible(window.scrollY > 700 && window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={`press fixed bottom-5 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-all duration-200 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
      </svg>
    </button>
  );
}
