import "server-only";

import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export type OrderNotificationEvent =
  | "order_received"
  | "payment_paid"
  | "payment_failed"
  | "payment_refunded"
  | "processing"
  | "shipped"
  | "delivered"
  | "order_cancelled"
  | "returned";

type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";
type SendResult = "sent" | "failed" | "skipped" | "unconfigured";

type PreparedNotification = {
  id: string;
  orderId: string;
  event: OrderNotificationEvent;
  email: string;
  phone: string | null;
  countryCode: string | null;
  emailStatus: DeliveryStatus;
  smsStatus: DeliveryStatus;
  orderNumber: string;
  deliveryName: string;
  currency: string;
  finalTotal: number;
};

type Copy = {
  subject: string;
  heading: string;
  text: string;
  sms: string;
  smsEnabled: boolean;
};

type Client = SupabaseClient<Database>;

function record(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: Json | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isEvent(value: string | null): value is OrderNotificationEvent {
  return !!value && [
    "order_received",
    "payment_paid",
    "payment_failed",
    "payment_refunded",
    "processing",
    "shipped",
    "delivered",
    "order_cancelled",
    "returned",
  ].includes(value);
}

function isDeliveryStatus(value: string | null): value is DeliveryStatus {
  return !!value && ["pending", "sent", "failed", "skipped"].includes(value);
}

function parsePrepared(data: Json): PreparedNotification | null {
  const root = record(data);
  if (!root || root.skip === true) return null;
  const payload = record(root.payload);
  if (!payload) return null;

  const id = stringValue(root.id);
  const orderId = stringValue(root.order_id);
  const event = stringValue(root.event_type);
  const email = stringValue(root.recipient_email);
  const emailStatus = stringValue(root.email_status);
  const smsStatus = stringValue(root.sms_status);
  const orderNumber = stringValue(payload.order_number);
  const deliveryName = stringValue(payload.delivery_name);
  const currency = stringValue(payload.currency);
  const finalTotal = numberValue(payload.final_total);

  if (
    !id ||
    !orderId ||
    !isEvent(event) ||
    !email ||
    !isDeliveryStatus(emailStatus) ||
    !isDeliveryStatus(smsStatus) ||
    !orderNumber ||
    !deliveryName ||
    !currency ||
    finalTotal === null
  )
    return null;

  return {
    id,
    orderId,
    event,
    email,
    phone: stringValue(root.recipient_phone),
    countryCode: stringValue(root.recipient_country_code),
    emailStatus,
    smsStatus,
    orderNumber,
    deliveryName,
    currency,
    finalTotal,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function amount(total: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(total / 100);
  } catch {
    return `${(total / 100).toFixed(2)} ${currency}`;
  }
}

function orderUrl(orderId: string) {
  const raw = process.env.SITE_URL;
  if (!raw) return null;
  try {
    return new URL(`/account/orders/${orderId}`, raw).href;
  } catch {
    return null;
  }
}

function copyFor(notification: PreparedNotification): Copy {
  const number = notification.orderNumber;
  const total = amount(notification.finalTotal, notification.currency);
  switch (notification.event) {
    case "order_received":
      return {
        subject: `KULTURA order ${number} received`,
        heading: "ORDER RECEIVED",
        text: `We received order ${number} for ${total}. Payment is still pending and no payment has been confirmed yet.`,
        sms: `KULTURA: Order ${number} received. Payment is pending. We will update you when payment is confirmed.`,
        smsEnabled: true,
      };
    case "payment_paid":
      return {
        subject: `Payment received for ${number}`,
        heading: "PAYMENT RECEIVED",
        text: `Payment for order ${number} has been confirmed. Your order is ready for KULTURA to start preparing.`,
        sms: `KULTURA: Payment confirmed for order ${number}. We will update you when your order moves forward.`,
        smsEnabled: true,
      };
    case "payment_failed":
      return {
        subject: `Payment update for ${number}`,
        heading: "PAYMENT NOT COMPLETED",
        text: `Payment for order ${number} was not completed. Your order has not moved into fulfillment.`,
        sms: `KULTURA: Payment for order ${number} was not completed. Check your account before trying again.`,
        smsEnabled: true,
      };
    case "payment_refunded":
      return {
        subject: `Refund update for ${number}`,
        heading: "REFUND UPDATED",
        text: `A refund update was recorded for order ${number}. Check your account for the latest order status.`,
        sms: `KULTURA: A refund update was recorded for order ${number}. Check your account for details.`,
        smsEnabled: true,
      };
    case "processing":
      return {
        subject: `Order ${number} is being prepared`,
        heading: "ORDER IN PROCESS",
        text: `We have started preparing order ${number}. We will notify you again when it ships.`,
        sms: "",
        smsEnabled: false,
      };
    case "shipped":
      return {
        subject: `Order ${number} has shipped`,
        heading: "ORDER SHIPPED",
        text: `Order ${number} has been marked shipped. Check your account for the latest status.`,
        sms: `KULTURA: Order ${number} has shipped. Check your account for the latest status.`,
        smsEnabled: true,
      };
    case "delivered":
      return {
        subject: `Order ${number} delivered`,
        heading: "ORDER DELIVERED",
        text: `Order ${number} has been marked delivered. Thank you for shopping with KULTURA.`,
        sms: `KULTURA: Order ${number} has been delivered. Thank you for shopping with us.`,
        smsEnabled: true,
      };
    case "order_cancelled":
      return {
        subject: `Order ${number} cancelled`,
        heading: "ORDER CANCELLED",
        text: `Order ${number} has been cancelled. Check your account for the latest payment and order details.`,
        sms: `KULTURA: Order ${number} has been cancelled. Check your account for details.`,
        smsEnabled: true,
      };
    case "returned":
      return {
        subject: `Return update for ${number}`,
        heading: "ORDER RETURNED",
        text: `Order ${number} has been marked returned. Check your account for the latest status.`,
        sms: `KULTURA: Order ${number} has been marked returned. Check your account for details.`,
        smsEnabled: true,
      };
  }
}

function emailHtml(notification: PreparedNotification, copy: Copy) {
  const link = orderUrl(notification.orderId);
  const name = escapeHtml(notification.deliveryName);
  const heading = escapeHtml(copy.heading);
  const text = escapeHtml(copy.text);
  const action = link
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;padding:14px 20px;text-decoration:none;font-weight:700">VIEW ORDER</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f3f3f1;color:#111;font-family:Arial,Helvetica,sans-serif"><div style="max-width:640px;margin:0 auto;padding:36px 20px"><div style="background:#0b0b0b;color:#fff;padding:28px"><div style="font-size:24px;font-weight:900;letter-spacing:-1px">KULTURA</div></div><div style="background:#fff;padding:32px"><p style="font-size:12px;letter-spacing:2px;color:#777;margin:0 0 18px">${heading}</p><h1 style="font-size:34px;line-height:1;margin:0 0 22px">${escapeHtml(notification.orderNumber)}</h1><p style="margin:0 0 12px">Hi ${name},</p><p style="line-height:1.6;margin:0">${text}</p>${action}</div><div style="padding:18px 4px;color:#777;font-size:12px">Transactional order notification from KULTURA.</div></div></body></html>`;
}

function emailText(notification: PreparedNotification, copy: Copy) {
  const link = orderUrl(notification.orderId);
  return [
    "KULTURA",
    copy.heading,
    notification.orderNumber,
    "",
    `Hi ${notification.deliveryName},`,
    copy.text,
    link ? `View order: ${link}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizePhone(phone: string | null, countryCode: string | null) {
  if (!phone) return null;
  let value = phone.trim().replace(/[\s().-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (!value.startsWith("+")) {
    const digits = value.replace(/\D/g, "");
    if ((countryCode ?? "").toUpperCase() === "GE") {
      if (digits.startsWith("995")) value = `+${digits}`;
      else if (digits.length === 9) value = `+995${digits}`;
      else return null;
    } else {
      return null;
    }
  }
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

async function sendEmail(notification: PreparedNotification, copy: Copy): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  if (!key || !from) return "unconfigured";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification.email)) return "skipped";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `kultura/${notification.orderId}/${notification.event}`,
      },
      body: JSON.stringify({
        from,
        to: [notification.email],
        subject: copy.subject,
        html: emailHtml(notification, copy),
        text: emailText(notification, copy),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function sendSms(notification: PreparedNotification, copy: Copy): Promise<SendResult> {
  if (!copy.smsEnabled) return "skipped";

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!accountSid || !authToken || (!from && !messagingServiceSid)) return "unconfigured";

  const to = normalizePhone(notification.phone, notification.countryCode);
  if (!to) return "skipped";

  const body = new URLSearchParams({ To: to, Body: copy.sms });
  if (messagingServiceSid) body.set("MessagingServiceSid", messagingServiceSid);
  else if (from) body.set("From", from);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

async function recordResult(
  client: Client,
  id: string,
  channel: "email" | "sms",
  result: SendResult,
) {
  if (result === "unconfigured") return;
  const { error } = await client.rpc("notification_record_delivery", {
    p_notification_id: id,
    p_channel: channel,
    p_status: result,
  });
  if (error)
    console.error(`[notifications] Unable to record ${channel} delivery result.`);
}

export async function notifyOrderEvent(
  client: Client,
  orderId: string,
  event: OrderNotificationEvent,
) {
  try {
    const { data, error } = await client.rpc("notification_prepare", {
      p_order_id: orderId,
      p_event_type: event,
    });
    if (error) {
      console.error(`[notifications] Unable to prepare ${event} notification.`);
      return;
    }

    const notification = parsePrepared(data);
    if (!notification) return;
    const copy = copyFor(notification);

    const emailPromise =
      notification.emailStatus === "sent" || notification.emailStatus === "skipped"
        ? Promise.resolve<SendResult>("skipped")
        : sendEmail(notification, copy);
    const smsPromise =
      notification.smsStatus === "sent" || notification.smsStatus === "skipped"
        ? Promise.resolve<SendResult>("skipped")
        : sendSms(notification, copy);

    const [emailResult, smsResult] = await Promise.all([emailPromise, smsPromise]);

    if (notification.emailStatus !== "sent" && notification.emailStatus !== "skipped")
      await recordResult(client, notification.id, "email", emailResult);
    if (notification.smsStatus !== "sent" && notification.smsStatus !== "skipped")
      await recordResult(client, notification.id, "sms", smsResult);
  } catch {
    console.error(`[notifications] ${event} delivery failed safely.`);
  }
}

export async function notifyFulfillmentStatus(
  client: Client,
  orderId: string,
  status: Database["public"]["Enums"]["fulfillment_status"],
) {
  const event: OrderNotificationEvent | null =
    status === "processing"
      ? "processing"
      : status === "shipped"
        ? "shipped"
        : status === "delivered"
          ? "delivered"
          : status === "cancelled"
            ? "order_cancelled"
            : status === "returned"
              ? "returned"
              : null;
  if (event) await notifyOrderEvent(client, orderId, event);
}

export async function notifyPaymentStatus(
  client: Client,
  orderId: string,
  status: Database["public"]["Enums"]["payment_status"],
) {
  const event: OrderNotificationEvent | null =
    status === "paid"
      ? "payment_paid"
      : status === "failed" || status === "cancelled"
        ? "payment_failed"
        : status === "refunded" || status === "partially_refunded"
          ? "payment_refunded"
          : null;
  if (event) await notifyOrderEvent(client, orderId, event);
}
