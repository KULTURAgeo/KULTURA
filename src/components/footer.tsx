import Link from "next/link";
import { Container } from "./ui";
import { CookieSettingsButton } from "./cookie-settings-button";
export function Footer() {
  return (
    <footer>
      <Container>
        <div className="footer-top">
          <div>
            <Link href="/" className="wordmark">
              KULTURA®
            </Link>
            <p>For those who move differently.</p>
          </div>
          <nav aria-label="Footer navigation">
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
                {item.toUpperCase()}
              </Link>
            ))}
            <span className="muted">INSTAGRAM — COMING SOON</span>
            <CookieSettingsButton />
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} KULTURA</span>
          <span>STEP INTO KULTURA</span>
          <span>GEORGIA / GEL</span>
        </div>
      </Container>
    </footer>
  );
}
