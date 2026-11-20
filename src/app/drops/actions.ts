"use server";

import { revalidatePath } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActionActor } from "@/lib/auth/guards";
import { getServerLocale } from "@/lib/i18n-server";
import { strictForm } from "@/lib/security/input";
import { id } from "@/lib/validation";

export async function setDropAlert(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["release_id", "mode"]);
    const releaseId = id(form.get("release_id"), "drop");
    const mode = form.get("mode");
    const { client, user } = await requireActionActor();
    const locale = await getServerLocale();
    const ka = locale === "ka";
    if (!user.email || !user.email_confirmed_at) {
      return { ok: false, message: ka ? "ჯერ დაადასტურე ანგარიშის ელფოსტა." : "Verify your account email first." };
    }
    if (mode === "subscribe") {
      const { error } = await client.from("drop_alerts").insert({ release_id: releaseId, user_id: user.id, locale });
      if (error && error.code !== "23505") return {
        ok: false,
        message: ka ? "ჩაწერა ვერ მოხერხდა. განაახლე გვერდი და სცადე კიდევ." : "Could not save the alert. Reload and try again.",
      };
      revalidatePath("/drops");
      return { ok: true, message: ka ? "შეტყობინების მოთხოვნა შენახულია." : "Your alert request is saved." };
    }
    if (mode === "cancel") {
      const { error } = await client.from("drop_alerts").delete().eq("release_id", releaseId).eq("user_id", user.id);
      if (error) return safeFailure(error);
      revalidatePath("/drops");
      return { ok: true, message: ka ? "შეტყობინების მოთხოვნა გაუქმდა." : "Your alert request was cancelled." };
    }
    return { ok: false, message: "Invalid request." };
  } catch (error) {
    return safeFailure(error);
  }
}
