import "server-only";
import { languageUrls } from "@/lib/site";
import { notificationClient } from "./client";

export function dropAlertDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.NOTIFICATION_EMAIL_FROM?.trim()
    && process.env.SUPABASE_SECRET_KEY?.trim());
}

type ClaimedAlert = { id: string; locale: string; email: string; claimed_at: string };

function isClaimedAlert(value: unknown): value is ClaimedAlert {
  if (typeof value !== "object" || value === null) return false;
  const alert = value as Partial<ClaimedAlert>;
  return typeof alert.id === "string" && typeof alert.claimed_at === "string"
    && (alert.locale === "en" || alert.locale === "ka") && typeof alert.email === "string";
}

// Call only after the admin action has verified the operator's AAL2 session.
export async function sendDropAlertBatch(releaseId: string) {
  const token = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  const client = notificationClient();
  if (!token || !from || !client) return null;

  const urls = languageUrls("/drops");
  const { data, error } = await client.rpc("claim_drop_alerts", { p_release_id: releaseId });
  if (error || !Array.isArray(data) || !data.every(isClaimedAlert)) throw new Error("Drop alerts unavailable");

  let sent = 0;
  for (const alert of data) {
    const ka = alert.locale === "ka";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`, "Content-Type": "application/json",
          "Idempotency-Key": `kultura/drop-alert/${alert.id}`,
        },
        body: JSON.stringify({
          from, to: [alert.email],
          subject: ka ? "KULTURA-ს ახალი კოლექცია გამოვიდა" : "A new KULTURA drop is live",
          text: ka
            ? `KULTURA-ს ახალი კოლექცია უკვე ხელმისაწვდომია: ${urls.ka}`
            : `The new KULTURA drop is now available: ${urls.en}`,
        }),
        signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error",
      });
      if (!response.ok) continue;
      const { error: updateError } = await client.from("drop_alerts").update({ sent_at: new Date().toISOString() })
        .eq("id", alert.id).eq("claimed_at", alert.claimed_at).is("sent_at", null);
      if (!updateError) sent++;
    } catch {
      // The short lease permits a retry with the same Resend idempotency key.
    }
    if (alert !== data.at(-1)) await new Promise(resolve => setTimeout(resolve, 550));
  }
  return { claimed: data.length, sent };
}
