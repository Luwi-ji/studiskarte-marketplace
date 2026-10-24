"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readTheme, THEME_EVENT, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: "system", label: "System", hint: "Match your phone's light or dark setting." },
  { value: "light", label: "Light", hint: "Always use the light look." },
  { value: "dark", label: "Dark", hint: "Always use the dark look." },
];

const LABEL: Record<ThemeChoice, string> = { system: "System", light: "Light", dark: "Dark" };

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readTheme, () => "system");
}

/** The current choice for the Settings row. */
export function AppearanceRowValue() {
  return <>{LABEL[useThemeChoice()]}</>;
}

/** Three radio rows (System, Light, Dark) with a small live preview. The page changes the moment one is chosen. */
export function AppearanceSettings() {
  const choice = useThemeChoice();

  // While on System, follow the phone if its setting changes.
  useEffect(() => {
    if (choice !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="sr-only">Appearance</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="press-row flex min-h-14 cursor-pointer items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <input type="radio" name="appearance" value={option.value} checked={choice === option.value} onChange={() => applyTheme(option.value)} className="h-5 w-5 shrink-0" />
            <span className="flex flex-col">
              <span className="text-base font-medium">{option.label}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="px-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold">Preview</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">This is how cards and text look with your choice.</p>
          <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white">Button</span>
        </div>
      </div>
    </div>
  );
}
