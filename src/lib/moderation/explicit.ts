import { BLOCKED_PHRASES, BLOCKED_STEMS, BLOCKED_WORDS } from "@/lib/moderation/blocked-words";

export type BlockedMatch = {
  /** The word as written, hidden behind asterisks so it can be shown back: "p***". */
  masked: string;
};

// Invisible characters put inside a word to get past a filter.
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
// What ends a word. Digits and * @ $ # ! stay inside it: they stand in for letters (sh1t, f*ck, @ss, b!tch).
const SEPARATORS = /[\s.,;:?()[\]{}"“”‘’'`´/\\_\-–—…|~<>=^&%+]+/u;
const LEET: Record<string, string> = { "@": "a", $: "s", "!": "i", "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };
const VOWELS = ["a", "e", "i", "o", "u"];
const MAX_CANDIDATES = 40;

function fold(token: string): string {
  return token.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function collapse(word: string, keep: 1 | 2): string {
  return word.replace(/(.)\1{2,}/g, (_, ch: string) => ch.repeat(keep));
}

/** Every plain-letter spelling a written token could stand for. */
function spellings(token: string): string[] {
  // A ! at either end is punctuation (gago!), inside a word it is an i.
  const base = fold(token).replace(/^!+|!+$/g, "");
  if (!/\p{L}/u.test(base)) return [];
  // * and # stand for one letter, usually a vowel: f*ck, sh#t.
  let forms = [base];
  for (let i = 0; i < 2; i++) {
    forms = forms.flatMap((form) => {
      const at = form.search(/[*#]/);
      return at === -1 ? [form] : VOWELS.map((v) => form.slice(0, at) + v + form.slice(at + 1));
    });
  }
  const out = new Set<string>();
  for (const form of forms) {
    if (/[*#]/.test(form)) continue;
    // 1 is an i or an l.
    for (const one of ["i", "l"]) {
      const letters = form.replace(/[@$!013457]/g, (c) => (c === "1" ? one : LEET[c])).replace(/[^\p{L}]/gu, "");
      if (letters.length < 2) continue;
      // Stretched words: puuuuta, fuuuck.
      for (const spelling of [letters, collapse(letters, 2), collapse(letters, 1)]) out.add(spelling);
      if (out.size >= MAX_CANDIDATES) return [...out];
    }
  }
  return [...out];
}

function isBlocked(word: string): boolean {
  return BLOCKED_WORDS.has(word) || BLOCKED_STEMS.some((stem) => word.startsWith(stem));
}

function mask(raw: string): string {
  const letters = [...raw];
  return `${letters[0]}${"*".repeat(Math.min(Math.max(letters.length - 1, 1), 5))}`;
}

/**
 * The first blocked word or phrase in `text`, or null. Whole words only, so ordinary words that merely contain a bad
 * one (class, assistant, Scunthorpe) pass. Sees through capitals, accents, invisible characters, numbers and symbols for
 * letters (sh1t, @sshole, f*ck), stretched letters (puuuta) and letters spaced apart (p u t a, p.u.t.a).
 */
export function findBlocked(text: string): BlockedMatch | null {
  const raw = text.normalize("NFKC").replace(INVISIBLE, "").split(SEPARATORS).filter((t) => t.length > 0);

  const words: string[] = [];
  for (const token of raw) {
    const forms = spellings(token);
    words.push(forms[0] ?? "");
    if (forms.some(isBlocked)) return { masked: mask(token) };
  }

  // Single letters one after the other, p u t a: read them as one word.
  for (let i = 0; i < raw.length; i++) {
    let j = i;
    while (j < raw.length && [...raw[j]].length === 1) j++;
    if (j - i >= 3) {
      const joined = raw.slice(i, j).join("");
      if (spellings(joined).some(isBlocked)) return { masked: mask(raw[i]) };
    }
    i = Math.max(i, j - 1);
  }

  for (const phrase of BLOCKED_PHRASES) {
    for (let i = 0; i + phrase.length <= words.length; i++) {
      if (phrase.every((word, k) => words[i + k] === word)) return { masked: mask(raw[i]) };
    }
  }
  return null;
}
