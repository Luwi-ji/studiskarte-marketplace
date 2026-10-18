import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@/lib/legal/markdown";

describe("legal text", () => {
  it("reads headings, paragraphs, lists and emphasis", () => {
    const blocks = parseMarkdown("# Title\n\nFirst line\ncontinues here with **bold** and *slant*.\n\n- one\n- two\n\n1. first\n2) second\n");
    expect(blocks).toEqual([
      { kind: "heading", level: 1, inlines: [{ kind: "text", text: "Title" }] },
      {
        kind: "paragraph",
        inlines: [
          { kind: "text", text: "First line continues here with " },
          { kind: "bold", text: "bold" },
          { kind: "text", text: " and " },
          { kind: "italic", text: "slant" },
          { kind: "text", text: "." },
        ],
      },
      { kind: "list", ordered: false, items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]] },
      { kind: "list", ordered: true, items: [[{ kind: "text", text: "first" }], [{ kind: "text", text: "second" }]] },
    ]);
  });

  it("keeps only web and mail links, and never treats text as HTML", () => {
    const [paragraph] = parseMarkdown("[ok](https://example.com) [mail](mailto:a@b.ph) [bad](javascript:alert(1)) <script>x</script>");
    expect(paragraph).toMatchObject({ kind: "paragraph" });
    const inlines = paragraph.kind === "paragraph" ? paragraph.inlines : [];
    expect(inlines.filter((i) => i.kind === "link").map((i) => (i.kind === "link" ? i.href : ""))).toEqual(["https://example.com", "mailto:a@b.ph"]);
    expect(JSON.stringify(inlines)).not.toContain("javascript:");
    expect(inlines.some((i) => i.kind === "text" && i.text.includes("<script>x</script>"))).toBe(true);
  });
});
