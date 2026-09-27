import { InputError } from "./validation";
export type ActionState = {
    ok?: boolean;
    message?: string;
    redirectTo?: string;
};
export class AccessError extends Error {
    constructor(public code: "unauthenticated" | "forbidden" | "unavailable") { super(code); }
}
export function safeFailure(error: unknown): ActionState {
    if (error instanceof InputError)
        return { ok: false, message: error.message };
    if (error instanceof AccessError)
        return { ok: false, message: error.code === "unauthenticated" ? "Please sign in again." : error.code === "forbidden" ? "You do not have permission to perform this action." : "This service is temporarily unavailable." };
    if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "23505")
            return { ok: false, message: "That slug, SKU, variant combination or default address already exists." };
        if (error.code === "40001" || error.code === "PGRST116")
            return { ok: false, message: "This record changed or is unavailable. Reload it before saving again." };
        if (error.code === "23503")
            return { ok: false, message: "A selected related record is unavailable. Reload and try again." };
    }
    return { ok: false, message: "We could not complete this request. Please try again." };
}
