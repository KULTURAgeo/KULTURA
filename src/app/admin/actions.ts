"use server";
import { strictForm } from "@/lib/security/input";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActionActor } from "@/lib/auth/guards";
import { productInput, variantInput, promoInput, text, id, version, InputError } from "@/lib/validation";
import { safeFailure, type ActionState } from "@/lib/actions";
import { processProductImage } from "@/lib/admin/image";
import { invalidateStorefrontCatalog } from "@/lib/catalog/invalidate";
import { notifyFulfillmentStatus } from "@/lib/notifications/order-notifications";
function refresh() {
    invalidateStorefrontCatalog();
    revalidatePath("/admin", "layout");
}
export async function saveProduct(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["name", "slug", "description", "price", "compare_at_price", "status", "featured", "is_drop", "category_id", "seo_title", "seo_description", "collections", "id", "updated_at"], ["collections"]);
        const { client } = await requireActionActor(true);
        const raw = data.get("id");
        const productId = raw ? id(raw) : null;
        const { product, collectionIds } = productInput(data);
        const { data: result, error } = await client.rpc("admin_save_product", { p_id: productId, p_expected_updated_at: productId ? version(data) : null, p_product: product, p_collection_ids: collectionIds });
        if (error)
            throw error;
        refresh();
        return { ok: true, message: "Product saved.", redirectTo: productId ? undefined : "/admin/products/" + result };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function archiveProduct(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "updated_at", "confirm_archive"], []);
        const { client } = await requireActionActor(true);
        if (data.get("confirm_archive") !== "on")
            throw new InputError("Confirm that this product should be archived.");
        const { error } = await client.from("products").update({ status: "archived" }).eq("id", id(data.get("id"))).eq("updated_at", version(data)).select("id").single();
        if (error)
            throw error;
        refresh();
        return { ok: true, message: "Product archived. It is no longer visible in the store." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function saveVariant(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["product_id", "id", "updated_at", "sku", "size", "color", "stock_quantity", "is_active"], []);
        const { client } = await requireActionActor(true);
        const productId = id(data.get("product_id"));
        const values = variantInput(data), variantId = data.get("id");
        const result = variantId ? await client.from("product_variants").update(values).eq("id", id(variantId)).eq("product_id", productId).eq("updated_at", version(data)).select("id").single() : await client.from("product_variants").insert({ ...values, product_id: productId }).select("id").single();
        if (result.error)
            throw result.error;
        refresh();
        return { ok: true, message: "Variant and inventory saved." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function uploadImage(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["product_id", "alt_text", "image"], []);
        const { client } = await requireActionActor(true);
        const productId = id(data.get("product_id"));
        const { data: product, error: productError } = await client.from("products").select("id").eq("id", productId).single();
        if (productError || !product)
            throw new InputError("Product unavailable.");
        const alt = text(data, "alt_text", 500, false);
        const file = data.get("image");
        if (!(file instanceof File))
            throw new InputError("Choose an image.");
        const buffer = await processProductImage(file);
        const path = productId + "/" + randomUUID() + ".webp";
        const { error } = await client.storage.from("product-images").upload(path, buffer, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
        if (error)
            throw error;
        const attached = await client.rpc("admin_attach_image", { p_product_id: productId, p_storage_path: path, p_alt_text: alt || null });
        if (attached.error) {
            await client.storage.from("product-images").remove([path]);
            throw attached.error;
        }
        refresh();
        return { ok: true, message: "Image uploaded." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function updateImage(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "product_id", "updated_at", "alt_text"], []);
        const { client } = await requireActionActor(true);
        const { error } = await client.from("product_images").update({ alt_text: text(data, "alt_text", 500, false) || null }).eq("id", id(data.get("id"))).eq("product_id", id(data.get("product_id"))).eq("updated_at", version(data)).select("id").single();
        if (error)
            throw error;
        refresh();
        return { ok: true, message: "Image description saved." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function removeImage(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "product_id", "updated_at"], []);
        const { client } = await requireActionActor(true);
        const { data: removed, error } = await client.from("product_images").delete().eq("id", id(data.get("id"))).eq("product_id", id(data.get("product_id"))).eq("updated_at", version(data)).select("storage_path").single();
        if (error)
            throw error;
        refresh();
        if (removed.storage_path) {
            const { error: cleanup } = await client.storage.from("product-images").remove([removed.storage_path]);
            if (cleanup)
                return { ok: true, message: "Image removed from the product. Storage cleanup failed; remove the unused file in the Storage dashboard." };
        }
        return { ok: true, message: "Image removed." };
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function moveImage(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "product_id", "updated_at", "direction"], []);
        const { client } = await requireActionActor(true);
        const productId = id(data.get("product_id")), imageId = id(data.get("id"));
        const direction = data.get("direction");
        if (direction !== "up" && direction !== "down")
            throw new InputError("Invalid image movement.");
        const { data: images, error } = await client.from("product_images").select("id").eq("product_id", productId).order("sort_position");
        if (error)
            throw error;
        const ids = images.map(image => image.id), index = ids.indexOf(imageId), target = index + (direction === "up" ? -1 : 1);
        if (index < 0 || target < 0 || target >= ids.length)
            throw new InputError("This image cannot move further.");
        const next = [...ids];
        [next[index], next[target]] = [next[target], next[index]];
        const result = await client.rpc("admin_reorder_images", { p_product_id: productId, p_ids: next, p_expected_ids: ids });
        if (result.error)
            throw result.error;
        refresh();
        return { ok: true, message: "Image order saved." };
    }
    catch (error) {
        return safeFailure(error);
    }
}


