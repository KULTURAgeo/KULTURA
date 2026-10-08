# KULTURA security hardening — completed 8 October 2026

This review and implementation were made on `security/production-hardening`, based on production `main` commit `52b15fd262755ae7ae51bbb88b7c5853d4b7f0b6`. They have **not** been applied to hosted Supabase or deployed to Vercel. Coordinate the SQL and application release as described below. Do not run bootstrap.

## Findings and corrections

| Severity | Finding | Implementation |
| --- | --- | --- |
| Critical | No confirmed critical exploit found in the reviewed source. | This is not a penetration-test certification or a guarantee about the live configuration. |
| High | Replaying checkout could create multiple real orders. The old RPC also had a NULL-cart validation gap. | New `checkout_submit_order` validates JSON, requires a request UUID, binds it to the authenticated customer and exact payload, serializes submissions and returns the original order on retry. The legacy RPC is no longer executable by customers. |
| High | Real orders did not consume promo usage; simultaneous redemptions could bypass usage limits. | Lock promo rows, validate via the existing resolver, and conditionally increment usage in the same transaction as the order. Historical non-test orders are counted without reducing existing counts. |
| High | Customers could call notification preparation and delivery-recording RPCs directly. | Revoke customer/anonymous execution; grant only backend `service_role`. Validate events against actual order state. Queue events in the order transaction. A per-channel atomic claim prevents duplicate sends. |
| High | Sensitive application requests had no shared abuse budget. | Atomic expiring Redis counters for IP/account/customer/admin scopes, plus database budgets for direct customer writes, order submission, promo quotes and return requests. Production rejects writes if the limiter is missing or unavailable. |
| Medium | CSP only restricted framing, forms, base URLs and objects. | Fresh per-request script nonces, strict-dynamic, no script unsafe-inline or production unsafe-eval, explicit resource origins, protected inline JSON-LD and analytics bootstraps. |
| Medium | Several actions ignored unexpected keys, duplicates or malformed quantities. | Strict reusable form/object/cart validators, fixed field allowlists, duplicate rejection, bounded text/arrays and strict direct-RPC JSON checks. Browser cart repair remains local; server cart requests are validated. |
| Medium | Additional CSRF defense depended only on framework defaults. | SameSite cookies retained; action-level exact Origin checks and proxy rejection of absent/foreign origins for mutations. No wildcard CORS was added. |
| Medium | Analytics explicitly sent full URLs and could send private page views. | Explicit page locations omit query/hash; private routes do not load analytics on a fresh visit or emit manual page views; Meta automatic configuration disabled. Provider-side automatic collection must also be reviewed. |
| Medium | Admin test orders could be created on production. | Database setting defaults off; UI/action require explicit staging opt-in and reject Vercel Production. No customer order is marked paid. |
| Low | Callback redirects used request origin; duplicate search parameters could cause errors; nonce rendering changed 404 streaming behavior. | Callback origins restricted to configured production/exact Vercel hosts, defensive search parsing and early unknown-route validation. Existing 404 design retained. |

## Architecture and retained protections

Next.js 16 App Router uses Server Actions; Supabase SSR cookies are shared correctly between browser, proxy and server. Page and action authorization verifies `auth.getUser()` and the database profile role, independently of middleware. Public catalog reads remain behind the catalog repository. Database RLS and column grants continue to protect profiles, addresses, products/variants/images, categories/collections, orders/items, promos, wishlist and returns. A customer cannot assign a role, set a product price/stock, mark an order paid/shipped or read another customer's order.

Application database operations use Supabase parameterized filters/RPC arguments. No customer-controlled raw SQL, command execution, template execution, LDAP, XML parser or NoSQL engine was found in the production request path. Search strings cannot introduce PostgREST filter operators. User content stays plain text; React escapes it. JSON-LD escapes `<` before its unavoidable script serialization. Email HTML escapes interpolated values. XML request bodies are rejected before application parsing.

