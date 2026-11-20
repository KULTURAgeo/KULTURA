import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./i18n";
import { chooseLocale } from "./locale-preference";
export async function getServerLocale(): Promise<Locale> {
  const [request, jar] = await Promise.all([headers(), cookies()]);
  return chooseLocale(request.get("x-kultura-language"), jar.get(LOCALE_COOKIE)?.value, request.get("accept-language"));
}
