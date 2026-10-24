import { SettingsRow, SettingsSection } from "@/components/settings-list";
import { HELP_PATHS, SUPPORT_EMAIL } from "@/lib/support/config";
import { FAQ_TOPICS, type Faq } from "./faq-content";

/** The mark at the end of a question; turns down when the answer is open (CSS only, no script). */
function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 fill-none stroke-zinc-400 transition-transform duration-150 group-[[open]]:rotate-90 motion-reduce:transition-none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** One question: a native details element, so it opens and closes with no script and works with a keyboard and a screen reader. */
function Question({ item }: { item: Faq }) {
  return (
    <li className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">{item.q}</span>
          <Chevron />
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4 text-sm text-zinc-700 dark:text-zinc-300">
          {item.text.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {item.list ? (
            <ul className="list-disc space-y-1 pl-5">
              {item.list.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/** The questions grouped by topic, then the ways to reach us. */
export function FaqList() {
  return (
    <>
      {FAQ_TOPICS.map((topic) => (
        <SettingsSection key={topic.id} label={topic.title}>
          {topic.items.map((item) => (
            <Question key={item.q} item={item} />
          ))}
        </SettingsSection>
      ))}
      <SettingsSection label="Contact" note={<>For a child safety concern by email, write to {SUPPORT_EMAIL} with the subject URGENT - CHILD SAFETY. If a child is in danger now, call 911.</>}>
        <SettingsRow href={HELP_PATHS.contact} label="Contact us" description="Write to the Studiskarte team." />
        <SettingsRow href={HELP_PATHS.bug} label="Report a bug" description="Something is not working." />
        <SettingsRow href={HELP_PATHS.feedback} label="Send feedback" description="Suggestions, compliments and ideas." />
      </SettingsSection>
    </>
  );
}
