"use client";

import { useLanguage } from "./language-provider";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

export function CookieSettingsButton() {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      className="footer-cookie-button"
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
      }
    >
      {t("COOKIE SETTINGS")}
    </button>
  );
}
