import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLegal, needsTerms } from "@/lib/legal/documents";

const dirs: string[] = [];
function legalDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "legal-"));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(dir, name), body);
  return dir;
}
const complete = { VERSION: "2026-11-01\n", "terms.md": "# Terms", "privacy.md": "# Privacy", "guidelines.md": "# Guidelines" };

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loading the legal documents", () => {
  it("reads the version and all three documents", () => {
    expect(loadLegal(legalDir(complete))).toEqual({ version: "2026-11-01", text: { terms: "# Terms", privacy: "# Privacy", guidelines: "# Guidelines" } });
  });

  it("is absent unless everything is there, so nobody is asked to accept text that does not exist", () => {
    expect(loadLegal(path.join(tmpdir(), "no-such-legal-dir"))).toBeNull();
    for (const missing of Object.keys(complete)) {
      expect(loadLegal(legalDir(Object.fromEntries(Object.entries(complete).filter(([name]) => name !== missing))))).toBeNull();
    }
    expect(loadLegal(legalDir({ ...complete, "privacy.md": "  \n" }))).toBeNull();
    expect(loadLegal(legalDir({ ...complete, VERSION: "two words" }))).toBeNull();
  });
});

describe("who has to accept", () => {
  it("asks when there is a current version the student has not accepted, and never when there is none", () => {
    expect(needsTerms(null, "v2")).toBe(true);
    expect(needsTerms("v1", "v2")).toBe(true);
    expect(needsTerms("v2", "v2")).toBe(false);
    expect(needsTerms(null, null)).toBe(false);
    expect(needsTerms("v1", null)).toBe(false);
  });
});
