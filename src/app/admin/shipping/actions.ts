"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth/guards";
import { safeFailure, type ActionState } from "@/lib/actions";
import { InputError, price, text } from "@/lib/validation";

export async function saveShippingSettings(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireActor(true);
    const shippingTotal = price(text(data, "shipping_total", 20));
    const freeShippingEnabled = data.get("free_shipping_enabled") === "on";
    const thresholdRaw = text(data, "free_shipping_threshold", 20, false);

    let freeShippingThreshold: number | null = null;
    if (freeShippingEnabled) {
      if (!thresholdRaw) {
        throw new InputError("Enter a free-shipping threshold or disable free shipping.");
      }
      freeShippingThreshold = price(thresholdRaw);
    }

    const { error } = await client.rpc("admin_save_checkout_settings", {
      p_shipping_total: shippingTotal,
      p_free_shipping_threshold: freeShippingThreshold,
    });

    if (error) throw error;

    revalidatePath("/admin/shipping");
    revalidatePath("/checkout");
    return { ok: true, message: "Shipping settings saved." };
  } catch (error) {
    return safeFailure(error);
  }
}
