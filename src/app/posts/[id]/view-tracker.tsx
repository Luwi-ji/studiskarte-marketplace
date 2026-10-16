"use client";

import { useEffect } from "react";
import { recordViewAction } from "../actions";

/**
 * Counts a view once the page is really shown. Done in the browser, not while
 * rendering, so a prefetch of the page never counts. The server ignores the
 * owner and counts a student at most once per day.
 */
export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    recordViewAction(postId).catch(() => {
      // A missed view is not worth an error on the page.
    });
  }, [postId]);
  return null;
}
