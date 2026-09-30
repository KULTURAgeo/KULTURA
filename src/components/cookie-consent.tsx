"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";

const Analytics = dynamic(
  () => import("@/components/analytics").then((module) => module.Analytics),
  { ssr: false },
);

type CookieConsentProps = {
  googleAnalyticsId?: string;
  metaPixelId?: string;
};

function expireCookie(name: string) {
  const hostname = window.location.hostname;
  const base = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  document.cookie = base;
  document.cookie = `${base}; domain=${hostname}`;
  document.cookie = `${base}; domain=.${hostname}`;
}

function clearOptionalCookies(kind: "analytics" | "marketing") {
  const prefixes =
    kind === "analytics" ? ["_ga", "_gid", "_gat"] : ["_fbp", "_fbc"];

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name) continue;
    if (prefixes.some((prefix) => name.startsWith(prefix))) expireCookie(name);
  }
}

function setGoogleDisabled(
  googleAnalyticsId: string | undefined,
  disabled: boolean,
) {
  if (!googleAnalyticsId) return;
  const target = window as unknown as Record<string, unknown>;
  target[`ga-disable-${googleAnalyticsId}`] = disabled;
}

export function CookieConsent({
  googleAnalyticsId,
  metaPixelId,
}: CookieConsentProps) {
  const [loaded, setLoaded] = useState(false);
  const [preferences, setPreferences] =
    useState<CookieConsentPreferences | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [draft, setDraft] = useState<CookieConsentPreferences>({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const saved = readCookieConsent();
    const hydrationTimer = window.setTimeout(() => {
      setPreferences(saved);
      setDraft(saved ?? { analytics: false, marketing: false });
      setLoaded(true);
    }, 0);

    const openSettings = () => {
      const current = readCookieConsent();
      setDraft(current ?? { analytics: false, marketing: false });
      setCustomize(true);
      setSettingsOpen(true);
    };

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    };
  }, []);

  const save = (next: CookieConsentPreferences) => {
    try {
      writeCookieConsent(next);
    } catch {
      // If storage is unavailable, keep the choice for this page only.
    }

    setGoogleDisabled(googleAnalyticsId, !next.analytics);
    if (!next.analytics) clearOptionalCookies("analytics");

    if (!next.marketing) {
      window.fbq?.("consent", "revoke");
      clearOptionalCookies("marketing");
    } else {
      window.fbq?.("consent", "grant");
    }

    setPreferences(next);
    setDraft(next);
    setSettingsOpen(false);
    setCustomize(false);
  };

  const showPanel = loaded && (!preferences || settingsOpen);

  return (
    <>
      {loaded && (preferences?.analytics || preferences?.marketing) ? (
        <Analytics
          googleAnalyticsId={preferences.analytics ? googleAnalyticsId : undefined}
          metaPixelId={preferences.marketing ? metaPixelId : undefined}
        />
      ) : null}

      {showPanel ? (
        <section
          className="cookie-consent"
          role="dialog"
          aria-labelledby="cookie-consent-title"
        >
          <div className="cookie-consent-copy">
            <p className="eyebrow">PRIVACY CONTROLS</p>
            <h2 id="cookie-consent-title">YOUR COOKIE CHOICE</h2>
            <p>
              We use necessary storage for core site features. With your
              permission, Google Analytics helps us understand site usage and
              Meta Pixel helps measure advertising performance. You can change
              this choice anytime in Cookie Settings.
            </p>
            <Link className="text-link" href="/privacy">
              READ PRIVACY INFORMATION ↗
            </Link>
          </div>

          {customize ? (
            <div className="cookie-consent-options">
              <div className="cookie-option">
                <div>
                  <strong>NECESSARY</strong>
                  <p>Required for core site features and saved preferences.</p>
                </div>
                <span>ALWAYS ON</span>
              </div>

              <label className="cookie-option">
                <div>
                  <strong>ANALYTICS</strong>
                  <p>Google Analytics usage and ecommerce measurement.</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      analytics: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="cookie-option">
                <div>
                  <strong>MARKETING</strong>
                  <p>Meta Pixel advertising and conversion measurement.</p>
                </div>
                <input
                  type="checkbox"
                  checked={draft.marketing}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      marketing: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          ) : null}

          <div className="cookie-consent-actions">
            {customize ? (
              <>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => save(draft)}
                >
                  SAVE PREFERENCES
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => save({ analytics: true, marketing: true })}
                >
                  ACCEPT ALL
                </button>
              </>
            ) : (
              <>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => save({ analytics: false, marketing: false })}
                >
                  REJECT OPTIONAL
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setCustomize(true)}
                >
                  CUSTOMIZE
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => save({ analytics: true, marketing: true })}
                >
                  ACCEPT ALL
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
