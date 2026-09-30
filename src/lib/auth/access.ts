import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { AccessError } from "../actions";

function authFailure(error: { status?: number; name?: string } | null) {
  return error &&
    (error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      error.name === "AuthSessionMissingError")
    ? "unauthenticated"
    : "unavailable";
}

export async function verifyActor(
  client: SupabaseClient<Database> | null,
  admin = false,
) {
  if (!client) throw new AccessError("unavailable");

  // getClaims verifies the signed access token without requiring an Auth-server
  // user lookup when the project uses asymmetric signing keys. The authenticated
  // Supabase client still carries the same verified session for RLS-protected DB calls.
  const { data, error } = await client.auth.getClaims();
  if (error) throw new AccessError(authFailure(error));

  const claims = data?.claims;
  const userId = claims?.sub;
  if (typeof userId !== "string" || !userId)
    throw new AccessError("unauthenticated");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,full_name,phone")
    .eq("id", userId)
    .single();
  if (profileError || !profile) throw new AccessError("unavailable");
  if (admin && profile.role !== "admin") throw new AccessError("forbidden");

  const email = typeof claims.email === "string" ? claims.email : undefined;
  return {
    client,
    user: { id: userId, email },
    profile,
  };
}
