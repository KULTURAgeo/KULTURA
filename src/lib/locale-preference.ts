import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

export function chooseLocale(explicit: unknown, preference: unknown, acceptLanguage: string | null): Locale {
  if (isLocale(explicit)) return explicit;
  if (isLocale(preference)) return preference;

  let locale = DEFAULT_LOCALE;
  let highest = 0;
  for (const range of (acceptLanguage ?? "").slice(0, 1024).split(",")) {
    const [tag, quality] = range.trim().toLowerCase().split(";").map(part => part.trim());
    const language = tag.split("-")[0];
    const weight = quality === undefined ? 1 : /^q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/.test(quality)
      ? Number(quality.slice(2))
      : 0;
    if (isLocale(language) && weight > highest) {
      locale = language;
      highest = weight;
    }
  }
  return locale;
}
