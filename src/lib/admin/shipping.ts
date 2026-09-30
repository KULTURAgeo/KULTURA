import "server-only";
import { requirePage } from "@/lib/auth/guards";

export type ShippingSettings = {
  shippingTotal: number;
  freeShippingThreshold: number | null;
};

function parseSettings(value: unknown): ShippingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Shipping settings unavailable.");
  }

  const record = value as Record<string, unknown>;
  const shippingTotal = record.shipping_total;
  const freeShippingThreshold = record.free_shipping_threshold;

  if (
    typeof shippingTotal !== "number" ||
    !Number.isSafeInteger(shippingTotal) ||
    shippingTotal < 0 ||
    (freeShippingThreshold !== null &&
      (typeof freeShippingThreshold !== "number" ||
        !Number.isSafeInteger(freeShippingThreshold) ||
        freeShippingThreshold < 0))
  ) {
    throw new Error("Shipping settings unavailable.");
  }

  return { shippingTotal, freeShippingThreshold };
}

export async function adminShippingSettings(): Promise<ShippingSettings> {
  const { client } = await requirePage(true);
  const { data, error } = await client.rpc("checkout_get_shipping_settings");
  if (error) throw new Error("Shipping settings unavailable.");
  return parseSettings(data);
}

export { parseSettings };
