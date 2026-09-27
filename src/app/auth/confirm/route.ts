import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
export async function GET(request: NextRequest) {
    const token_hash = request.nextUrl.searchParams.get("token_hash");
    const type = request.nextUrl.searchParams.get("type");
    let destination = "/login?auth_error=1";
    try {
        const client = await createSessionClient(true);
        if (client && token_hash && token_hash.length <= 2048 && (type === "email" || type === "recovery")) {
            const { error } = await client.auth.verifyOtp({ token_hash, type });
            if (!error)
                destination = type === "recovery" ? "/reset-password" : "/account";
        }
    }
    catch { }
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
}
