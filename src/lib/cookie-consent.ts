export const COOKIE_CONSENT_KEY = "kultura.cookie-consent.v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "kultura:open-cookie-settings";

export type CookieConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export function readCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }
    return {
      analytics: parsed.analytics,
      marketing: parsed.marketing,
    };
  } catch {
    return null;
  }
}

export function writeCookieConsent(preferences: CookieConsentPreferences) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
}
