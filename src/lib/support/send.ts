import { ROLE_LABEL } from "@/lib/identity/roles";

// The Settings > Help and support forms that email the owner (bug report, feedback, contact us).
// Everything here is pure: no database, no mail, so the browser can import the form definitions
// and the tests can run without a network. Sending and the rate limit are in submit.ts.

export const SUPPORT_KINDS = ["bug", "feedback", "contact"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

/** The longest message a student can send, in UTF-16 units (what a textarea's maxLength counts). */
export const MESSAGE_MAX = 2000;
const SUBJECT_MAX = 120;
/** The longest a subject line gets once the prefix and a snippet are put together. */
const HEADER_MAX = 100;

export type SupportField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  max: number;
  placeholder?: string;
  hint?: string;
  /** For a select: the values accepted and what is shown (and written in the email). */
  options?: readonly { value: string; label: string }[];
};

export type SupportForm = {
  title: string;
  intro: string;
  /** The tag at the start of the email subject. */
  tag: string;
  /** What the email calls this kind of message. */
  kindLabel: string;
  submit: string;
  fields: readonly SupportField[];
};

const FEEDBACK_TYPES = [
  { value: "suggestion", label: "Suggestion" },
  { value: "compliment", label: "Compliment" },
  { value: "other", label: "Other" },
] as const;

export const SUPPORT_FORMS: Record<SupportKind, SupportForm> = {
  bug: {
    title: "Report a bug",
    intro: "Something not working? Tell us what you saw so we can fix it.",
    tag: "Bug",
    kindLabel: "Bug report",
    submit: "Send bug report",
    fields: [
      { name: "happened", label: "What happened", type: "textarea", required: true, max: MESSAGE_MAX, placeholder: "What went wrong?" },
      { name: "expected", label: "What did you expect", type: "textarea", required: true, max: 1000, placeholder: "What should have happened?" },
      { name: "steps", label: "Steps to repeat it (optional)", type: "textarea", required: false, max: 1000, placeholder: "1. Open… 2. Tap…" },
      { name: "where", label: "Page or screen (optional)", type: "text", required: false, max: 200, placeholder: "For example: Messages, or a listing's title" },
    ],
  },
  feedback: {
    title: "Send feedback",
    intro: "A suggestion, a compliment, anything on your mind. We read every one.",
    tag: "Feedback",
    kindLabel: "Feedback",
    submit: "Send feedback",
    fields: [
      { name: "type", label: "Type", type: "select", required: true, max: 20, options: FEEDBACK_TYPES },
      { name: "message", label: "Your feedback", type: "textarea", required: true, max: MESSAGE_MAX, placeholder: "What would you like us to know?" },
    ],
  },
  contact: {
    title: "Contact us",
    intro: "A question we did not answer in the FAQ, or anything else you need from us.",
    tag: "Contact",
    kindLabel: "Contact",
    submit: "Send message",
    fields: [
      { name: "subject", label: "Subject", type: "text", required: true, max: SUBJECT_MAX, placeholder: "What is it about?" },
      { name: "message", label: "Message", type: "textarea", required: true, max: MESSAGE_MAX },
    ],
  },
};

export function isSupportKind(value: unknown): value is SupportKind {
  return typeof value === "string" && (SUPPORT_KINDS as readonly string[]).includes(value);
}

/** What each field starts as: empty, or the first choice of a select. */
export function emptyValues(kind: SupportKind): Record<string, string> {
  return Object.fromEntries(SUPPORT_FORMS[kind].fields.map((field) => [field.name, field.options?.[0]?.value ?? ""]));
}

