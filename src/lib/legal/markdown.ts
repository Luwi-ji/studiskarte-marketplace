/**
 * A small Markdown reader for the legal pages: headings (# to ###), paragraphs,
 * bullet and numbered lists, **bold**, *italic* and [text](https://link) links.
 * Everything else is plain text, and nothing is ever treated as HTML, so owner-supplied
 * text cannot inject markup. Only http, https and mailto links are kept.
 */
export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "italic"; text: string } | { kind: "link"; text: string; href: string };
export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

const TOKEN = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) out.push({ kind: "text", text: source.slice(last, match.index) });
    if (match[1] !== undefined) out.push({ kind: "bold", text: match[1] });
    else if (match[2] !== undefined) out.push({ kind: "italic", text: match[2] });
    else if (SAFE_LINK.test(match[4])) out.push({ kind: "link", text: match[3], href: match[4] });
    else out.push({ kind: "text", text: match[3] });
    last = match.index + match[0].length;
  }
  if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ...list });
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (line === "") {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, inlines: parseInline(heading[2]) });
    } else if (bullet || numbered) {
      flushParagraph();
      const ordered = numbered !== null;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
