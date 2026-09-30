"use server";

import { revalidatePath } from "next/cache";
import { safeFailure, type ActionState } from "@/lib/actions";
import { requireActor } from "@/lib/auth/guards";
import { id, InputError, text, version } from "@/lib/validation";

const RETURN_STATUSES = ["requested", "under_review", "approved", "rejected", "resolved"] as const;

export async function updateReturnRequest(
  _state: ActionState,
  data: FormData,
): Promise<ActionState> {
  try {
    const { client } = await requireActor(true);
    const requestId = id(data.get("request_id"), "return request");
    const expectedUpdatedAt = version(data);
    const status = text(data, "status", 30);
    const adminNote = text(data, "admin_note", 2000, false);

    if (!RETURN_STATUSES.includes(status as (typeof RETURN_STATUSES)[number]))
      throw new InputError("Choose a valid return status.");

    const { error } = await client.rpc("admin_update_return_request", {
      p_request_id: requestId,
      p_expected_updated_at: expectedUpdatedAt,
      p_status: status,
      p_admin_note: adminNote,
    });

    if (error) {
      if (error.code === "40001")
        return { ok: false, message: "This request changed. Reload the page before saving." };
      if (error.code === "22023")
        return { ok: false, message: "That status change is not allowed from the current request state." };
      throw error;
    }

    revalidatePath("/admin/returns");
    revalidatePath(`/admin/returns/${requestId}`);
    return { ok: true, message: "Return/refund request updated." };
  } catch (error) {
    return safeFailure(error);
  }
}
