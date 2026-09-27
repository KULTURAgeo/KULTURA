"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="footer-cookie-button"
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
      }
    >
      COOKIE SETTINGS
    </button>
  );
}
