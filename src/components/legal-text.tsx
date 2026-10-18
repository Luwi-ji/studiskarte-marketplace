import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/legal/markdown";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return inlines.map((part, index) => {
    if (part.kind === "bold") return <strong key={index}>{part.text}</strong>;
    if (part.kind === "italic") return <em key={index}>{part.text}</em>;
    if (part.kind === "link") {
      return (
        <a key={index} href={part.href} className="underline" rel="noopener noreferrer">
          {part.text}
        </a>
      );
    }
    return <Fragment key={index}>{part.text}</Fragment>;
  });
}

/** Renders the owner's legal text. */
export function LegalText({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-3 text-zinc-800 dark:text-zinc-200">
      {parseMarkdown(source).map((block, index) => {
        if (block.kind === "heading") {
          const size = block.level === 1 ? "text-xl" : block.level === 2 ? "text-lg" : "text-base";
          return (
            <p key={index} role="heading" aria-level={block.level} className={`${size} mt-2 font-semibold`}>
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
