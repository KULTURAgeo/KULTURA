"use client";
import {Button, Container} from "./ui";
import { useLanguage } from "./language-provider";
export function Newsletter() {
 const { t } = useLanguage();
 return <section className="newsletter"><Container className="newsletter-inner">
  <div><p className="eyebrow">{t("STAY IN THE LOOP")}</p><h2>{t("First to know.")}<br/>{t("Never in the crowd.")}</h2></div>
  <div>
   <label htmlFor="newsletter-email">{t("YOUR EMAIL")}</label>
   <div className="email-row"><input id="newsletter-email" type="email" disabled placeholder={t("Signup opens soon")} aria-describedby="newsletter-note"/>
   <Button type="button" disabled aria-label={t("Newsletter signup unavailable")}>↗</Button></div>
   <p id="newsletter-note" className="muted">{t("Newsletter signup is not available yet. No email addresses are collected here.")}</p>
  </div>
 </Container></section>;
}
