import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { safeNext } from "@/lib/validation";
export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    let destination = "/login?auth_error=1";
    try {
        const client = await createSessionClient(true);
        if (client && code && code.length < 2048) {
            const { error } = await client.auth.exchangeCodeForSession(code);
            if (!error)
                destination = request.nextUrl.searchParams.get("next") === "/reset-password" ? "/reset-password" : safeNext(request.nextUrl.searchParams.get("next"));
        }
    }
    catch { }
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
}
