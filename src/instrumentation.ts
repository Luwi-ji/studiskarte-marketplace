import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

export function register() {
  Sentry.init(sentryOptions);
}

// Reports errors thrown while rendering or handling a request, in pages, actions and routes.
export const onRequestError = Sentry.captureRequestError;
