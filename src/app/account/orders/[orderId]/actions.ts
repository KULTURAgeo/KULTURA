"use server";
import { strictForm } from "@/lib/security/input";

import { revalidatePath } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActionActor } from "@/lib/auth/guards";
import { id, integer, InputError, text } from "@/lib/validation";

const REQUEST_TYPES = ["return", "refund"] as const;
const RETURN_REASONS = [
  "wrong_size",
  "damaged",
  "not_as_described",
  "changed_mind",
  "duplicate_order",
  "other",
] as const;

export async function createReturnRequest(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    strictForm(data, ["order_id", "request_type", "reason", "details", "return_item"], ["return_item"]);
    const { client } = await requireActionActor();
    const orderId = id(data.get("order_id"), "order");
    const requestType = text(data, "request_type", 20);
    const reason = text(data, "reason", 40);
    const details = text(data, "details", 2000, false);

    if (!REQUEST_TYPES.includes(requestType as (typeof REQUEST_TYPES)[number]))
      throw new InputError("Choose RETURN or REFUND.");
    if (!RETURN_REASONS.includes(reason as (typeof RETURN_REASONS)[number]))
      throw new InputError("Choose a valid reason.");

    const selectedIds = [...new Set(data.getAll("return_item").map((value) => id(value, "order item")))];
    if (!selectedIds.length)
      throw new InputError("Choose at least one item for this request.");
    if (selectedIds.length > 50)
      throw new InputError("Too many items selected.");

    const items = selectedIds.map((itemId) => ({
      order_item_id: itemId,
      quantity: integer(data.get(`return_quantity_${itemId}`), "Return quantity", 1, 1000000),
    }));

    const { error } = await client.rpc("customer_create_return_request", {
      p_order_id: orderId,
      p_request_type: requestType,
      p_reason: reason,
      p_details: details,
      p_items: items,
    });

    if (error) {
      if (error.code === "23505")
        return { ok: false, message: "This order already has an active return/refund request." };
      if (error.code === "22023") {
        if (error.message.includes("Payment must be confirmed"))
          return { ok: false, message: "Payment must be confirmed before you can request a return or refund." };
        if (error.message.includes("no longer eligible"))
          return { ok: false, message: "This order is no longer eligible for a return/refund request." };
        if (error.message.includes("Test orders"))
          return { ok: false, message: "Return requests are disabled for test orders." };
        return { ok: false, message: "Check the selected items and quantities, then try again." };
      }
      throw error;
    }

    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath("/admin/returns");
    return {
      ok: true,
      message: "Your return/refund request was submitted. KULTURA will review it before any refund is processed.",
    };
  } catch (error) {
    return safeFailure(error);
  }
}
