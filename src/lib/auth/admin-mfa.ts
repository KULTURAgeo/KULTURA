import "server-only";
import { AccessError } from "@/lib/actions";
import { createSessionClient } from "@/lib/supabase/session";
import { verifyActor } from "./access";

// Enrollment and code entry need identity and role before the second factor exists.
// All protected admin operations continue to use requireActor(true).
export async function adminMfaActor(writable = false) {
  const actor = await verifyActor(await createSessionClient(writable));
  if (actor.profile.role !== "admin") throw new AccessError("forbidden");
  return actor;
}