Uploads already decode and verify actual JPEG/PNG/WebP content, reject animation, limit input to 3 MiB/25 megapixels and re-encode to WebP with generated filenames. Storage writes require a database-verified admin. The `product-images` bucket is intentionally public, including images of unpublished products; do not put private documents there. Image URL mapping and Next Image remote patterns restrict remote image fetches to the configured product bucket. Provider API destinations are fixed, not taken from customer inputs.

Supabase handles password hashing; no application password storage or custom encryption was introduced. HTTPS origins are required by deployment validation; Vercel supplies TLS. HSTS, nosniff, framing protection, referrer policy, Permissions-Policy and compatible COOP are retained/applied. No blanket CORP was added to public product/SEO assets that may legitimately be used cross-origin. Supabase SSR cookies remain `Secure` on HTTPS and `SameSite=Lax`. They intentionally remain browser-readable: this SSR architecture requires browser access for session refresh. Do not switch to HttpOnly without redesigning the auth architecture.

The only GET operations that exchange authentication state remain the Supabase PKCE/email-token callbacks. These provider flows require a one-time code/token; they are not general-purpose mutation endpoints. Return paths are allowlisted, callback responses are not cached and use no-referrer. Other mutations use POST Server Actions.

## SQL to apply

Apply **only** `supabase/migrations/20261007000100_security_hardening.sql` after the existing migrations. It is a forward migration, intended to run once. It runs in a transaction and does not erase existing orders/products or recreate bootstrap.

It adds:

- Private RLS-enabled `request_limits` and `checkout_requests` tables with primary keys and ownership/deletion foreign keys.
- RLS on existing `private.checkout_settings`, plus `test_checkout_enabled boolean NOT NULL DEFAULT false`.
- `public.checkout_submit_order(uuid,jsonb,jsonb,text)` and its ACL; revokes the old checkout entry point from customers.
- Database request budgets, strict JSON checks, address/wishlist quotas (50/500), customer write triggers and strengthened existing address/product/promo/return RPC validation.
- Backend-only notification preparation/recording/claiming, two delivery-claim timestamps, state checks and an order-event queue trigger.
- A test-order insertion guard and historical promo-use reconciliation.

Existing customer ownership and admin-only RLS policies are retained. New private tables grant no access to `anon` or `authenticated`; security-definer helpers use an empty search path and explicit grants. Generated public TypeScript types are updated.

After applying, run **`supabase/verify-security.sql`** in SQL Editor. Every returned `passed` should be true. This script checks RLS, sensitive column privileges, RPC grants, notification trigger, sandbox setting and the product-image bucket. It is read-only. The same verification SQL runs in the local database tests.

### Release sequence

1. Create a separate staging Supabase project with the existing migrations and this new migration. Use test data and a separate staging Redis database. Do not connect staging to the production database.
2. Configure the variables below in Vercel Preview, deploy this branch and run the hosted smoke checks below.
3. Take/confirm a current Supabase backup and choose a short production maintenance window. The migration revokes the old checkout/notification RPC grants: **the old app cannot submit orders after this migration until the new app is live**.
4. In production Supabase SQL Editor, open a new query, paste the complete new migration, and Run. Then run `verify-security.sql` and inspect every result.
5. Configure Production variables in Vercel and deploy the new application immediately. `build:vercel` validates required configuration. Do not publish this build with missing Redis configuration; writes intentionally fail closed.
6. Run the hosted checks below, inspect sanitized application logs and end the maintenance window.
7. Do not roll back to the old application after this migration: its checkout RPC is revoked. Prefer a forward code fix. Do not restore unsafe public notification grants to work around deployment issues.

No hosted schema inspection or SQL execution was performed in this task; these steps are required before production is hardened.

## Vercel environment variables

Use `.env.example` as the complete template. Never paste secrets into source, browser props, a public-prefix variable or this report.

