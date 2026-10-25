/**
 * What a visitor chose about the landing page's campaign measurement (the sk_utm cookie and the landing-view count).
 * Kept on the device only. Without a choice, or after a rejection, neither is set or counted.
 */
export const CONSENT_KEY = "sk:cookie-choice";
export const CONSENT_EVENT = "sk:consent";
export const CONSENT_REOPEN_EVENT = "sk:consent-reopen";

export type ConsentChoice = "accepted" | "rejected";

export function readConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this visit.
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}
