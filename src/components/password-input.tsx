"use client";

import { useState, type InputHTMLAttributes } from "react";

const FIELD =
  "w-full rounded-lg border border-zinc-300 bg-white py-3 pl-3 pr-16 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** A password field with a Show / Hide button, so people can check what they typed (a phone keyboard makes typos easy). */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={FIELD} />
      <button
        type="button"
        onClick={() => setShown((was) => !was)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        className="press absolute right-1 top-1/2 flex h-11 min-w-14 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-sm font-semibold text-brand-text"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
