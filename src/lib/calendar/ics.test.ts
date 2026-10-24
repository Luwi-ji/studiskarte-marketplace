import { describe, expect, it } from "vitest";
import { buildCalendar, CALENDAR_NAME, EVENT_FILE_HEADERS, HANDOVER_MINUTES, type CalendarEvent } from "@/lib/calendar/ics";

const now = new Date("2030-01-01T00:00:00Z");
const event = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: "deal-1@studiskarte",
  start: new Date("2030-01-07T01:30:00Z"),
  minutes: HANDOVER_MINUTES,
  summary: "Studiskarte: Calculus book",
  location: "Library steps",
  description: "Meet-up. Open the conversation: https://example.test/messages/abc",
  status: "confirmed",
  updatedAt: new Date("2030-01-02T00:00:00Z"),
  ...extra,
});
const calendar = (events: CalendarEvent[]) => buildCalendar({ name: CALENDAR_NAME, events, now });
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
    const summary = `Studiskarte: ${"Magandang umaga po, kumusta kayo? 🙂📚 ".repeat(8)}`;
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

  it("names the calendar Studiskarte transactions", () => {
    expect(calendar([])).toContain("X-WR-CALNAME:Studiskarte transactions\r\n");
  });

  it("writes a cancelled event with the same UID, STATUS:CANCELLED and a higher SEQUENCE than the confirmed one", () => {
    const sequence = (text: string) => Number(/SEQUENCE:(\d+)/.exec(text)?.[1]);
    const confirmed = calendar([event()]);
    // Even with the very same update time (a cancel that did not move it).
    const cancelled = calendar([event({ status: "cancelled" })]);
    expect(confirmed).toContain("STATUS:CONFIRMED\r\n");
    expect(cancelled).toContain("STATUS:CANCELLED\r\n");
    expect(cancelled).not.toContain("STATUS:CONFIRMED");
    expect(cancelled).toContain("UID:deal-1@studiskarte\r\n");
    expect(sequence(cancelled)).toBeGreaterThan(sequence(confirmed));
  });
});

describe("the single-event file opened from the conversation", () => {
  const file = (extra: Partial<CalendarEvent> = {}) => buildCalendar({ name: CALENDAR_NAME, events: [event(extra)], now, once: true });

  it("is one complete event with every property a phone needs to import it", () => {
    const lines = file({ summary: "Studiskarte: Notes, set A; vol. 2", description: "Meet\nthere" }).split("\r\n");
    expect(lines.pop()).toBe(""); // ends with CRLF
    expect(lines.filter((l) => l.includes("\n") || l.includes("\r"))).toEqual([]);
    expect(lines.slice(0, 6)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Studiskarte Marketplace//Handovers//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT"]);
    expect(lines.slice(-2)).toEqual(["END:VEVENT", "END:VCALENDAR"]);
    const unfolded = unfold(lines.join("\r\n"));
    for (const property of ["UID:deal-1@studiskarte", "DTSTAMP:20300101T000000Z", "DTSTART:20300107T013000Z", "DTEND:20300107T023000Z", "SEQUENCE:", "STATUS:CONFIRMED"]) {
      expect(unfolded).toContain(`\r\n${property}`);
    }
    // Text is escaped: comma, semicolon and newline never appear raw in a TEXT value.
    expect(unfolded).toContain("SUMMARY:Studiskarte: Notes\\, set A\\; vol. 2\r\n");
    expect(unfolded).toContain("DESCRIPTION:Meet\\nthere\r\n");
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(unfolded.match(/END:VEVENT/g)).toHaveLength(1);
  });

  it("is not a subscription: no calendar name and no refresh hints", () => {
    const text = file();
    expect(text).not.toContain("X-WR-CALNAME");
    expect(text).not.toContain("REFRESH-INTERVAL");
    expect(text).not.toContain("X-PUBLISHED-TTL");
    expect(calendar([event()])).toContain("X-WR-CALNAME");
  });

  it("keeps the deal's UID and raises SEQUENCE when the deal changed, so a re-import updates the same event", () => {
    const sequence = (text: string) => Number(/SEQUENCE:(\d+)/.exec(text)?.[1]);
    const first = file({ updatedAt: new Date("2030-01-02T00:00:00Z") });
    const later = file({ updatedAt: new Date("2030-01-02T00:05:00Z"), start: new Date("2030-01-08T01:30:00Z") });
    expect(first).toContain("UID:deal-1@studiskarte\r\n");
    expect(later).toContain("UID:deal-1@studiskarte\r\n");
    expect(sequence(later)).toBeGreaterThan(sequence(first));
  });

  it("is served inline as text/calendar so the phone opens its Add to Calendar sheet", () => {
    expect(EVENT_FILE_HEADERS["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(EVENT_FILE_HEADERS["Content-Disposition"]).toMatch(/^inline;/);
    expect(EVENT_FILE_HEADERS["Cache-Control"]).not.toContain("no-store");
  });
});
