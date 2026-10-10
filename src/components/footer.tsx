"use client";
import Link from "next/link";
import { Container } from "./ui";
import { CookieSettingsButton } from "./cookie-settings-button";
import { useLanguage } from "./language-provider";
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer>
      <Container>
        <div className="footer-top">
          <div>
            <Link href="/" className="wordmark">
              KULTURA®
            </Link>
            <p>{t("For those who move differently.")}</p>
          </div>
          <nav aria-label={t("Footer navigation")}>
            {[
              "shop",
              "about",
              "contact",
              "shipping",
              "returns",
              "privacy",
              "terms",
            ].map((item) => (
              <Link key={item} href={`/${item}`}>
                {t(item.toUpperCase())}
              </Link>
            ))}
            <span className="muted">{t("INSTAGRAM — COMING SOON")}</span>
            <CookieSettingsButton />
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} KULTURA</span>
          <span>{t("STEP INTO KULTURA")}</span>
          <span>{t("GEORGIA / GEL")}</span>
        </div>
      </Container>
    </footer>
  );
}
