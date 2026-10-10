"use client";

import { Container, ButtonLink } from "./ui";
import { useLanguage } from "./language-provider";
import { georgianInformationPages, type InformationPage } from "@/lib/information-pages-ka";

function renderInformationText(value: string) {
  const pattern = /(@kultura\.geo)(?=[\s.,;!?]|$)/g;
  return value.split(pattern).map((part, index) => part === "@kultura.geo" ? (
    <a key={index} href="https://www.instagram.com/kultura.geo/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{part}</a>
  ) : part);
}

export function InformationContent({ slug, english }: { slug: string; english: InformationPage }) {
  const { locale, t } = useLanguage();
  const entry = (locale === "ka" ? georgianInformationPages[slug] : null) ?? english;
  return (
    <Container className="information page-section">
      <p className="eyebrow">KULTURA</p>
      <h1 className="page-title">{entry.title}</h1>
      <p className="information-intro">{entry.intro}</p>
      {entry.sections?.length ? (
        <div className="policy-sections">
          {entry.sections.map((section, index) => (
            <section className="policy-section" key={index}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph, i) => <p key={i}>{renderInformationText(paragraph)}</p>)}
              {section.items?.length ? (
                <ul>{section.items.map((item, i) => <li key={i}>{renderInformationText(item)}</li>)}</ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}
      <ButtonLink href="/shop" secondary>{t("EXPLORE THE COLLECTION ↗")}</ButtonLink>
    </Container>
  );
}
