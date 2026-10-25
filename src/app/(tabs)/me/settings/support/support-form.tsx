"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useAction } from "@/app/safety/use-action";
import { haptic } from "@/lib/haptics";
import { emptyValues, SUPPORT_FORMS, type SupportField, type SupportKind } from "@/lib/support/send";
import { sendSupportAction } from "./actions";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const buttonClass = "press flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-base font-medium text-white disabled:opacity-60";
const secondaryClass = "press flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 px-4 text-base font-medium dark:border-zinc-700";

/** The counter shows once someone is close to the limit, so a short message is not nagged. */
const COUNTER_FROM = 0.8;

/**
 * One form for all three Help and support messages, driven by the kind's definition in `lib/support/send.ts`.
 * Typed answers stay in the fields after an error; a sent message shows a short confirmation with a way back.
 */
export function SupportForm({ kind }: { kind: SupportKind }) {
  const form = SUPPORT_FORMS[kind];
  const id = useId();
  const step = useAction();
  const [values, setValues] = useState(() => emptyValues(kind));
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.busy) return;
    void step.run(
      () => sendSupportAction(kind, values),
      () => {
        haptic("success");
        setSent(true);
      },
      false,
    );
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="text-base">Sent. We read these and reply to your account email when a reply is needed.</p>
        <div className="flex w-full flex-col gap-2">
          <Link href="/me/settings" className={buttonClass}>
            Back to Settings
          </Link>
          <button
            type="button"
            className={secondaryClass}
            onClick={() => {
              setValues(emptyValues(kind));
              setSent(false);
            }}
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  function control(field: SupportField) {
    const fieldId = `${id}-${field.name}`;
    const value = values[field.name] ?? "";
    const onChange = (next: string) => setValues((current) => ({ ...current, [field.name]: next }));
    if (field.type === "select") {
      return (
        <select id={fieldId} name={field.name} value={value} onChange={(event) => onChange(event.target.value)} disabled={step.busy} className={fieldClass}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    const common = {
      id: fieldId,
      name: field.name,
      value,
      maxLength: field.max,
      placeholder: field.placeholder,
      readOnly: step.busy,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      className: fieldClass,
    };
    return field.type === "textarea" ? <textarea {...common} rows={field.max > 1000 ? 6 : 4} /> : <input {...common} type="text" autoComplete="off" />;
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{form.intro}</p>
      {form.fields.map((field) => {
        const length = (values[field.name] ?? "").length;
        const nearLimit = field.type !== "select" && length >= field.max * COUNTER_FROM;
        return (
          <div key={field.name} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${id}-${field.name}`} className="text-sm font-medium">
                {field.label}
              </label>
              {nearLimit ? (
                <span className={`shrink-0 text-xs tabular-nums ${length >= field.max ? "text-red-600" : "text-zinc-500"}`}>
                  {length} / {field.max}
                </span>
              ) : null}
            </div>
            {control(field)}
          </div>
        );
      })}
      <p className="text-xs text-zinc-500">Your account email is sent with this message so we can reply. Other students never see it.</p>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      <button type="submit" disabled={step.busy} className={buttonClass}>
        {step.busy ? "Sending…" : form.submit}
      </button>
    </form>
  );
}
