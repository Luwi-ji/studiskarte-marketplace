import { describe, expect, it } from "vitest";
import { buildCalendar, HANDOVER_MINUTES, type CalendarEvent } from "@/lib/calendar/ics";

const now = new Date("2030-01-01T00:00:00Z");
const event = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: "deal-1@studiskarte",
  start: new Date("2030-01-07T01:30:00Z"),
  minutes: HANDOVER_MINUTES,
  summary: "Handover: Calculus book",
  location: "Library steps",
  description: "Meet-up. Open the conversation: https://example.test/messages/abc",
  updatedAt: new Date("2030-01-02T00:00:00Z"),
  ...extra,
});
const calendar = (events: CalendarEvent[]) => buildCalendar({ name: "Studiskarte handovers", events, now });
const octets = (line: string) => new TextEncoder().encode(line).length;
/** RFC 5545 unfolding: a CRLF followed by one space is removed. */
const unfold = (text: string) => text.replace(/\r\n /g, "");

describe("the calendar text", () => {
  it("ends every line with CRLF and never uses a bare LF", () => {
    const text = calendar([event({ description: "line one\nline two\r\nline three" })]);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("keeps every physical line within 75 octets and folds without splitting a character", () => {
    const summary = `Handover: ${"Magandang umaga po, kumusta kayo? 🙂📚 ".repeat(8)}`;
    const text = calendar([event({ summary })]);
    const lines = text.split("\r\n");
    expect(lines.some((l) => l.startsWith(" "))).toBe(true);
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75);
    // Folding then unfolding gives back the escaped summary, whole characters only.
    const unfolded = unfold(text);
    expect(unfolded).toContain(`SUMMARY:${summary.replace(/,/g, "\\,")}`);
    expect(unfolded).not.toContain("\uFFFD");
  });

  it("escapes backslash, semicolon, comma and newlines", () => {
    const text = unfold(calendar([event({ summary: "a,b;c\\d", location: "x\ny\r\nz\rw" })]));
    expect(text).toContain("SUMMARY:a\\,b\\;c\\\\d\r\n");
    expect(text).toContain("LOCATION:x\\ny\\nz\\nw\r\n");
  });

  it("writes the start in UTC and the end an hour later", () => {
    const text = calendar([event()]);
    expect(text).toContain("DTSTART:20300107T013000Z\r\n");
    expect(text).toContain("DTEND:20300107T023000Z\r\n");
    expect(text).toContain("DTSTAMP:20300101T000000Z\r\n");
    expect(text).toContain("UID:deal-1@studiskarte\r\n");
  });

  it("is still a valid calendar with no events", () => {
    const text = calendar([]);
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(text).not.toContain("VEVENT");
  });

  it("raises SEQUENCE when the deal changed later", () => {
    const sequence = (updatedAt: string) => Number(/SEQUENCE:(\d+)/.exec(calendar([event({ updatedAt: new Date(updatedAt) })]))?.[1]);
    expect(sequence("2030-01-02T00:00:05Z")).toBeGreaterThan(sequence("2030-01-02T00:00:00Z"));
  });
});
