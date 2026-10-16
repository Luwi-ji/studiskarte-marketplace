"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/** The search field. Searching keeps the current tab and starts with no filters. */
export function SearchBox({ initial, tab }: { initial: string; tab: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.replace(/\s+/g, " ").trim();
    router.push(q ? `/search?${new URLSearchParams({ q, tab })}` : "/search");
  }

  return (
    <form onSubmit={submit} role="search" className="flex gap-2">
      <input
        type="search"
        name="q"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus={initial === ""}
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="none"
        maxLength={100}
        placeholder="Search posts, people, schools"
        aria-label="Search"
        className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button type="submit" className="h-11 rounded-lg bg-brand px-4 font-medium text-white">
        Search
      </button>
    </form>
  );
}
