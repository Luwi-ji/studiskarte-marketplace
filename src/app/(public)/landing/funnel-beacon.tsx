"use client";

import { useEffect } from "react";

/** Counts one landing view per tab session and passes the ?utm_* tags to the server. Renders nothing. */
export function FunnelBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("sk:landing-view")) return;
      sessionStorage.setItem("sk:landing-view", "1");
    } catch {
      // Storage blocked: count the visit anyway.
    }
    fetch("/api/funnel/landing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: window.location.search }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