// Control characters (except tab and newline in a body), line and paragraph separators and the
// bidirectional overrides that can make text read in a different order than it is written.
const BODY_STRIP = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const HEADER_STRIP = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Text for the body of a message: line breaks kept, control characters removed, runs of blank lines shortened, trimmed. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(BODY_STRIP, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text for one line of a mail header: no line breaks or control characters at all, so nothing can add a header. */
export function cleanHeader(raw: string, max = HEADER_MAX): string {
  const line = raw.replace(HEADER_STRIP, " ").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

export type SupportValues = Record<string, string>;
export type ParsedSupport = { ok: true; values: SupportValues } | { ok: false; error: string; field?: string };

/** Checks and cleans what the browser sent. The first problem found is returned as a message to show. */
export function parseSupportInput(kind: SupportKind, raw: unknown): ParsedSupport {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const values: SupportValues = {};
  for (const field of SUPPORT_FORMS[kind].fields) {
    const given = input[field.name];
    if (given !== undefined && typeof given !== "string") return { ok: false, error: "Something looks wrong with that form. Reload the page and try again." };
    const text = field.type === "textarea" ? cleanText(given ?? "") : cleanHeader(given ?? "", Number.MAX_SAFE_INTEGER);
    if (field.options) {
      if (!field.options.some((option) => option.value === text)) return { ok: false, error: `Choose a ${field.label.toLowerCase()}.`, field: field.name };
    } else if (text.length === 0) {
      if (field.required) return { ok: false, error: `${field.label} is required.`, field: field.name };
    } else if (text.length > field.max) {
      return { ok: false, error: `${field.label} is too long: ${text.length} of ${field.max} characters. Shorten it and send again.`, field: field.name };
    }
    values[field.name] = text;
  }
  return { ok: true, values };
}

/** The person writing, as read from their account. */
export type SupportSender = { handle: string | null; displayName: string; role: string; email: string };

/** The subject: the tag, then the start of what they wrote. Always one clean line. */
export function supportSubject(kind: SupportKind, values: SupportValues): string {
  const tag = `[${SUPPORT_FORMS[kind].tag}]`;
  const snippet = (text: string) => cleanHeader(text.split("\n")[0] ?? "", 80);
  if (kind === "bug") return cleanHeader(`${tag} ${snippet(values.happened ?? "")}`);
  if (kind === "contact") return cleanHeader(`${tag} ${snippet(values.subject ?? "")}`);
  const type = FEEDBACK_TYPES.find((option) => option.value === values.type)?.label ?? "Other";
  return cleanHeader(`${tag} ${type}: ${snippet(values.message ?? "")}`);
}

/** Philippine time (UTC+8, no daylight saving), the clock the owner reads: 2026-10-25 15:04:05. */
export function manilaTime(at: Date): string {
  return `${new Date(at.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")} (Asia/Manila)`;
}

const EMAIL_SHAPE = /^[^\s<>(),;:"\\@]+@[^\s<>(),;:"\\@]+$/;

export type SupportEmail = { subject: string; text: string; replyTo?: string };

/** The email that reaches the owner: plain text, with who sent it and when, and the account address to reply to. */
export function buildSupportEmail(args: { kind: SupportKind; values: SupportValues; sender: SupportSender; at: Date }): SupportEmail {
  const { kind, values, sender, at } = args;
  const form = SUPPORT_FORMS[kind];
  const role = ROLE_LABEL[sender.role as keyof typeof ROLE_LABEL] ?? cleanHeader(sender.role, 40);
  const email = cleanHeader(sender.email, 254);

  const lines = [
    `Kind: ${form.kindLabel}`,
    `From: ${sender.handle ? `@${cleanHeader(sender.handle, 64)}` : "(no handle)"}`,
    `Display name: ${cleanHeader(sender.displayName, 100) || "(none)"}`,
    `Role: ${role}`,
    `Account email: ${email}`,
    `Sent: ${manilaTime(at)}`,
  ];
  for (const field of form.fields) {
    const value = values[field.name] ?? "";
    if (value === "") continue;
    const shown = field.options?.find((option) => option.value === value)?.label ?? value;
    const label = field.label.replace(/ \(optional\)$/, "");
    lines.push("", field.type === "textarea" ? `${label}:\n${shown}` : `${label}: ${shown}`);
  }
  return { subject: supportSubject(kind, values), text: `${lines.join("\n")}\n`, replyTo: EMAIL_SHAPE.test(email) ? email : undefined };
}
