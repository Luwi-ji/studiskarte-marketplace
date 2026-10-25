import type { ErrorEvent } from "@sentry/nextjs";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** A shop's private report link carries its secret in the path; the secret never goes into an error report. */
export function redactPartnerLinks(text: string): string {
  return text.replace(/\/partner\/[A-Za-z0-9_-]{32}/g, "/partner/[token]");
}

/** Error reports must never carry an email address: it can sit inside an error message or a URL. */
function redact(text: string): string {
  return text.replace(EMAIL, "[email]");
}

/**
 * Last line of defence before an error report leaves the app. The SDK is already told not to collect
 * user identity, cookies, headers, bodies or query strings; this removes any of them that still
 * arrive and blanks email addresses in the text that is left.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = redactPartnerLinks(event.request.url);
  }
  if (event.transaction) event.transaction = redactPartnerLinks(event.transaction);
  if (event.message) event.message = redactPartnerLinks(redact(event.message));
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactPartnerLinks(redact(exception.value));
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = redactPartnerLinks(redact(crumb.message));
    delete crumb.data;
  }
  return event;
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Errors only: no tracing, no session replay, no personal data. Sending is on only in a production
 * build that has a DSN, so development and tests never report.
 */
export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  beforeSend: scrubEvent,
};
