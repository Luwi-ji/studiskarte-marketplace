import type { ReactNode } from "react";

/**
 * One outline icon per category id, all drawn the same way: 24 px grid, 2 px stroke, round caps and joins, the colour
 * of the surrounding text. An id with no drawing here (a category added later) gets the plain tag.
 */
const TAG = (
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <path d="M7.5 7.5h.01" />
  </>
);

const DRAWINGS: Record<string, ReactNode> = {
  // Textbooks & Study Materials: a book.
  textbooks: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
    </>
  ),
  // School & Office Supplies: a pencil.
  supplies: (
    <>
      <path d="m4 20 1-4L16 5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="m14 7 3 3" />
    </>
  ),
  // Uniforms & Org Merch: a shirt.
  uniforms: <path d="M8 3 3 6.5 5 10l3-1v12h8V9l3 1 2-3.5L16 3a4 4 0 0 1-8 0z" />,
  // Electronics & Gadgets: headphones.
  electronics: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </>
  ),
  // Dorm & Living Essentials: a bed.
  dorm: (
    <>
      <path d="M3 5v14M3 15h18v4M21 15v-3a2 2 0 0 0-2-2h-8v5" />
      <circle cx="7" cy="11.5" r="1.5" />
    </>
  ),
  // Clothing & Accessories: a coat hanger.
  clothing: (
    <>
      <path d="M12 8 3.6 14.4A1.5 1.5 0 0 0 4.5 17h15a1.5 1.5 0 0 0 .9-2.6z" />
      <path d="M12 8V6.5a2 2 0 1 0-2-2" />
    </>
  ),
  // Hobbies & Entertainment: a game controller.
  hobbies: (
    <>
      <path d="M7 7h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.2 2l-1.3-1.5h-5L8.2 16A3 3 0 0 1 3 14v-3a4 4 0 0 1 4-4z" />
      <path d="M8 10v3M6.5 11.5h3M16 11h.01M18 13h.01" />
    </>
  ),
  // Transportation: a bus.
  transport: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="2" />
      <path d="M4 11h16M7 17v3M17 17v3M8 14h.01M16 14h.01" />
    </>
  ),
  // Housing & Bedspace: a house.
  housing: <path d="M3 11 12 3l9 8M5 9.5V20h5v-6h4v6h5V9.5" />,
  // Food & Treats: a fork and a knife.
  food: <path d="M6 3v6a2 2 0 0 0 4 0V3M8 3v18M17 21V3c-2 1-3 4-3 8h3" />,
  // Services: a briefcase.
  services: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
  other: TAG,
};

export function CategoryIcon({ id, className = "h-6 w-6" }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {DRAWINGS[id] ?? TAG}
    </svg>
  );
}
