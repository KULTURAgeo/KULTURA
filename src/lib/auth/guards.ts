import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "../supabase/session";
import { verifyActor } from "./access";
import { AccessError } from "../actions";

const requireActorForRender = cache(async (admin: boolean) =>
  verifyActor(await createSessionClient(), admin),
);

export async function requireActor(admin = false) {
  return requireActorForRender(admin);
}

export async function requirePage(admin = false) {
  try {
    return await requireActor(admin);
  } catch (error) {
    if (error instanceof AccessError && error.code === "forbidden")
      redirect("/account?restricted=1");
    if (error instanceof AccessError && error.code === "unauthenticated")
      redirect("/login?next=" + (admin ? "/admin" : "/account"));
    throw error;
  }
}
