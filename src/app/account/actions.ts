"use server";
import { strictForm } from "@/lib/security/input";
import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { text, id, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
export async function updateProfile(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["full_name", "phone"], []);
        const { client, user } = await requireActionActor();
        const { error } = await client.from("profiles").update({ full_name: text(data, "full_name", 200, false), phone: text(data, "phone", 40, false) || null }).eq("id", user.id).select("id").single();
        if (error)
            throw error;
        revalidatePath("/account");
        return { ok: true, message: "Profile saved." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function saveAddress(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "recipient_name", "phone", "country_code", "city", "address_line_1", "address_line_2", "postal_code", "is_default"], []);
        const { client } = await requireActionActor();
        const rawId = data.get("id");
        const addressId = rawId ? id(rawId) : null;
        const country = text(data, "country_code", 2);
        if (!/^[A-Z]{2}$/.test(country))
            throw new InputError("Use a two-letter country code, such as GE.");
        const address = { recipient_name: text(data, "recipient_name", 200), phone: text(data, "phone", 40), country_code: country, city: text(data, "city", 120), address_line_1: text(data, "address_line_1", 300), address_line_2: text(data, "address_line_2", 300, false) || null, postal_code: text(data, "postal_code", 30, false) || null, is_default: data.get("is_default") === "on" };
        const { error } = await client.rpc("customer_save_address", { p_id: addressId, p_address: address });
        if (error)
            throw error;
        revalidatePath("/account/addresses");
        return { ok: true, message: "Address saved." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function deleteAddress(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id"], []);
        const { client, user } = await requireActionActor();
        const { error } = await client.from("addresses").delete().eq("id", id(data.get("id"))).eq("profile_id", user.id).select("id").single();
        if (error)
            throw error;
        revalidatePath("/account/addresses");
        return { ok: true, message: "Address removed." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
