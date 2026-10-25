"use client";

import { useEffect } from "react";
import { CONSENT_EVENT, readConsent, type ConsentChoice } from "@/lib/funnel/consent";

function tell(consent: boolean) {
  fetch("/api/funnel/landing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consent, query: window.location.search }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * After the visitor accepts, counts one landing view per tab session and passes the ?utm_* tags to the server.
 * After a rejection it only asks the server to drop any earlier campaign cookie. Renders nothing.
 */
export function FunnelBeacon() {
  useEffect(() => {
    function apply(choice: ConsentChoice | null) {
      if (choice === "rejected") return tell(false);
      if (choice !== "accepted") return;
      try {
        if (sessionStorage.getItem("sk:landing-view")) return;
        sessionStorage.setItem("sk:landing-view", "1");
      } catch {
        // Storage blocked: count the visit anyway.
      }
      tell(true);
    }
    apply(readConsent());
    const onChoice = (event: Event) => apply((event as CustomEvent<ConsentChoice>).detail);
    window.addEventListener(CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(CONSENT_EVENT, onChoice);
  }, []);
  return null;
}
