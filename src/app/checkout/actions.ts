"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/guards";
import { normalizeLines } from "@/lib/cart/model";
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
};

type TestCheckoutResult = {
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
  if (typeof value !== "string")
    throw new InputError(label + " is invalid.");
  const result = value.trim();
  if (result.length > max)
    throw new InputError(label + " must be at most " + max + " characters.");
  return result || null;
}

export async function createTestOrder(
  input: TestCheckoutInput,
): Promise<TestCheckoutResult> {
  try {
    const { client } = await requireActor(true);
    const lines = normalizeLines(input.lines);

    if (!lines.length)
      throw new InputError("Your bag is empty.");
    if (lines.some((line) => line.quantity < 1))
      throw new InputError("Your bag contains an invalid quantity.");

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

    const { data, error } = await client.rpc("admin_create_test_order", {
      p_cart: cart,
      p_address: payload,
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
