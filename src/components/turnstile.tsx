"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const script = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function Turnstile({ action, resetKey = 0, onTokenChange }: { action: "signup" | "password_reset" | "contact"; resetKey?: number; onTokenChange?: (ready: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      onTokenChange?.(true);
      return;
    }
    if (!loaded || !container.current || !window.turnstile) return;
    setFailed(false);
    onTokenChange?.(false);
    const widget = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      theme: "auto",
      size: "flexible",
      callback: () => onTokenChange?.(true),
      "expired-callback": () => onTokenChange?.(false),
      "error-callback": () => { setFailed(true); onTokenChange?.(false); },
    });
    return () => window.turnstile?.remove(widget);
  }, [action, loaded, onTokenChange, resetKey]);

  if (!siteKey) return null;
  return (
    <div className="flex min-h-16 flex-col justify-center gap-1">
      <Script src={script} strategy="afterInteractive" onReady={() => setLoaded(true)} onError={() => setFailed(true)} />
      <div ref={container} />
      {failed ? <p role="alert" className="text-sm text-red-600">The security check could not load. Check your connection and try again.</p> : null}
    </div>
  );
}