export async function advanceFulfillment(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["order_id", "updated_at", "next_status"], []);
        const { client } = await requireActionActor(true);
        const orderId = id(data.get("order_id"), "order");
        const expectedUpdatedAt = version(data);
        const nextStatus = text(data, "next_status", 30);

        if (nextStatus !== "processing" && nextStatus !== "shipped" && nextStatus !== "delivered")
            throw new InputError("Invalid fulfillment step.");

        const { error } = await client.rpc("admin_advance_fulfillment", {
            p_order_id: orderId,
            p_expected_updated_at: expectedUpdatedAt,
            p_next_status: nextStatus,
        });

        if (error) {
            if (error.code === "22023" && error.message.includes("must be paid"))
                return { ok: false, message: "This order must be marked paid by the payment gateway before fulfillment can start." };
            if (error.code === "22023")
                return { ok: false, message: "That fulfillment step is no longer available. Reload the order and try again." };
            throw error;
        }

        revalidatePath("/admin");
        revalidatePath("/admin/orders");
        revalidatePath("/admin/orders/" + orderId);
        await notifyFulfillmentStatus(client, orderId, nextStatus);
        return { ok: true, message: "Fulfillment status updated." };
    }
    catch (error) {
        return safeFailure(error);
    }
}


export async function savePromo(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
    strictForm(data, ["id", "updated_at", "code", "kind", "amount", "minimum_subtotal", "maximum_discount", "max_uses", "starts_at", "expires_at", "is_active"], []);
        const { client } = await requireActionActor(true);
        const rawId = data.get("id");
        const promoId = rawId ? id(rawId, "promo") : null;
        const promo = promoInput(data);
        const { data: result, error } = await client.rpc("admin_save_promo", {
            p_id: promoId,
            p_expected_updated_at: promoId ? version(data) : null,
            p_promo: promo,
        });
        if (error) {
            if (error.code === "23505")
                return { ok: false, message: "That promo code already exists." };
            throw error;
        }
        revalidatePath("/admin/promos");
        revalidatePath("/checkout");
        return {
            ok: true,
            message: promoId ? "Promo code updated." : "Promo code created.",
            redirectTo: promoId ? undefined : "/admin/promos/" + result,
        };
    }
    catch (error) {
        return safeFailure(error);
    }
}
