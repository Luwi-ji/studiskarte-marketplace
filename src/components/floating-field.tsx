"use client";

import { useId, useRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "className"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown before the text, e.g. "@". */
  prefix?: string;
  error?: string | null;
  helper?: string;
};

/**
 * One text field with its label floating above the text once there is any, a clear (x) button, and helper or
 * error text under it. The clear button is a 44 px target; the field is 56 px tall.
 */
export function FloatingField({ label, value, onChange, prefix, error, helper, disabled, ...rest }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      <div className={`relative flex h-14 items-center rounded-lg border bg-transparent focus-within:border-brand ${error ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"} ${disabled ? "opacity-60" : ""}`}>
        {prefix ? <span aria-hidden className="pl-3 pt-4 text-base text-zinc-500">{prefix}</span> : null}
        <input
          {...rest}
          ref={input}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-note`}
          className={`peer h-full min-w-0 flex-1 bg-transparent pb-1 pt-5 text-base outline-none ${prefix ? "pl-0.5" : "pl-3"} pr-11`}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute top-2 text-xs text-zinc-600 transition-all duration-150 ease-out peer-placeholder-shown:top-[1.125rem] peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs motion-reduce:transition-none dark:text-zinc-400 ${prefix ? "left-3 peer-placeholder-shown:left-7 peer-focus:left-3" : "left-3"}`}
        >
          {label}
        </label>
        {value && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
            className="press absolute right-0 flex h-11 w-11 items-center justify-center text-zinc-500"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="9" className="fill-zinc-200 stroke-none dark:fill-zinc-700" />
              <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
      <div id={`${id}-note`}>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : helper ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{helper}</p>
        ) : null}
      </div>
    </div>
  );
}
