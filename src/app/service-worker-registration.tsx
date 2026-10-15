"use client";

import { useEffect } from "react";

// Registers public/sw.js. Some browsers (Samsung Internet) only offer to
// install the app when a service worker is registered.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("service worker registration failed", error));
  }, []);
  return null;
}
