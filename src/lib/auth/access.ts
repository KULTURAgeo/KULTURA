import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { AccessError } from "../actions";

export async function verifyActor(client: SupabaseClient<Database> | null, admin = false) {
    if (!client)
        throw new AccessError("unavailable");
    const { data: { user }, error } = await client.auth.getUser();
    if (error)
        throw new AccessError(error.status === 400 || error.status === 401 || error.status === 403 || error.name === "AuthSessionMissingError" ? "unauthenticated" : "unavailable");
    if (!user)
        throw new AccessError("unauthenticated");
    const { data: profile, error: profileError } = await client.from("profiles").select("id,role,full_name,phone").eq("id", user.id).single();
    if (profileError || !profile)
        throw new AccessError("unavailable");
    if (admin && profile.role !== "admin")
        throw new AccessError("forbidden");
    if (admin && !(await hasVerifiedAdminSession(client, user.id)))
        throw new AccessError("mfa_required");
    return { client, user, profile };
}

export async function hasVerifiedAdminSession(client: SupabaseClient<Database>, userId: string) {
    const { data, error } = await client.auth.getClaims();
    if (error || data?.claims.sub !== userId) throw new AccessError("unavailable");
    return data.claims.aal === "aal2";
}

