"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { reminderContextAction } from "@/app/reminders/actions";
import { reminderFor, type Reminder, type ReminderContext, type ReminderTrigger } from "@/lib/reminders/rules";

const EVENT = "sk:reminder";
const ICONS: Record<Reminder["icon"], string> = {
  school: "M3 9l9-5 9 5-9 5-9-5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5",
  shield: "M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-4.5",
  grid: "M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
};

// What was read a moment ago is reused, so a second tap does not wait for the server again.
let cached: { at: number; ctx: ReminderContext | null } | null = null;
const FRESH_MS = 20_000;

async function readContext(): Promise<ReminderContext | null> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.ctx;
  const ctx = await reminderContextAction();
  cached = { at: Date.now(), ctx };
  return ctx;
}

/**
 * Asks whether this action needs a reminder first. If so, the reminder sheet opens and this resolves true: the caller
 * should stop. If not (or the check could not be made), it resolves false and the action goes ahead; the server still
 * refuses what it must, so a failed check never lets anything through.
 */
export async function remind(trigger: ReminderTrigger): Promise<boolean> {
  try {
    const ctx = await readContext();
    if (!ctx) return false;
    const reminder = reminderFor(trigger, ctx);
    if (!reminder) return false;
    window.dispatchEvent(new CustomEvent<Reminder>(EVENT, { detail: reminder }));
    return true;
  } catch {
    return false;
  }
}

/** Forget what was read, after something changed (a post was made, an ID check began). */
export function forgetReminderContext() {
  cached = null;
}

/** The sheet itself: mounted once for the whole app. */
export function ReminderHost() {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onReminder = (event: Event) => {
      setReminder((event as CustomEvent<Reminder>).detail);
      setOpen(true);
    };
    window.addEventListener(EVENT, onReminder);
    return () => window.removeEventListener(EVENT, onReminder);
  }, []);

  if (!reminder) return null;
  return (
    <BottomSheet open={open} onOpenChange={setOpen} label={reminder.title}>
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-text">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={ICONS[reminder.icon]} />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold tracking-tight">{reminder.title}</h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400">{reminder.body}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href={reminder.primary.href} onClick={() => setOpen(false)} className="press flex h-12 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">
            {reminder.primary.label}
          </Link>
          {reminder.secondary ? (
            <Link href={reminder.secondary.href} onClick={() => setOpen(false)} className="press flex h-12 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold dark:border-zinc-700">
              {reminder.secondary.label}
            </Link>
          ) : null}
          <button type="button" onClick={() => setOpen(false)} className="press flex h-11 items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-400">
            Not now
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** A link that first checks whether a reminder is due: if so the sheet opens and the link is not followed. */
export function RemindLink({ trigger, href, children, onChoose, ...rest }: { trigger: ReminderTrigger; href: string; children: ReactNode; onChoose?: () => void } & Omit<ComponentProps<typeof Link>, "href" | "onClick">) {
  const router = useRouter();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
        event.preventDefault();
        onChoose?.();
        void remind(trigger).then((shown) => {
          if (!shown) router.push(href);
        });
      }}
    >
      {children}
    </Link>
  );
}

/** A button that only opens the reminder for this action (for someone who is certain to be stopped). */
export function RemindButton({ trigger, children, className, onChoose }: { trigger: ReminderTrigger; children: ReactNode; className: string; onChoose?: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        onChoose?.();
        void remind(trigger);
      }}
      className={className}
    >
      {children}
    </button>
  );
}

/** Opens the reminder when a page that is already blocked is reached directly (a link, a reload). */
export function RemindOnMount({ trigger }: { trigger: ReminderTrigger }) {
  useEffect(() => {
    void remind(trigger);
  }, [trigger]);
  return null;
}
