# KULTURA master audit — 2026-10-12 / 2026-10-13

## A. Executive summary

**NOT READY** for production approval. This audit delivers a bounded corrective patch and reproducible evidence, not a claim that the exhaustive hosted audit is complete. Three database security/reliability checks still fail. Hosted schema/configuration parity, full customer/admin browser journeys, recovery email delivery, and outage/rate-limit verification remain unproven.

Baseline: `0ce2f80b46c6214baf189da3719aaa9d85052f5a`; branch: `audit/master-hardening-20261012`. Discovery was recorded in `MASTER-AUDIT-BASELINE.md` before application edits. No hosted SQL, customer-data writes, production deployment, or merge was performed. Test database writes used fresh in-memory PGlite instances only.

## B. Codebase analysis and cleanup

Inventory: 251 baseline tracked files; App Router public catalog/information routes, account/order/confirmation routes, admin management routes, Server Actions, SSR session clients, cart/language/consent providers, catalog repository/cache, notification service, SQL migrations, CI and test scripts. Reviewed critical boundaries: proxy, auth actions/access guards, cart restoration, checkout page/submission, catalog queries/mapping, notification RPCs/service, grants/RLS, type generation, build/env validation and CI.

Repository-wide searches covered Server Action authorization calls, environment references, unsafe HTML sinks, TODO/FIXME markers and runtime logging. These searches are inventory evidence, not proof that every line or every business flow is correct. No components, assets, dependencies, or migration history were deleted: there was insufficient evidence for safe removal. Existing CSS, animation, typography, product positions and layouts were not edited.

Changes:

- `src/components/cart-provider.tsx`: restore stored cart once before a child-triggered refresh; avoids mount-effect ordering erasing the bag.
- `src/components/checkout.tsx`: initialize authoritative quote on mount, expose existing retry styling, synchronously lock unpaid submission and catch ambiguous transport errors without clearing cart.
- `src/app/checkout/page.tsx`: refuse unavailable shipping configuration instead of displaying fabricated zero shipping.
- `src/proxy.ts`: extend session refresh and sensitive privacy headers to order confirmation.
- `scripts/generate-database-types.mjs`: normalize CRLF during comparison; no generated schema/type contract change.
- `.env.example`: document already-used optional public Facebook URL; no credentials or new required setting.
- `package.json`: add audit regression tests to existing check chain; no dependency/version changes.
- Regression/evidence scripts, QA JSON and these reports document actual scope and results.
- New unapplied SQL migration rejects SQL NULL checkout inputs; see section E.

## C. Bugs and verification

| Defect | Severity | Result / evidence |
| --- | --- | --- |
| Checkout cold refresh stays at Loading your bag | High | Quote mount/retry added, based on open PR #47; deterministic component test passes |
| Child refresh can precede provider storage restore | High | Restore-before-quote; quantity 3 and subtotal survive simulated child-first effect ordering |
| Rapid unpaid submit callbacks run twice before React pending state | Medium | Synchronous ref lock; controlled pending promise proves one call and clear/redirect only after resolution |
| Unexpected submission rejection lacks useful recovery | Medium | Safe message and unchanged bag; both validation failure and thrown transport failure covered |
| Shipping RPC error displayed as free shipping | High | Fail with safe error; no fabricated free rate; component/page test passes |
| Confirmation excluded from sensitive proxy scope | Medium | Real SSR SDK test refreshes expired fixture cookies and checks private/no-store/noindex/referrer headers |
| Windows type check reports stale types for CRLF only | Low | LF normalization; actual generated contract unchanged; generator check passes |
| SQL NULL cart creates zero-item order | High | Reproduced in isolated SQL before patch; additive migration now rejects NULL cart/address with 22023 |

The click lock is **not** durable request idempotency. Reload, network retry or another tab can still create a second pending order. The ambiguous-result message explicitly directs customers to order history before retrying.

## D. Security evidence and remaining failures

Fresh local evidence:

- 63 schema/RLS checks: anonymous/customer writes to prices, stock, totals and payment state denied; private data isolation; role escalation denied; constraints/snapshots tested.
- 48 Phase 3 checks: customer/admin separation, direct SQL admin restrictions, storage upload boundaries, profile/address isolation, validation and admin test checkout. Test-mode paid records are explicitly test records, not verified payments.
- 21 real Supabase SSR SDK tests with mocked HTTP/cookie adapters: login, registration, confirmation, reset, logout, server role guard, expired-session refresh and outage handling.
- 13 catalog transport/SQL checks; 14 configuration checks; 7 deterministic component regressions; 2 migration reapply/drift checks.
- Boundary probe `node scripts/audit-database-boundaries.mjs`: **6 PASSED / 3 FAILED** after the NULL patch. Exit code is nonzero when findings remain. The normal regression suite is not a replacement for this security result.

Unresolved, reproduced in isolated SQL:

