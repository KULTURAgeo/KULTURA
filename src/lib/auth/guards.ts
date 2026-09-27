import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "../supabase/session";
import { verifyActor } from "./access";
import { AccessError } from "../actions";
export async function requireActor(admin = false) { return verifyActor(await createSessionClient(), admin); }
export async function requirePage(admin = false) {
    try {
        return await requireActor(admin);
    }
    catch (error) {
        if (error instanceof AccessError && error.code === "forbidden")
            redirect("/account?restricted=1");
        if (error instanceof AccessError && error.code === "unauthenticated")
            redirect("/login?next=" + (admin ? "/admin" : "/account"));
        throw error;
    }
}
