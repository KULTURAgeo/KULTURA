"use server";

import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { checkoutLines, strictObject, addressKeys } from "@/lib/security/input";
import { id } from "@/lib/validation";
import { InputError } from "@/lib/validation";
import { safeFailure } from "@/lib/actions";
import { notifyOrderEvent } from "@/lib/notifications/order-notifications";

type AddressInput = {
  recipient_name?: unknown;
  phone?: unknown;
  city?: unknown;
  address_line_1?: unknown;
  address_line_2?: unknown;
  postal_code?: unknown;
};

type CheckoutInput = {
  requestId?: unknown;
  lines?: unknown;
  address?: AddressInput;
  promoCode?: unknown;
};

export type UnpaidCheckoutResult = {
  ok: boolean;
  message: string;
  orderId?: string;
};

function requiredString(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new InputError(label + " is required.");
  const result = value.trim();
  if (!result || result.length > max)
    throw new InputError(label + " must be 1–" + max + " characters.");
  return result;
}

function optionalString(value: unknown, label: string, max: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError(label + " is invalid.");
  const result = value.trim();
  if (result.length > max)
    throw new InputError(label + " must be at most " + max + " characters.");
  return result || null;
}

function promoCode(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InputError("Promo code is invalid.");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(code))
    throw new InputError("Enter a valid promo code.");
  return code;
}

export async function createUnpaidOrder(
  input: CheckoutInput,
): Promise<UnpaidCheckoutResult> {
  try {
    const { client } = await requireActionActor();
    strictObject(input, ["requestId", "lines", "address", "promoCode"]);
    const requestId = id(input.requestId, "checkout request");
    const lines = checkoutLines(input.lines);
    if (!lines.length) throw new InputError("Your bag is empty.");

    const address = strictObject(input.address, addressKeys);
    const payload = {
      recipient_name: requiredString(address.recipient_name, "Recipient name", 200),
      phone: requiredString(address.phone, "Phone", 40),
      city: requiredString(address.city, "City", 120),
      address_line_1: requiredString(address.address_line_1, "Address line 1", 300),
      address_line_2: optionalString(address.address_line_2, "Address line 2", 300),
      postal_code: optionalString(address.postal_code, "Postal code", 30),
    };

    const cart = lines.map((line) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      quantity: line.quantity,
    }));

    const { data, error } = await client.rpc("checkout_submit_order", {
      p_request_id: requestId,
      p_cart: cart,
      p_address: payload,
      p_promo_code: promoCode(input.promoCode),
    });

    if (error) {
      if (error.code === "22023") {
        const message = error.message.toLowerCase();
        if (message.includes("stock"))
          return { ok: false, message: "Stock changed. Refresh your bag and try again." };
        if (message.includes("promo"))
          return { ok: false, message: "The promo code changed or expired. Apply it again." };
        if (message.includes("unavailable"))
          return { ok: false, message: "A product or variant is no longer available." };
        return { ok: false, message: "Review your bag and delivery details, then try again." };
      }
      throw error;
    }

    revalidatePath("/account/orders");
    revalidatePath("/admin/orders");

    await notifyOrderEvent(client, data, "order_received");

    return {
      ok: true,
      message: "Order saved. No payment was taken.",
      orderId: data,
    };
  } catch (error) {
    const failure = safeFailure(error);
    return {
      ok: false,
      message: failure.message ?? "The order could not be created.",
    };
  }
}
