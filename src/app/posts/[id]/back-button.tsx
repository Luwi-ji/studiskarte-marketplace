"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/** The Navigation API is not in every TypeScript DOM lib; `canGoBack` only counts entries of this site. */
type NavigationLike = { canGoBack: boolean };

/** Back to the page the student came from; a link to `href` when there is nowhere to go back to (a shared link). Dark round look for a photo. */
export function BackButton({ href }: { href: string }) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    if (!(navigation ? navigation.canGoBack : window.history.length > 1)) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link href={href} onClick={goBack} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:bg-black/60">
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </Link>
  );
}
