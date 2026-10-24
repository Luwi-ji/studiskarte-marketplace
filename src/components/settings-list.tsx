import Link from "next/link";
import type { ReactNode } from "react";

/** Stroke paths (24 px grid) for the row icons. */
const ICONS = {
  user: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4l2-2zM10 21h4",
  calendar: "M4 6h16v14H4V6zM4 10h16M8 3v4M16 3v4",
  shield: "M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4",
  grid: "M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z",
  gift: "M4 10h16v10H4V10zM3 7h18v3H3V7zM12 7v13M12 7c-2 0-4-1-4-2.5S10 2 12 7zM12 7c2 0 4-1 4-2.5S14 2 12 7z",
  heart: "M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
  block: "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8",
  tool: "M14.5 6.5a4 4 0 00-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z",
  doc: "M7 3h7l4 4v14H7V3zM14 3v4h4M10 12h5M10 16h5",
  school: "M3 9l9-5 9 5-9 5-9-5zM7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  refresh: "M20 11a8 8 0 00-14.5-4M4 4v4h4M4 13a8 8 0 0014.5 4M20 20v-4h-4",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5",
  off: "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8",
  help: "M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 114 2c-.8.5-1.5 1-1.5 2M12 17h.01",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  bug: "M9 9a3 3 0 016 0v7a3 3 0 01-6 0V9zM12 9v10M9 12H5M15 12h4M9 16H5.5M15 16h3.5M10 5L8.5 3M14 5l1.5-2",
  chat: "M4 5h16v11H9l-5 4V5z",
  mail: "M3 6h18v12H3V6zM3 7l9 7 9-7",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
} as const;

export type SettingsIconName = keyof typeof ICONS;

export function SettingsIcon({ name, className = "h-6 w-6" }: { name: SettingsIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0 fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function RowChevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** The trailing mark of a row that leaves the app. */
export function ExternalMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
    </svg>
  );
}

/**
 * A labelled section of rows: a small muted label, then the rows, then a thick darker band before the next section.
 * The same structure on Settings and on every page under it, so every list in the account area reads alike.
 */
export function SettingsSection({ label, note, children }: { label?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col border-t-8 border-zinc-100 pb-3 first:border-t-0 dark:border-zinc-900">
      {label ? <h2 className="px-4 pb-1 pt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</h2> : <div className="h-1" />}
      <ul>{children}</ul>
      {note ? <p className="px-4 pt-2 text-sm text-zinc-600 dark:text-zinc-400">{note}</p> : null}
    </section>
  );
}

type RowProps = {
  label: ReactNode;
  icon?: ReactNode;
  /** The current value, right-aligned and muted. */
  value?: ReactNode;
  /** A second muted line under the label. */
  description?: ReactNode;
  /** Red text, for leaving or deleting. */
  danger?: boolean;
  /** Replaces the trailing chevron (a switch, say). */
  trailing?: ReactNode;
  /** Taller row, for a row with a picture. */
  tall?: boolean;
  /** No trailing chevron: a plain text row such as Sign out. */
  plain?: boolean;
  disabled?: boolean;
  /** Opens an address outside the app in a new tab. */
  external?: boolean;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never } | { href?: never; onClick?: never });

/**
 * One list row: optional icon, label, optional current value, trailing chevron when it goes somewhere. 48 px tall at least.
 * A `href` makes it a link, an `onClick` a button; with neither it is a plain row.
 */
export function SettingsRow({ label, icon, value, description, danger, trailing, tall, plain, disabled, external, href, onClick }: RowProps) {
  const inner = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {description ? <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">{description}</span> : null}
      </span>
      {value !== undefined && value !== null ? <span className="max-w-[45%] shrink-0 truncate text-sm font-normal text-zinc-600 dark:text-zinc-400">{value}</span> : null}
      {trailing ?? ((href || onClick) && !plain ? external ? <ExternalMark /> : <RowChevron /> : null)}
    </>
  );
  const cls = `press-row flex w-full items-center gap-3 px-4 py-2 text-left text-base ${tall ? "min-h-20" : "min-h-14"} ${danger ? "text-red-700 dark:text-red-400" : ""}`;
  if (href && external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {inner}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>
    );
  }
  if (href) {
    return (
      <li>
        <Link href={href} className={cls}>
          {inner}
        </Link>
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} disabled={disabled} className={`${cls} disabled:opacity-60`}>
          {inner}
        </button>
      </li>
    );
  }
  return <li className={`flex items-center gap-3 px-4 py-2 text-base ${tall ? "min-h-20" : "min-h-14"}`}>{inner}</li>;
}

/** Up to two capital letters for a picture-less avatar: the first letters of the first two words. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}

/** A round profile picture, or the member's initials on the brand tint. `src` is a signed link or a local preview. */
export function ProfileAvatar({ src, name, size }: { src: string | null; name: string; size: "md" | "lg" }) {
  const box = size === "lg" ? "h-24 w-24 text-3xl" : "h-14 w-14 text-xl";
  return src ? (
    // Signed, short-lived link or a local preview; next/image would route private pictures through the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <div aria-hidden className={`${box} flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-semibold text-brand-text`}>
      {initials(name)}
    </div>
  );
}
