import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const LEGAL_SLUGS = ["terms", "privacy", "guidelines", "child-safety"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_TITLES: Record<LegalSlug, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  guidelines: "Community Guidelines",
  "child-safety": "Child Safety Standards",
};

/** The owner's legal text: content/legal/{terms,privacy,guidelines,child-safety}.md and content/legal/VERSION. */
export type LegalSet = { version: string; text: Record<LegalSlug, string> };

const DEFAULT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "content", "legal");

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

/**
 * Reads the legal documents from `dir`. Returns null unless VERSION and all
 * documents exist and are not empty: until the owner supplies the text, there is
 * nothing to show and nobody is asked to accept anything. The version is whatever
 * VERSION holds (for example a date); change it when the terms or privacy policy
 * change and every student is asked to accept again.
 */
export function loadLegal(dir: string = DEFAULT_DIR): LegalSet | null {
  const read = (file: string): string | null => {
    // The directory is chosen at run time (tests use another one); the bundler must not trace the project for it.
    const full = path.join(/* turbopackIgnore: true */ dir, file);
    if (!existsSync(/* turbopackIgnore: true */ full)) return null;
    const text = readFileSync(/* turbopackIgnore: true */ full, "utf8").trim();
    return text === "" ? null : text;
  };
  const version = read("VERSION");
  if (version === null || version.length > 40 || /\s/.test(version)) return null;
  const text = {} as Record<LegalSlug, string>;
  for (const slug of LEGAL_SLUGS) {
    const body = read(`${slug}.md`);
    if (body === null) return null;
    text[slug] = body;
  }
  return { version, text };
}

let cached: LegalSet | null | undefined;

/** The legal documents of this deployment. The files only change with a deployment, so production reads them once. */
export function currentLegal(): LegalSet | null {
  if (process.env.NODE_ENV !== "production") return loadLegal();
  if (cached === undefined) cached = loadLegal();
  return cached;
}

/** Whether a student must accept the terms (again): there is a current version and they have not accepted it. */
export function needsTerms(acceptedVersion: string | null, currentVersion: string | null): boolean {
  return currentVersion !== null && acceptedVersion !== currentVersion;
}
