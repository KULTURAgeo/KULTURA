import "server-only";

/**
 * TBC Checkout v1 client.
 * This module is intentionally server-only. Never put merchant credentials in NEXT_PUBLIC_*.
 * Order creation and payment reconciliation must be wired through the existing
 * stock-reservation/accounting system before enabling live payments.
 */
const API_BASE = "https://api.tbcbank.ge/v1/tpay";

export class TbcPaymentError extends Error {
  constructor(message = "The payment service is temporarily unavailable.") {
    super(message);
    this.name = "TbcPaymentError";
  }
}

type TbcCredentials = {
  apiKey: string;
  clientId: string;
  clientSecret: string;
};

type TokenResponse = { access_token?: unknown; expires_in?: unknown };
export type TbcPaymentStatus =
  | "Created" | "Processing" | "Succeeded" | "Failed" | "Expired"
  | "WaitingConfirm" | "CancelPaymentProcessing"
  | "PaymentCompletionProcessing" | "Returned" | "PartialReturned";

export type TbcPaymentDetails = {
  payId: string;
  status: TbcPaymentStatus;
  currency: string;
  amount: number;
  preAuth?: boolean;
};

export type TbcPaymentCreated = {
  payId: string;
  redirectUrl: string;
};

function credentials(): TbcCredentials {
  const apiKey = process.env.TBC_API_KEY?.trim();
  const clientId = process.env.TBC_CLIENT_ID?.trim();
  const clientSecret = process.env.TBC_CLIENT_SECRET?.trim();
  if (!apiKey || !clientId || !clientSecret) throw new TbcPaymentError();
  return { apiKey, clientId, clientSecret };
}

function tbcPayId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new TbcPaymentError();
  return value;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new TbcPaymentError();
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TbcPaymentError();
  }
  return payload as Record<string, unknown>;
}

async function accessToken(config: TbcCredentials): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch(`${API_BASE}/access-token`, {
    method: "POST",
    headers: {
      apikey: config.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  const data = (await readJson(response)) as TokenResponse;
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new TbcPaymentError();
  }
  return data.access_token;
}

async function authorizedRequest(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const config = credentials();
  const token = await accessToken(config);
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  return readJson(response);
}

function safeHttpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new TbcPaymentError();
  }
  return url.href;
}

function secureReturnUrl(path: string): string {
  const site = process.env.SITE_URL;
  if (!site) throw new TbcPaymentError();
  const origin = new URL(site);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") {
    throw new TbcPaymentError();
  }
  if (!path.startsWith("/") || path.startsWith("//")) throw new TbcPaymentError();
  return safeHttpsUrl(new URL(path, origin).href);
}

/**
 * Amount is an integer number of tetri from the trusted, server-quoted order.
 * Never accept a cart total supplied by the browser.
 */
export async function createTbcPayment(input: {
  orderId: string;
  totalTetri: number;
  language?: "KA" | "EN";
}): Promise<TbcPaymentCreated> {
  if (!/^[a-f0-9-]{36}$/i.test(input.orderId) ||
      !Number.isSafeInteger(input.totalTetri) || input.totalTetri <= 0 ||
      input.totalTetri > 999999999) throw new TbcPaymentError();

  const body = {
    amount: { currency: "GEL", total: input.totalTetri / 100 },
    returnurl: secureReturnUrl(`/payment/return?orderId=${encodeURIComponent(input.orderId)}`),
    callbackUrl: secureReturnUrl("/api/payments/tbc/callback"),
    merchantPaymentId: input.orderId,
    preAuth: false,
    expirationMinutes: 12,
    language: input.language ?? "KA",
    description: "KULTURA order",
  };
  const data = await authorizedRequest("/payments", { method: "POST", body });
  if (typeof data.payId !== "string" || !data.payId || !Array.isArray(data.links)) {
    throw new TbcPaymentError();
  }
  const link = data.links.find((item): item is { rel: string; uri: string; method: string } =>
    !!item && typeof item === "object" &&
    (item as { rel?: unknown }).rel === "approval_url" &&
    (item as { method?: unknown }).method === "REDIRECT" &&
    typeof (item as { uri?: unknown }).uri === "string");
  if (!link) throw new TbcPaymentError();
  const url = new URL(safeHttpsUrl(link.uri));
  if (url.hostname !== "tpay.tbcbank.ge" && url.hostname !== "ecom.tbcpayments.ge") {
    throw new TbcPaymentError();
  }
  return { payId: tbcPayId(data.payId), redirectUrl: url.href };
}

/** Always retrieve authoritative status from TBC instead of trusting return URL/callback body. */
export async function getTbcPaymentDetails(payId: string): Promise<TbcPaymentDetails> {
  const data = await authorizedRequest(`/payments/${encodeURIComponent(tbcPayId(payId))}`);
  const statuses: TbcPaymentStatus[] = [
    "Created", "Processing", "Succeeded", "Failed", "Expired",
    "WaitingConfirm", "CancelPaymentProcessing",
    "PaymentCompletionProcessing", "Returned", "PartialReturned",
  ];
  if (data.payId !== payId || typeof data.status !== "string" ||
      !statuses.includes(data.status as TbcPaymentStatus) ||
      typeof data.currency !== "string" || typeof data.amount !== "number" ||
      !Number.isFinite(data.amount)) throw new TbcPaymentError();
  return {
    payId,
    status: data.status as TbcPaymentStatus,
    currency: data.currency,
    amount: data.amount,
    ...(typeof data.preAuth === "boolean" ? { preAuth: data.preAuth } : {}),
  };
}
