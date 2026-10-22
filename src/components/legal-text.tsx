import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/legal/markdown";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b(?!-\w)/g;

/** Text with ISO dates (2026-10-23) shown the way the app writes dates (Oct 23, 2026), and never broken across lines. */
function Text({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(ISO_DATE)) {
    const month = MONTHS[Number(match[2]) - 1];
    if (!month) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span key={match.index} className="whitespace-nowrap">
        {month} {Number(match[3])}, {match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return inlines.map((part, index) => {
    if (part.kind === "bold") return <strong key={index}><Text text={part.text} /></strong>;
    if (part.kind === "italic") return <em key={index}><Text text={part.text} /></em>;
    if (part.kind === "link") {
      return (
        <a key={index} href={part.href} className="underline" rel="noopener noreferrer">
          {part.text}
        </a>
      );
    }
    return <Text key={index} text={part.text} />;
  });
}

type Item = Block | { kind: "callout"; inlines: Inline[] };

const plain = (inlines: Inline[]) => inlines.map((part) => part.text).join("");

/**
 * The first bullet near the top that says to call 911 is pulled out of its list and shown as a
 * callout above the heading it was under, so an emergency number is not the fifth bullet.
 */
function pullOutEmergency(blocks: Block[]): Item[] {
  const listAt = blocks.findIndex((block, index) => index < 10 && block.kind === "list" && block.items.some((item) => /call 911/i.test(plain(item))));
  const list = blocks[listAt];
  if (list?.kind !== "list") return blocks;
  const itemAt = list.items.findIndex((item) => /call 911/i.test(plain(item)));
  const rest = list.items.filter((_, index) => index !== itemAt);
  let before = listAt;
  for (let i = listAt - 1; i >= 0; i--) {
    if (blocks[i].kind === "heading") {
      before = i;
      break;
    }
  }
  const items: Item[] = blocks.map((block, index) => (index === listAt ? { ...list, items: rest } : block));
  items.splice(before, 0, { kind: "callout", inlines: list.items[itemAt] });
  return items;
}

/**
 * Renders the owner's legal text. The page already shows the document's title in its header, so a
 * leading `# Title` is not repeated. Long documents get a collapsed "On this page" list.
 */
export function LegalText({ source }: { source: string }) {
  let blocks = parseMarkdown(source);
  if (blocks[0]?.kind === "heading" && blocks[0].level === 1) blocks = blocks.slice(1);
  const items = pullOutEmergency(blocks);
  const sections = items.flatMap((item, index) => (item.kind === "heading" && item.level === 2 ? [{ index, title: plain(item.inlines) }] : []));

  return (
    <div className="flex flex-col gap-3 break-words text-zinc-800 dark:text-zinc-200">
      {sections.length >= 5 ? (
        <details className="rounded-lg border border-zinc-200 px-3 dark:border-zinc-800">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">On this page</summary>
          <ol className="list-decimal space-y-1 pb-3 pl-6 text-sm">
            {sections.map((section) => (
              <li key={section.index}>
                <a href={`#s${section.index}`} className="inline-flex min-h-11 items-center underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {items.map((block, index) => {
        if (block.kind === "callout") {
          return (
            <p key={index} role="note" className="rounded-xl border-2 border-red-600 bg-red-50 p-4 text-lg text-zinc-900 dark:border-red-500 dark:bg-red-950/40 dark:text-zinc-50">
              <Inlines inlines={block.inlines} />
            </p>
          );
        }
        if (block.kind === "heading") {
          const style = block.level === 1 ? "mt-8 text-2xl" : block.level === 2 ? "mt-8 text-xl" : "mt-4 text-lg";
          return (
            <p key={index} id={`s${index}`} role="heading" aria-level={block.level} className={`${style} scroll-mt-20 font-semibold text-zinc-900 dark:text-zinc-50`}>
              <Inlines inlines={block.inlines} />
            </p>
          );
        }
        if (block.kind === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index} className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}>
              {block.items.map((item, i) => (
                <li key={i}>
                  <Inlines inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={index}>
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