| Variable | Requirement / purpose |
| --- | --- |
| `SITE_URL` | Existing required exact HTTPS public origin; production is currently `https://kultura-liart.vercel.app`. Use a fixed staging origin in Preview. |
| `SUPABASE_URL` | Existing required project HTTPS URL. Public by design. |
| `SUPABASE_PUBLISHABLE_KEY` | Existing required publishable/legacy anon key; deliberately public. Never put a privileged key here. |
| `UPSTASH_REDIS_REST_URL` | **New, required** Production/Preview: HTTPS Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | **New, required secret** with EVAL/INCR/EXPIRE/TTL access for rate counters. Use a separate database/credential per environment. |
| `RATE_LIMIT_HMAC_KEY` | **New, required secret**, at least 32 random characters; generate 32 random bytes and encode as hex. IPs/emails are represented by HMAC keys in Redis, not stored raw. |
| `SUPABASE_SECRET_KEY` | **New, backend only**, required if email/SMS sending is configured. Prefer a dedicated Supabase secret key for the notification backend. The key remains privileged: tightly restrict its Vercel scope. |
| `ENABLE_TEST_CHECKOUT` | Default `false`; Production must stay false. Isolated staging also needs the private SQL setting enabled. |
| `RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM` | Existing optional transactional email settings; verified sending domain required. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Existing optional transactional SMS settings. |
| `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` | Existing optional SMS sender; configure at least one if enabling SMS. |
| `GOOGLE_ANALYTICS_ID`, `META_PIXEL_ID` | Existing optional public analytics identifiers. Only validated IDs are sent to the browser. |
| `GOOGLE_SITE_VERIFICATION` | Existing optional public Search Console verification value. |
| `SITE_INDEXABLE` | Existing indexing opt-in, false until launch checks are complete; Preview stays noindex. |
| `ENABLE_EXPERIMENTAL_COREPACK` | Existing Vercel build setting, `1`, to honor pinned pnpm. |

Vercel provides `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` and `VERCEL_BRANCH_URL`; do not manually forge them. Exact deployment/branch hosts are used for Preview Origin checks. Custom preview aliases must match `SITE_URL` or a provided exact Vercel host; arbitrary aliases/wildcards are not accepted.

Generate the rate secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, put its output directly into Vercel's secret field and do not commit it. No existing credential was found that demonstrably requires rotation. The scans are heuristic; rotate any credential previously shared outside trusted systems even if it is absent from this checkout.

## Manual provider configuration

- Supabase Auth: keep email confirmation enabled, set minimum password length to 12, enable leaked-password protection where available, restrict Site URL/redirect URLs to real domains and review session lifetime. Configure production SMTP independently of application Resend notifications.
- Supabase Auth rate limits protect the **direct public Auth API**, which bypasses Next.js. Review login/signup/reset limits and email quotas there. App limits alone are not a replacement. Supabase-hosted CAPTCHA needs a matching browser-token integration; **do not enable it blindly in the dashboard**, because this app does not currently collect CAPTCHA tokens. That integration remains follow-up work.
- Enable MFA for GitHub/Vercel/Supabase operator accounts and review who has deployment/database access. Application administrators are server-authorized, but in-app MFA enrollment/challenge enforcement is not implemented by this change.
- Review Vercel firewall/bot controls for high-volume public reads. Persistent application limits cover Server Actions; the public storefront and direct Supabase read API remain publicly readable. No browser-supplied header is accepted as an IP outside Vercel; other hosts require their own trusted-proxy configuration.
- Review GA4 enhanced-measurement history/form collection and Meta automatic events/advanced matching. Explicit application tracking is restricted, but consented third-party JavaScript is still a trusted party. Live analytics accounts were not tested. Preview toolbar resources are not broadly allowlisted by CSP.
- Notifications: configure the server secret and providers together. Pending events are preserved in the database if sending is unconfigured. There is no background retry worker. A claimed/failed/uncertain send is not automatically retried: inspect the provider before manually scheduling a retry, especially for SMS, to avoid duplicate customer messages.

