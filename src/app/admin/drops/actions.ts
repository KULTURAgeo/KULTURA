"use server";

import { revalidatePath } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActionActor } from "@/lib/auth/guards";
import { dropTime } from "@/lib/drops";
import { dropAlertDeliveryConfigured, sendDropAlertBatch } from "@/lib/notifications/drop-alerts";
import { strictForm } from "@/lib/security/input";
import { id, InputError, text, version } from "@/lib/validation";

export async function saveRelease(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["release_id", "updated_at", "title", "title_ka", "launches_at", "published", "archived"]);
    const { client } = await requireActionActor(true);
    const launchesAt = dropTime(text(form, "launches_at", 16));
    if (!launchesAt) throw new InputError("Enter a valid launch date and time in Georgia time.");
    const values = {
      title: text(form, "title", 120), title_ka: text(form, "title_ka", 120, false),
      launches_at: launchesAt, published: form.get("published") === "on", archived: form.get("archived") === "on",
    };
    if (values.archived && Date.parse(launchesAt) > Date.now()) throw new InputError("Only a launched drop can be archived.");
    const current = form.get("release_id");
    const { data, error } = current
      ? await client.from("drop_releases").update(values).eq("id", id(current, "drop"))
        .eq("updated_at", version(form)).select("id").single()
      : await client.from("drop_releases").insert(values).select("id").single();
    if (error) return safeFailure(error);
    revalidatePath("/drops");
    revalidatePath("/admin/drops");
    return { ok: true, message: "Drop saved.", redirectTo: "/admin/drops?edit=" + data.id };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function changeReleaseProduct(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["release_id", "product_id", "mode"]);
    const { client } = await requireActionActor(true);
    const releaseId = id(form.get("release_id"), "drop");
    const productId = id(form.get("product_id"), "product");
    const mode = form.get("mode");
    if (mode !== "add" && mode !== "remove") throw new InputError("Invalid request.");
    const { error } = mode === "add"
      ? await client.from("drop_release_products").insert({ release_id: releaseId, product_id: productId })
      : await client.from("drop_release_products").delete().eq("release_id", releaseId).eq("product_id", productId);
    if (error && error.code !== "23505") return safeFailure(error);
    revalidatePath("/drops");
    revalidatePath("/admin/drops");
    return { ok: true, message: mode === "add" ? "Product added to drop." : "Product removed from drop." };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function sendReleaseAlerts(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["release_id"]);
    await requireActionActor(true);
    const releaseId = id(form.get("release_id"), "drop");
    if (!dropAlertDeliveryConfigured()) return { ok: false, message: "A verified email sender is required. Alert requests are still queued." };
    const result = await sendDropAlertBatch(releaseId);
    if (!result) return { ok: false, message: "Email delivery is unavailable." };
    if (!result.claimed) return { ok: true, message: "No alerts are ready to send." };
    return { ok: result.claimed === result.sent, message: `Sent ${result.sent} of ${result.claimed} alerts. Pending alerts can be retried in five minutes.` };
  } catch (error) {
    return safeFailure(error);
  }
}
