"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/guards";
import { normalizeLines, quoteLines } from "@/lib/cart/model";
import { getProductsByIds } from "@/lib/catalog/repository";
import { money } from "@/lib/catalog";
import { InputError } from "@/lib/validation";
import { safeFailure } from "@/lib/actions";

type TestAddressInput = {
  recipient_name?: unknown;
  phone?: unknown;
  city?: unknown;
  address_line_1?: unknown;
  address_line_2?: unknown;
  postal_code?: unknown;
};

type TestCheckoutInput = {
  lines?: unknown;
  address?: TestAddressInput;
  promoCode?: unknown;
};

type TestCheckoutResult = {
  ok: boolean;
  message: string;
  orderId?: string;
};

export type PromoQuoteResult =
  | {
      ok: true;
      code: string;
      discount: number;
      subtotal: number;
      message: string;
    }
  | {
      ok: false;
      message: string;
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
  if (typeof value !== "string")
    throw new InputError(label + " is invalid.");
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

export async function quotePromo(input: {
  code?: unknown;
  lines?: unknown;
}): Promise<PromoQuoteResult> {
  try {
    const { client } = await requireActor();
    const code = promoCode(input.code);
    if (!code) throw new InputError("Enter a promo code.");

    const lines = normalizeLines(input.lines);
    if (!lines.length) throw new InputError("Your bag is empty.");

    const catalog = await getProductsByIds([
      ...new Set(lines.map((line) => line.productId)),
    ]);
    if (catalog.status !== "ready")
      return {
        ok: false,
        message: "We cannot validate promo codes right now. Try again shortly.",
      };

    const quote = quoteLines(lines, catalog.products);
    if (quote.lines.some((line) => !line.available))
      return {
        ok: false,
        message: "Refresh your bag before applying a promo code.",
      };

    const { data, error } = await client.rpc("checkout_quote_promo", {
      p_code: code,
      p_subtotal: quote.subtotal.toString(),
    });

    if (error) throw error;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.valid !== true
    ) {
      const message =
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        typeof data.message === "string"
          ? data.message
          : "Promo code is unavailable.";

      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        data.reason === "minimum" &&
        typeof data.minimum_subtotal === "number"
      ) {
        return {
          ok: false,
          message:
            "This promo requires at least " +
            money(data.minimum_subtotal) +
            " merchandise subtotal.",
        };
      }

      return { ok: false, message };
    }

    if (
      typeof data.code !== "string" ||
      typeof data.discount !== "number" ||
      !Number.isSafeInteger(data.discount)
    )
      return { ok: false, message: "Promo code response is invalid." };

    return {
      ok: true,
      code: data.code,
      discount: data.discount,
      subtotal: quote.subtotal,
      message: data.code + " applied.",
    };
  } catch (error) {
    const failure = safeFailure(error);
    return {
      ok: false,
      message: failure.message ?? "Promo code could not be applied.",
    };
  }
}

export async function createTestOrder(
  input: TestCheckoutInput,
): Promise<TestCheckoutResult> {
  try {
    const { client } = await requireActor(true);
    const lines = normalizeLines(input.lines);

    if (!lines.length) throw new InputError("Your bag is empty.");

    const address = input.address ?? {};
    const payload = {
      recipient_name: requiredString(
        address.recipient_name,
        "Recipient name",
        200,
      ),
      phone: requiredString(address.phone, "Phone", 40),
      city: requiredString(address.city, "City", 120),
      address_line_1: requiredString(
        address.address_line_1,
        "Address line 1",
        300,
      ),
      address_line_2: optionalString(
        address.address_line_2,
        "Address line 2",
        300,
      ),
      postal_code: optionalString(address.postal_code, "Postal code", 30),
    };

    const cart = lines.map((line) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      quantity: line.quantity,
    }));

    const { data, error } = await client.rpc("admin_create_test_order_v2", {
      p_cart: cart,
      p_address: payload,
      p_promo_code: promoCode(input.promoCode),
    });

    if (error) {
      if (error.code === "22023") {
        const message = error.message.toLowerCase();
        if (message.includes("stock"))
          return {
            ok: false,
            message:
              "Stock changed. Refresh your bag before creating the test order.",
          };
        if (message.includes("promo"))
          return {
            ok: false,
            message:
              "The promo code changed or expired. Apply it again before creating the test order.",
          };
        if (message.includes("unavailable"))
          return {
            ok: false,
            message:
              "A product or variant is no longer available. Refresh your bag.",
          };
        return {
          ok: false,
          message:
            "The test checkout details are no longer valid. Review your bag and delivery address.",
        };
      }
      throw error;
    }

    revalidatePath("/account/orders");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");

    return {
      ok: true,
      message: "Test order created. No payment was taken.",
      orderId: data,
    };
  } catch (error) {
    const failure = safeFailure(error);
    return {
      ok: false,
      message: failure.message ?? "The test order could not be created.",
    };
  }
}