1. HIGH: identical checkout RPC calls create distinct pending orders. Require a customer-bound idempotency key, stored request fingerprint and atomic replay semantics, coordinated with the client/action API.
2. HIGH: a customer can prepare `payment_paid` notification for their own pending order. The probe did not send email/SMS or change payment status. Require event/state authorization.
3. HIGH: customer can call `notification_record_delivery` and mark their own notification sent without provider evidence. Require a trusted backend delivery boundary, with matching application and deployment configuration. Simply revoking authenticated access would break the current sender, so this patch does not silently do that.

The existing `security/production-hardening` branch contains broader related fixes, but is not merged into this baseline. It requires reconciliation and its own integration/hosted validation; do not selectively copy its database API without matching application code.

Current main has no application Redis/HMAC limiter. Supabase/Vercel platform abuse protections were not inspected/configured here. Rate-limit and Redis fail-closed claims from the old branch do not apply. This branch retains Next.js Server Action protections and existing auth/RLS guards; it does not add the old branch's explicit strict-origin module.

CSP remains baseline `base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`; no script-src/default-src allowlist is claimed. Existing HSTS, nosniff, DENY, permissions and sensitive no-store remain. JSON-LD escapes `<`; the theme script is a static literal. Upload decoder/size checks and image-origin allowlist remain. Secret scans are pattern-based, not a mathematical absence guarantee.

## E. Database review, migration and rollback

All repository migration files execute in order in PGlite with minimal Supabase auth/storage shims. RLS is enabled on every public table inspected; security-definer functions pin empty search_path. Price/quantity/snapshot and cross-customer checks passed. PGlite is not hosted GoTrue/PostgREST or concurrent multi-connection proof. Pending checkout checks current stock but does not reserve/decrement it. Do not interpret pending records as paid stock commitments.

New file: `supabase/migrations/20261012000100_checkout_null_inputs.sql`.

- Replaces only `public.checkout_create_unpaid_order(jsonb,jsonb,text)` with the reviewed baseline body plus explicit SQL NULL checks.
- Preserves signature, price/shipping/promo behavior, pending payment, and existing execute ACL intent (authenticated only; public/anon revoked).
- No tables, columns, indexes, policies, triggers, existing records or inventory are changed.
- Transactional and idempotent against the exact baseline/patched function; SQL-body hash guard refuses divergent functions, including a separately hardened deployment. Hashes are source fingerprints, not secrets.
- Do **not** apply blindly to staging that already has `20261007000100_security_hardening.sql`. Inspect history and saved definitions, reconcile the branches and run the full integration suite first. Hosted migration history was not accessed.
- No migration was applied remotely; the application patch does not require the new SQL to render, but the NULL vulnerability remains until reviewed SQL is applied.

Exact baseline sequence before this new migration:

1. `20260923000100_commerce_schema.sql`
2. `20260923000200_row_level_security.sql`
3. `20260924000100_admin_authorization.sql`
4. `20260924000200_product_storage.sql`
5. `20260924000300_customer_address.sql`
6. `20260926000100_vercel_upload_limit.sql`
7. `20260927000100_admin_fulfillment.sql`
8. `20260927000200_test_checkout.sql`
9. `20260927000300_promo_codes.sql`
10. `20260930000200_unpaid_checkout.sql`
11. `20260930000300_shipping_settings_admin.sql`
12. `20260930000400_admin_categories.sql`
13. `20260930000500_wishlist.sql`
14. `20260930000600_order_notifications.sql`
15. `20260930000700_return_requests.sql`
16. `20261001000100_query_performance_indexes.sql`
17. New `20261012000100_checkout_null_inputs.sql`

Before any future hosted application: verify project identity, inspect migration history, back up schema/data and save function definition, owner and ACL:

```sql
select pg_get_functiondef(oid), proowner::regrole, proacl
from pg_proc
where oid = 'public.checkout_create_unpaid_order(jsonb,jsonb,text)'::regprocedure;
```

Rollback: revert only the audit application commit via reviewed PR. Prefer retaining the NULL rejection because it is backward compatible. If SQL rollback is required, restore the saved exact function definition and saved owner/grants in a reviewed transaction; never rerun bootstrap, drop tables or remove migration history. Restoring the old body reintroduces zero-item orders. No data reversal is needed for this patch; orders created independently after deployment must be preserved.

## F. Performance

Same local production-build configuration, no live DB:

| Measure | Baseline | Patched |
| --- | ---: | ---: |
| Emitted JS chunks | 31 | 31 |
| Total JS raw bytes | 1,226,034 | 1,226,537 |
| Sum of individually gzipped chunks | 373,463 | 373,643 |
| Reported compilation | 39.7s | 24.6s |

These are whole-build totals, not initial route payload. The second build is warm, so its faster compilation does **not** prove a performance improvement. The patch adds 503 raw / 180 gzip bytes. No Core Web Vitals, INP/LCP/CLS improvement, production database latency or network-waterfall claim is made. Catalog cache remains 300 seconds; cart repricing bypasses it. No speculative animation/image optimization was performed.

