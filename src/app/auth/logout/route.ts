import { logout } from "@/app/auth/actions";

// A dedicated route keeps the proxy exemption scoped to sign-out alone.
export async function POST() {
  const result = await logout();
  return new Response(null, {
    status: 303,
    headers: {
      Location: result.ok ? "/login" : "/account?logout_error=1",
      "Cache-Control": "private, no-store",
    },
  });
}
