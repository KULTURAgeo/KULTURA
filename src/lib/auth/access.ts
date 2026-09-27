import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { AccessError } from "../actions";
export async function verifyActor(client: SupabaseClient<Database> | null, admin = false) {
    if (!client)
        throw new AccessError("unavailable");
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user)
        throw new AccessError("unauthenticated");
    const { data: profile, error: profileError } = await client.from("profiles").select("id,role,full_name,phone").eq("id", user.id).single();
    if (profileError || !profile)
        throw new AccessError("unavailable");
    if (admin && profile.role !== "admin")
        throw new AccessError("forbidden");
    return { client, user, profile };
}
