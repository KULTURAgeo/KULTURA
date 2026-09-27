# Authentication/session repair

The existing account guard redirected every exception to login. A valid Supabase user with an unavailable/missing profile therefore appeared logged out. The code also had no browser SSR client and used HTTP-only cookies, which prevented a browser client from reading or refreshing the session.

## Changes

- Added a singleton browser client using @supabase/ssr, cookie-backed persistence and automatic refresh. The root layout passes only the validated public Supabase URL and publishable/anon key. Existing environment variable names are unchanged; no private key is exposed.
- Browser and server share host-only, Path=/, SameSite=Lax cookies, Secure over HTTPS. Cookies intentionally are not HTTP-only: this is necessary for Supabase's browser SSR client. Existing HTTP-only cookies are replaced by server-side login/confirmation responses.
- Kept password login in a Server Action, where the SSR SDK writes every cookie chunk before returning. Successful login uses an allowlisted next destination or /account and a full document replacement after the action completes. This avoids reusing prefetched logged-out Router Cache entries. Logout and password update use the same fresh-navigation behavior.
- Proxy verifies claims, forwards rotated cookies into the request and response, and preserves refresh cache headers. Server guards still call getUser and use the database profile for roles; no authorization trusts getSession or user metadata.
- Only missing/invalid authentication redirects to login. Profile/database/Auth availability failures now reach the error boundary. Admin denial still returns the customer to /account?restricted=1.
- Registration, code exchange, token-hash confirmation and recovery retain the existing production SITE_URL configuration. Password reset now handles a failed global sign-out instead of reporting success.

## Verification

Production build, TypeScript, lint and the existing 128 checks pass. New test: pnpm test:auth exercises 18 integration regressions with the real SSR SDK, actual application actions/guards/proxy/callbacks, and simulated Supabase HTTP/cookies. It covers server-to-browser and browser-to-server persistence, fresh server requests, expired-token refresh, cache headers, profile/service failures, admin denial, safe redirects, registration/PKCE, confirmation, recovery/password update and logout.

The test is not a live Supabase or real-browser certification. Automatic execution approval rejected starting the configured local Next.js test server; a live production URL/account has not been supplied. No production credentials or customer data were used. The production incident's exact trigger is therefore not confirmed.

## Production rollout

1. Deploy this revision on Vercel. Keep SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY pointing to the same project. SITE_URL must be the exact public HTTPS origin being used for authentication, not a different preview or www hostname.
2. In Supabase Auth URL configuration, use that same Site URL and allow /auth/callback and /auth/callback?next=/reset-password on that origin.
3. Sign in again to replace legacy cookies, then open /account and reload. Check /account/orders, logout, confirmation and password recovery on the same host. Never copy real cookies or tokens into logs/chat.
4. If the account error boundary appears, verify that the six existing migrations are applied and that the confirmed Auth user's UUID has a public.profiles row. The initial migration installs both the signup trigger and an existing-user backfill. Missing tables/profiles or broken policies are database provisioning errors; do not weaken RLS or bypass role checks to hide them.
5. Confirm the login response emits sb-...-auth-token cookies and the subsequent account request includes them. Check browser cookie warnings and Vercel logs if it does not. Cookies are host-only, so preview, apex and www sessions are distinct.

References: https://supabase.com/docs/guides/auth/server-side/creating-a-client and https://supabase.com/docs/guides/auth/server-side/advanced-guide
