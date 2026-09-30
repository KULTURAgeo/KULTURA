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

  let userId: string | undefined;
  let email: string | undefined;

  // Current Supabase clients can verify the signed access token locally (or via
  // cached JWKS) with getClaims, avoiding an Auth-server user lookup. Keep a
  // getUser fallback for compatible test/legacy clients that do not expose it.
  if (typeof client.auth.getClaims === "function") {
    const { data, error } = await client.auth.getClaims();
    if (error) throw new AccessError(authFailure(error));
    const claims = data?.claims;
    userId = typeof claims?.sub === "string" ? claims.sub : undefined;
    email = typeof claims?.email === "string" ? claims.email : undefined;
  } else {
    const { data, error } = await client.auth.getUser();
    if (error) throw new AccessError(authFailure(error));
    userId = data.user?.id;
    email = data.user?.email;
  }

  if (!userId) throw new AccessError("unauthenticated");

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role,full_name,phone")
    .eq("id", userId)
    .single();
  if (profileError || !profile) throw new AccessError("unavailable");
  if (admin && profile.role !== "admin") throw new AccessError("forbidden");

  return {
    client,
    user: { id: userId, email },
    profile,
  };
}