## Behavior, limits and tradeoffs

New customer orders remain **payment pending / fulfillment unfulfilled**, with no `paid_at` and `is_test=false`. Prices, stock, subtotal, promo, shipping and final total are computed from trusted database rows. Browser payloads contain identifiers/quantities and delivery data, not purchase prices. A failed request preserves the cart/form. Only persisted success clears the cart and navigates to the confirmation page. A stable request ID survives a lost response/page refresh; successful completion removes it so a later intentional repeat purchase can create a new order.

One accepted real order consumes one promo use, including unpaid/cancelled orders. An identical retry does not consume another use. Cancelling does not automatically restore promo usage. Review this business policy before release; no payment provider currently exists to define a paid-only redemption lifecycle.

Unpaid orders still **do not reserve or decrement inventory**. Stock is checked and locked while creating the snapshot, but multiple pending orders can exceed eventual stock collectively. Reservation/payment/fulfillment reconciliation must be implemented before accepting money; this change does not simulate payment or add a gateway.

Limits: proxy mutations 90/IP/minute; auth-page mutations 12/IP/minute; auth action 12/IP/minute and 12/account/15 minutes; authenticated actions 60/customer/minute or 120/admin/minute; direct real orders 10/customer/hour, promo quotes 60/customer/hour, returns 20/customer/hour, profile-data writes 300/customer/minute. These are fixed windows, not a global bot-elimination guarantee. Database budgets roll back with failed transactions, so provider/API abuse controls are still required for repeated invalid direct-RPC calls. Proxy rate failures return HTTP 429 plus Retry-After; direct RPC budgets use PostgREST `PT429`. Inside Server Actions, caught business/rate failures use the normal action-result error message transport rather than exposing SQL errors.

Nonce CSP requires dynamic HTML and private/no-store responses. Public catalog data caching remains; static image assets retain normal caching. Expect increased Vercel rendering cost compared with static/ISR HTML. Inline **style attributes** remain allowed because existing React/anime.js transforms and positioning require them. Style elements require nonces in production. Production scripts never allow unsafe-inline or unsafe-eval; development-only eval is retained for Next's debugger. No animation/layout/CSS redesign was made.

## Verification and remaining risks

Final local results: `pnpm check` passed (207 database/catalog/auth/production/security checks, plus logo and generated-type checks); TypeScript and lint passed; `next build` passed. The final compiled build passed 29 HTTP checks, including fresh CSP nonces and CSRF rejection. Secret scans passed for 223 repository text files and 28 client chunks. The reachable Git history scan examined 438 text blobs without a match. These are heuristic scans, not proof that every possible secret is absent.

The verified user story is: a customer can browse the unchanged storefront, submit validated cart/delivery data, create one owned unpaid order with trusted totals, and receive a confirmation without exposing another customer's data. Evidence boundaries are:

| Boundary | Evidence | Remaining verification |
| --- | --- | --- |
| Browser → public UI | Compiled homepage, both globe scenes, cart drawer, empty catalog and mobile login inspected; no observed CSP errors. | Hosted configuration and authenticated screens. |
| Request → Server Action | Real proxy HTTP checks; strict action/auth regression tests with simulated provider transport. | Hosted cookies, shared Redis and provider responses. |
| Action → database | Executable PGlite migrations, RLS, ownership, trusted totals, quantities, promo consumption and replay tests passed. | Hosted Supabase/PostgREST and multi-connection races. |
| Result → confirmation | Existing checkout regression tests and success-only cart clearing/redirect logic checked. | Full authenticated browser purchase on isolated staging. |

Browser screenshots are retained locally in `qa/security-phone.png`, `qa/security-scene.png` and `qa/security-mobile-login.png`. Temporary mobile viewport overrides were reset after verification.

