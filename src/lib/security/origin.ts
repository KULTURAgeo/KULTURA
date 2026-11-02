import { siteUrl } from "../site";

export function callbackOrigin(requestUrl: string) {
  const origin = new URL(requestUrl).origin;
  const configured = siteUrl().origin;
  const previews = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter(Boolean).map((host) => `https://${host}`);
  return origin === configured || previews.includes(origin) ? origin : configured;
}
