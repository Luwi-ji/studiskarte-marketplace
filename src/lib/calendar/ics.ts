export type CalendarEvent = {
  /** Stable id of the thing: "deal-<dealId>@studiskarte". */
  uid: string;
  start: Date;
  /** Minutes the event lasts. */
  minutes: number;
  summary: string;
  location: string;
  description: string;
  /** Last change; becomes LAST-MODIFIED and SEQUENCE so a calendar app takes the newest. */
  updatedAt: Date;
};

/** The app stores no end time, so a handover is shown as one hour. */
export const HANDOVER_MINUTES = 60;

const MAX_OCTETS = 75;
const encoder = new TextEncoder();

/** Escapes a TEXT value (RFC 5545 3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** "20300107T013000Z" */
function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Splits a line so no physical line exceeds 75 octets; continuations start with one space. */
function fold(line: string): string[] {
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const width = encoder.encode(char).length;
    if (size + width > MAX_OCTETS) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += width;
  }
  lines.push(current);
  return lines;
}

export function buildCalendar(args: { name: string; events: CalendarEvent[]; now?: Date }): string {
  const now = args.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studiskarte Marketplace//Handovers//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(args.name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of args.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(new Date(e.start.getTime() + e.minutes * 60_000))}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `LOCATION:${escapeText(e.location)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `LAST-MODIFIED:${utc(e.updatedAt)}`,
      `SEQUENCE:${Math.floor(e.updatedAt.getTime() / 1000)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.flatMap(fold).join("\r\n") + "\r\n";
}
