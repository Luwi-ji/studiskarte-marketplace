import { describe, expect, it } from "vitest";
import {
  afterNever,
  afterReviewOpened,
  afterShown,
  parseReviewState,
  REVIEW_COOLDOWN_MS,
  REVIEW_MOMENT_MAX_AGE_MS,
  REVIEW_QUIET_MS,
  shouldPrompt,
} from "./review-prompt";

const NOW = 1_800_000_000_000;

describe("shouldPrompt", () => {
  it("asks a new device about a moment, once", () => {
    expect(shouldPrompt({}, "posted:a", NOW)).toBe(true);
    const shown = afterShown({}, "posted:a", NOW);
    expect(shouldPrompt(shown, "posted:a", NOW + REVIEW_COOLDOWN_MS + 1)).toBe(false);
    expect(shouldPrompt(shown, "posted:b", NOW + REVIEW_COOLDOWN_MS + 1)).toBe(true);
  });

  it("waits out the cooldown after a prompt, to the millisecond", () => {
    const shown = afterShown({}, "posted:a", NOW);
    expect(shouldPrompt(shown, "posted:b", NOW + REVIEW_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldPrompt(shown, "posted:b", NOW + REVIEW_COOLDOWN_MS)).toBe(true);
  });

  it("stays quiet for good after Don't ask again, and for 90 days after the review page was opened", () => {
    expect(shouldPrompt(afterNever({}), "posted:a", NOW + 10 * REVIEW_QUIET_MS)).toBe(false);
    const opened = afterReviewOpened({}, NOW);
    expect(shouldPrompt(opened, "posted:a", NOW + REVIEW_QUIET_MS - 1)).toBe(false);
    expect(shouldPrompt(opened, "posted:a", NOW + REVIEW_QUIET_MS)).toBe(true);
  });

  it("ignores a completed deal that is more than 48 hours old, or has no readable time", () => {
    expect(shouldPrompt({}, "deal:a", NOW, NOW - REVIEW_MOMENT_MAX_AGE_MS)).toBe(true);
    expect(shouldPrompt({}, "deal:a", NOW, NOW - REVIEW_MOMENT_MAX_AGE_MS - 1)).toBe(false);
    expect(shouldPrompt({}, "deal:a", NOW, Number.NaN)).toBe(false);
  });
});

describe("parseReviewState", () => {
  it("reads what it wrote and gives an empty state for anything else", () => {
    const state = afterNever(afterShown({}, "posted:a", NOW));
    expect(parseReviewState(JSON.stringify(state))).toEqual(state);
    for (const bad of [null, "", "not json", "[]", "7", '{"lastShownAt":"yesterday","never":"yes","seen":[1,"a"]}']) {
      const parsed = parseReviewState(bad);
      expect(parsed.never).toBeUndefined();
      expect(parsed.lastShownAt).toBeUndefined();
    }
    expect(parseReviewState('{"seen":[1,"a"]}')).toEqual({ seen: ["a"] });
  });

  it("keeps only the newest moments", () => {
    let state = {};
    for (let i = 0; i < 40; i++) state = afterShown(state, `m:${i}`, NOW);
    const seen = parseReviewState(JSON.stringify(state)).seen ?? [];
    expect(seen).toHaveLength(30);
    expect(seen.at(-1)).toBe("m:39");
  });
});