Recorded evidence is in `qa/`. TypeScript, lint, database/catalog/cart/auth regression suites, new security checks, generated-type drift checks, logo decoding, production build and production HTTP checks are run locally. Local auth tests use the real Supabase SSR SDK with simulated provider responses. Database tests execute migrations and RLS in PGlite; they are not hosted Supabase/PostgREST or multi-connection concurrency tests.

Browser checks use the compiled production build: desktop homepage/scroll scenes/both chrome globe logos, navigation, lazy cart drawer, empty storefront, mobile login layout and safe service-unavailable form behavior. No CSP console errors were observed on these tested surfaces. Full authenticated browser checkout with the extra local provider fixture was blocked by automatic execution approval (approval required but unavailable for that invocation). It was not worked around; hosted end-to-end login/checkout/admin checks remain required.

The production dependency audit reported **zero advisories**. The complete development graph reported one high advisory for transitive `braces@3.0.3` through ESLint/fast-glob: **GHSA-vfj7-8cjw-p6xm**. Although the registry audit suggests `>=3.0.4`, querying that version returned “No matching version found”; the GitHub advisory listed no released fix at review time. No fictitious version, incompatible override or major upgrade was added. The affected path is development lint glob processing, not a customer request handler. Keep untrusted build execution isolated and update when a tested release is available.

The repository and built-browser scans found no exposed private credentials. A read-only scan of 438 reachable historical text blobs found no matching secret patterns, with no oversized text blobs skipped. This does not cover unreachable/remote-only Git objects, external logs, screenshots or every possible credential format.

**Assessment: 7/10 for the prepared implementation**, a qualitative review score rather than certification. The live production deployment is not assigned this score until the migration, Redis/provider configuration and hosted checks are completed. Remaining gaps include in-app administrator MFA, CAPTCHA integration, live multi-connection/load testing, the development-only dependency advisory, payment/inventory reservations, notification retry operations and verification of actual hosted settings.

### Required hosted smoke checks

1. Run `verify-security.sql`; confirm all checks pass and `test_checkout_enabled=false` on production.
2. Register/confirm a test customer, log in, refresh `/account`, log out, request a reset and verify the recovery flow. Use a separate second customer to test order/address isolation.
3. Add quantity 2–3 of an available variant, apply a configured staging promo, submit an unpaid order and verify exact snapshots/totals on confirmation and history. Retry the same request ID: one order/one promo use. Test stock exhaustion and expired/exhausted promo failures without clearing the cart.
4. Check unauthorized direct Supabase writes and notification RPC calls remain denied. Perform concurrent final-use promo submissions against staging PostgreSQL; only the permitted number may commit.
5. Verify admin product/image/inventory/shipping/promo/return edits, including stale-version conflicts. Test private storage permissions and verify no upload is executable.
6. In Preview/Production, check CSP and cookies, both logo scenes, mobile navigation, cart, consented analytics and no secret values in downloaded client chunks. Verify one email/SMS delivery per order event using configured test recipients/provider modes before real recipients.
7. Confirm shared Redis counters across instances, 429/Retry-After at the proxy and safe 503 behavior if Redis is unavailable. Avoid load testing production with real customer accounts.

## References

- [Next.js nonce CSP and dynamic rendering](https://nextjs.org/docs/app/guides/content-security-policy)
- [Supabase SSR advanced guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Vercel trusted forwarding headers](https://vercel.com/docs/headers/request-headers)
- [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

## Changed files

The complete change manifest is recorded in `qa/security-changed-files.txt`. Main implementation groups are `src/lib/security/*`, auth/action guards and Server Actions, checkout submission/UI retry handling, notification backend, nonce-aware layout/metadata/analytics, `src/proxy.ts`, the new SQL/verification files, generated database types, environment validation and security tests/CI. Existing store styles, animation source and logo artwork were not edited.