## G. Functional QA / command outcomes

Passed via direct installed executables because pnpm bootstrap/lifecycle failed in this Windows environment:

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js`
- `node scripts/test-database.mjs` — 63
- `node --conditions=react-server --import ./scripts/typescript-loader.mjs scripts/test-phase3.mjs` — 48
- Same loader for `test-catalog.mjs` — 13, `test-production.mjs` — 14, `test-auth-session.mjs` — 21, `test-audit-regressions.mjs` — 7
- `node scripts/test-audit-migration.mjs` — 2
- `node scripts/generate-database-types.mjs --check`
- `node scripts/test-logo-assets.mjs` — both assets decode, public paths/resolution checked
- `node node_modules/next/dist/bin/next build` — passed before and after application changes
- `node scripts/audit-client-bundle.mjs` — 31 chunks

Initial `pnpm install --frozen-lockfile` verified supply-chain policies but failed on esbuild lifecycle `spawn EPERM`; offline retry lacked registry metadata. `pnpm check` subsequently attempted dependency preparation and hit registry ECONNREFUSED; stopped that retry process. Do not report the pnpm wrapper as passed. Its individual source/type/lint/test equivalents were executed as listed. Dependency audit previously returned zero production advisories and one HIGH development-only `braces@3.0.3` advisory (GHSA-vfj7-8cjw-p6xm), no published patch in that result. No runtime production path identified; unsafe glob input could affect tooling. No package upgrade/removal was guessed.

Current staging alias read-only browser observation: shop/category/product load; selected variant showed 5 stock; quantity changed from 1 to 2; product DOM at 390px and 1440px had no horizontal overflow and no broken loaded images. Product uses an explicit photograph placeholder. This is baseline staging, not this branch. No hosted order submitted.

BLOCKED / not proven: local production server start was rejected by automatic approval review (shell approval unavailable), therefore no completed local browser E2E or HTTP suite for this patch. Full desktop/mobile checkout/reload/promo/order/admin/returns/localization journeys, real recovery emails, hosted RLS, service-outage injection and rate-limit thresholds need isolated staging. Component hook adapters do not prove browser scheduling or visual correctness. Newsletter is intentionally disabled and payment gateway absent; neither is a completed integration.

## H. Staging / production parity

Read-only Vercel metadata verified both current aliases on main `0ce2f80b46c6214baf189da3719aaa9d85052f5a`:

- Production kultura: `dpl_3WsR5eSMSpeMtbQ7ab7xqCEBhdeT`.
- Current kultura-staging: `dpl_571JXhAnKTYCMRFBapuzRpazkzSx`.
- Old isolated tested security deployment: `dpl_Cu7A87uoKRvaQXeDPRoHz9tzR7dF`, commit `5449fdf803b64269e4aa344800a07236e9af58a0`.

[PR #41](https://github.com/KULTURAgeo/KULTURA/pull/41) is merged (`2968e92c8521749e9f8b7b9f0fe80512964d89c3`), containing earlier baseline hardening. [PR #47](https://github.com/KULTURAgeo/KULTURA/pull/47) remains draft/open at `aaadff35536b864ba1a68bbc6d99e779100adbcf`; checkout mount/retry is reused and extended here. Do not merge both independently without reconciling overlap. No PR was closed by this audit.

Matching Git SHA does not establish database/env parity. No hosted credentials/secret values were inspected. Required application settings remain SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL; optional SITE_INDEXABLE, GOOGLE_SITE_VERIFICATION, GOOGLE_ANALYTICS_ID, META_PIXEL_ID, NEXT_PUBLIC_FACEBOOK_URL, RESEND_API_KEY, NOTIFICATION_EMAIL_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID. Platform supplies VERCEL/VERCEL_ENV/NODE_ENV. This patch introduces no required secret, Redis variable or service-role client.

## I. Remaining work before approval

1. Reconcile broader security branch with current main; close all three reproducible DB findings, plus review promo usage/concurrent inventory semantics and strict input/rate-limit coverage.
2. Resolve hosted migration/config parity; confirm notification trust boundary and delivery credentials in isolated staging.
3. Run the complete real-browser checkout regression including stored quantity, promo totals, shipping outage/retry, double click, refresh and confirmation ownership. Test customer A/B/admin using disposable identities.
4. Verify password recovery/expiry, admin replay denial, cookie attributes, bounded rate limiting and isolated outage behavior against the exact candidate deployment.
5. Complete localization/accessibility/visual checks, real catalog/policies and payment integration before taking money; obtain repeatable Web Vitals and DB query evidence before claiming optimization.
6. Get clean CI and review the additive SQL prerequisite/rollback before approving any merge or deployment.

## J. Final verdict

**NOT READY.** Safe corrective changes and regression evidence are prepared for draft review. Passing local regression/build does not supersede three failing boundary checks or the blocked hosted/browser quality gates. No production approval is implied.
