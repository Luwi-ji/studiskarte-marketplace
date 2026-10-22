"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

/**
 * The search field of the Search page's header. Searching keeps the current tab and starts with no filters.
 * With no query yet it takes focus on arrival so the keyboard is already up.
 */
// What was typed before the page finished loading: the loading placeholder and the real page each draw this field, so
// the text is carried from one to the other instead of being lost when the first is replaced.
let draft = "";

export function SearchBox({ initial, tab }: { initial: string; tab: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial || draft);
  const change = (value: string) => {
    draft = value;
    setText(value);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    draft = "";
    const q = text.replace(/\s+/g, " ").trim();
    // Replace, so every search does not add a step for Back (Back leaves Search for the feed).
    router.replace(q ? `/search?${new URLSearchParams({ q, tab })}` : "/search");
  }

  return (
    <form onSubmit={submit} role="search" className="flex h-11 min-w-0 flex-1 items-center rounded-lg bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
      <button type="submit" aria-label="Search" className="flex h-11 w-10 shrink-0 items-center justify-center pl-1 text-zinc-500 active:opacity-80">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </button>
      <input
        ref={input}
        type="search"
        name="q"
        value={text}
        onChange={(e) => change(e.target.value)}
        autoFocus={initial === ""}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="none"
        maxLength={100}
        placeholder="Search"
        aria-label="Search"
        className="h-11 min-w-0 flex-1 appearance-none bg-transparent text-base outline-none placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {text !== "" ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            change("");
            input.current?.focus();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500 active:opacity-80"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </form>
  );
}
