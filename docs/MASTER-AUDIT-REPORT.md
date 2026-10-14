# KULTURA master audit — remediation update 2026-10-14

## A. Executive summary

**NOT READY for production.** The three previously reproduced database vulnerabilities are fixed in the candidate source and isolated PostgreSQL tests: **23 PASSED / 0 FAILED boundary checks**. Hosted schema compatibility, multi-connection concurrency and full browser journeys remain BLOCKED/unproven. A passing build does not waive these gates.

Branch: `audit/master-hardening-20261012`, Draft PR #48. Baseline main: `0ce2f80b46c6214baf189da3719aaa9d85052f5a`. Previous audit commit: `f76e7d377ff08bae80e9623486ca65577ebb3e03`. Baseline inventory remains in MASTER-AUDIT-BASELINE.md. No hosted migration, payment, customer notification, production deployment or main merge was performed. Database tests use disposable in-memory PGlite only.

## B. Reconciliation and scope

GitHub metadata rechecked on October 14: #48 and #47 remain draft/open; #41 is merged. #47's checkout mount/retry intent is already incorporated and extended with restore-before-refresh in #48. Do not merge the overlapping patches independently. #41 supplies XML rejection, baseline headers and patched dependencies; it is not the later `security/production-hardening` branch.

Reused selected reviewed SQL/backend notification patterns from security/production-hardening: customer-scoped request keys, profile row serialization, legacy RPC revocation, notification backend ACLs, state checks, transactional outbox and claims. Adapted them as a NEW migration; no historical migration overwritten. Did not copy the unrelated Redis, auth redirect, broad CSP or other customer-write quota changes. Their presence on the old branch is not evidence they exist on current main.

No layout, branding, animation, price presentation or stock display redesign. No packages added, removed or upgraded.

## C. Remediation behavior

1. **Duplicate checkout — PASSED locally.** New `checkout_submit_order(uuid,jsonb,jsonb,text)` validates authenticated identity and strict input types/fields, locks the customer's profile row, canonicalizes cart ordering, and stores request payload/order ID in private.checkout_requests. Same customer/key/payload returns the original order, even at the quota limit. Conflicting payload is rejected. The old non-idempotent RPC is no longer executable by anon/authenticated. Product prices, stock, shipping, promo discount and snapshots still come from SQL. New orders remain payment pending; no fake paid status.
2. Browser request IDs persist before submission, keyed by a SHA-256 payload/customer fingerprint, without storing contact/address text. Network exceptions and validation failures preserve cart and request key. Web Locks coordinate supported browsers. A completed key is retained for delayed/stale-tab requests; an intentional subsequent add-to-cart clears completed keys for a new purchase. Storage failures block submission before network activity. The synchronous click guard remains. Browsers without Web Locks have no proven cross-tab atomic creation; hosted cross-tab/manual testing remains required. Different request keys intentionally represent different purchases.
3. **Fraudulent payment notification — PASSED locally.** Customers, including admin sessions, cannot invoke notification backend RPCs. A service-role call cannot prepare a payment-paid event for an unpaid order. Event/state matching is checked in SQL. Real provider integration must later verify its webhook before changing payment state; none is implemented here.
4. **Forged delivery receipt — PASSED locally.** Prepare/claim/record RPCs are service-role only; public/anon/authenticated grants revoked. A dedicated server-only client is used instead of customer cookies. Claims are atomic and each channel is claimed before provider delivery. Mocked parallel calls send once. NULL delivery channel rejected.
5. Outbox creation occurs transactionally on real order creation/state transitions. Test orders skip notifications. Missing service key/provider configuration leaves queued events without sending. No automatic retry worker is introduced. A process crash after claim can leave an undelivered claim; deliberate recovery and provider reconciliation are required to avoid duplicate sends. Provider HTTP success means provider acceptance, not inbox/SMS receipt.
6. Accepted new unpaid orders consume a promo use once; replay does not. No historical counters are rewritten. Cancelled orders retain usage. This policy needs merchant approval before production; there is no payment integration. Inventory is checked but unpaid orders do not reserve/decrement stock, matching existing behavior. Payment-time stock handling remains future work.

Existing #48 fixes remain: cold checkout quote/retry; provider restore before child refresh; safe shipping-config failure; cart preservation on errors; confirmation session/privacy scope; CRLF-safe generated-type verification; explicit SQL NULL checkout rejection.

## D. Database migration and security review

New: `supabase/migrations/20261013000100_checkout_notification_security.sql`.
Prerequisite: repository chain through `20261012000100_checkout_null_inputs.sql` (after the 16 baseline migrations through `20261001000100_query_performance_indexes.sql`). Apply filenames in lexical/timestamp order; never rerun bootstrap or old migrations after hardening. `20261007000100_security_hardening.sql` belongs to the other branch and is NOT in this chain. An environment with that migration needs separate reconciliation, not assumed compatibility.

Changes:
- New RLS-enabled private.request_limits and private.checkout_requests; customer FKs cascade on account deletion, request order FK cascades on order deletion; primary keys customer/scope and customer/request. Requests contain sensitive delivery payloads, private-only. No new secondary index needed for PK lookups.
- Enable RLS on private.checkout_settings; no new customer policy.
- private.customer_rate_limit: accepted checkout quota 10/hour; transaction rollback means failed requests do not consume quota. This is not an edge/DDoS limiter.
- public.checkout_submit_order: authenticated execute, anon/public denied; private rate-limit and old checkout helper inaccessible to customers.
- public.notification_prepare, notification_record_delivery, notification_claim: only service_role execute. Existing notification RLS remains; no customer bypass.
- notification_outbox adds nullable email_claimed_at/sms_claimed_at; private.queue_order_notification and orders_queue_notification AFTER INSERT/UPDATE OF payment_status,fulfillment_status queue trusted events.
- Security-definer functions pin empty search_path; no dynamic user-controlled SQL. Generated database.types.ts updated.
- No existing order/customer/product/inventory rows deleted or rewritten by migration. New columns initially NULL. Runtime only writes request/quota/outbox/promo-use/order records as described.

Migration uses BEGIN/COMMIT and reviewed function-body fingerprints (CRLF normalized) to refuse unknown definitions before changes. Unknown pre-existing security tables without a wrapper also refuse. Reapply is tested; function/ACL snapshot stays identical and legacy execute stays denied. Unexpected function drift aborts transaction without replacing it. These guards do NOT replace hosted schema/owner/ACL/history inspection. Owners, table constraints and any custom policies must be compared before hosted approval. No claim that arbitrary modified or old-security staging databases are automatically compatible.

## E. Tests and evidence

Executed against candidate code in this remediation:

| Gate | Result | Evidence |
| --- | --- | --- |
| DB security boundaries | PASSED | 23 assertions, 0 failed; qa/master-database-boundary-audit.json |
| Foundation DB/RLS | PASSED | 63; roles, ownership, negative inputs, snapshots |
| Phase 3 | PASSED | 48; admin/customer/storage/returns inputs; NULL checks now target guarded RPC |
| Auth/session | PASSED | 21; actual SSR SDK with mocked HTTP/cookie adapters |
| Catalog | PASSED | 13; actual SDK against isolated SQL-backed fixture |
| Production configuration | PASSED | 14 |
| Cart/checkout component logic | PASSED | 10; hook adapters, not browser certification |
| Migration guards/reapply | PASSED | 5; both new migrations in isolated DB |
| Notification service | PASSED | 5; mocked backend/provider, no HTTP sends |
| Types and lint | PASSED | direct installed TypeScript/ESLint executables; final rerun passed |
| Production build | PASSED | direct Next build with no hosted Supabase configuration; final rerun passed |
| Generated types | PASSED | generator --check |
| Logos | PASSED | decoded source assets/public-path validation |
| Secret audit | PASSED | repository pattern scan and built-client scan; no values printed |
| Runtime dependency audit | PASSED | fresh pnpm audit --prod --audit-level high: no known vulnerabilities |
| Full graph advisory | FAILED advisory scan / no critical advisory | braces@3.0.3 via ESLint fast-glob/micromatch; GHSA-vfj7-8cjw-p6xm, HIGH stack exhaustion on nested patterns; no published patch in current response; tooling only, no runtime advisory |
| pnpm check wrapper | BLOCKED | dependency preparation fails at esbuild postinstall with Windows spawn EPERM; individual equivalent commands passed, wrapper did not |
| Hosted candidate and real-browser E2E | BLOCKED | Vercel connection 403 for kultura4; no mapped Vercel CLI available; local server execution previously rejected by approval policy |
| Multi-connection concurrency | BLOCKED | PGlite is single-connection; row-lock reasoning is not a concurrent PostgreSQL execution result |

Commands: `node scripts/test-database.mjs`; loader `node --conditions=react-server --import ./scripts/typescript-loader.mjs` with test-phase3.mjs, test-auth-session.mjs, test-catalog.mjs, test-production.mjs, test-audit-regressions.mjs, test-notification-security.mjs; `node scripts/test-audit-migration.mjs`; `node scripts/audit-database-boundaries.mjs`; `node scripts/generate-database-types.mjs --check`; `node scripts/test-logo-assets.mjs`; `node scripts/audit-repository.mjs`; `node scripts/audit-client-bundle.mjs`; installed TypeScript, ESLint and Next executables. Boundary and notification checks are included in `pnpm check` via test:audit.

Expected synthetic error logs in catalog/provider-outage tests are tested failure paths, not live failures. Local evidence does not validate Supabase hosted PostgREST/GoTrue, Vercel cookies or provider delivery.

## F. Hosted/browser and performance limitations

Prior read-only staging baseline product checks at 390px and 1440px had no horizontal overflow or broken loaded images; quantity changed 1 to 2. They were performed on main, NOT this candidate and are not repeated unnecessarily. No candidate full browser pass is claimed.

Required candidate smoke journeys: disposable customer registration/confirmation/login/logout/recovery; session refresh; shop/search/filter/variant quantity; cart reload; shipping and promo quote; valid/invalid checkout; simultaneous same-key submissions using independent DB connections; ambiguous network retry; cross-tab stale checkout; order confirmation/history and customer A/B ownership; admin direct-action denial for customers; admin product/inventory/order/returns and locale; 390/1440px keyboard/accessibility/screenshots; bounded rate limits; isolated notification/DB outages. No real customer notifications or real payments.

No measured performance improvement claimed. Previous build size/warm compilation comparison is historical, not current remediation evidence. Notifications await bounded provider work after order persistence; latency and background delivery design remain to be measured/reviewed.

## G. Environment and rollout prerequisites

Existing: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL. New server-only SUPABASE_SECRET_KEY is needed ONLY to dispatch/record notification delivery through the privileged client; without it orders still persist and events remain queued. Never place it in a NEXT_PUBLIC variable or layout/client props. Use an isolated staging project key for staging. Provider settings: RESEND_API_KEY and NOTIFICATION_EMAIL_FROM; optional SMS TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID. Optional analytics/public identifiers unchanged; no Redis configuration added.

New application requires the new checkout RPC. Coordinate DB-first maintenance/staging rollout with application release: revoking legacy RPC intentionally breaks old application checkout during a mixed-version window. Do not grant it back as a convenience workaround. Disable checkout/maintenance while deploying the paired release if needed. Never apply new application to an unverified database.

## H. Backup and rollback plan BEFORE hosted approval

1. Verify isolated project ref/host and migration history; do not derive production identity from an alias. Take restorable full schema/data backup/PITR point. Save counts and exports of orders/items, promo_codes (id,used_count), notification_outbox and any existing private checkout request/quota tables.
2. Save pg_get_functiondef, proowner, proacl, proconfig and signatures for checkout_create_unpaid_order, checkout_submit_order, customer_rate_limit, notification_prepare, notification_record_delivery, notification_claim and queue_order_notification where present. Save table column/constraint/owner/ACL definitions, pg_policies and relrowsecurity flags, and pg_get_triggerdef for orders_queue_notification. Record which objects did not exist.
3. Prefer forward correction retaining idempotency and notification ACLs. Revert the application commit only via reviewed development PR, never reset main. Older application calls legacy RPC and will fail against retained hardened ACLs: keep checkout disabled until a compatible release is restored.
4. If database rollback is essential, first stop checkout and notification workers; in one reviewed transaction restore only saved function definitions/owners/ACLs and prior trigger definition (or remove the new trigger if none existed). Restore RLS/ACLs only from the saved exact baseline. Re-enabling legacy checkout or customer notification privileges reintroduces the known vulnerabilities and requires explicit security acceptance; it is NOT the recommended rollback.
5. Preserve new private tables, request-to-order mappings, outbox claims and every created order. Do not drop them or decrement promo counters blindly. Runtime uses after the snapshot must be reconciled per order; restoring the old whole promo counter would lose concurrent legitimate use. Extra nullable claim columns can remain harmlessly. Do not remove migration history or rerun bootstrap.
6. Because definitions and ACLs vary by hosted target, no universal executable destructive rollback SQL is supplied. Generate the exact transaction from the verified backup before hosted application; absence of that backup is a deployment blocker.

## I. Remaining blockers

- Hosted schema/history/owner/grant parity and reviewed rollback backup not verified.
- Candidate deployment/runtime and complete disposable-user browser journeys not verified; Vercel scoped access currently denied.
- Real multi-connection DB concurrency and no-Web-Locks cross-tab behavior not proven.
- Notification claim recovery/worker operations and provider sandbox verification not complete; missing service key intentionally queues without delivery.
- Merchant approval of unpaid promo-use accounting and non-reserving stock semantics required; real payment integration absent.
- Wider security branch Redis/origin/CSP hardening is not automatically reconciled by this targeted three-vulnerability fix. Do not advertise it as deployed here.

## J. Verdict

**SAFE FOR ISOLATED REVIEW/TESTING, NOT READY FOR PRODUCTION.** All three originally failing security boundary cases now pass locally. This does not authorize merging main, applying hosted SQL, or production deployment. Keep PR #48 draft until blocked validation and rollout prerequisites are resolved.

## K. Post-commit CI and candidate browser evidence

Source commit `b6b56cc42f5ceebdf26345ef2298c67a957c25b2` was pushed only to the audit branch. Remote main was reverified unchanged at `0ce2f80b46c6214baf189da3719aaa9d85052f5a`.

GitHub run 38565278148, verify job 115856255178: **PASSED** frozen installation, type generation, full `pnpm check`, production and critical dependency gates, build, and secret audit. This resolves the complete-suite execution gate in Linux CI; the local Windows wrapper failure above remains an accurate local result. Both automatic Vercel Preview build statuses are success; no manual deployment was initiated.

The browser could access the isolated staging branch Preview despite the Vercel API 403:
`https://kultura-staging-git-audit-master-hardening-20261012-kultura4.vercel.app`.
**PASSED limited candidate browser checks:** homepage renders; shop to category to product navigation; selected test variant quantity increases 1 to 2; product DOM at 1440x900 and 390x844 has no horizontal overflow and zero failed loaded images; screenshots inspected. Product photography is an intentional placeholder, not a broken image. Optional analytics consent rejected. Viewport override reset afterward. No hosted order, admin write, auth credential, provider send or database mutation was attempted.

This supersedes the earlier blanket inability to open the candidate browser, but NOT the full authenticated E2E blocker. Exact hosted DB identity/history remains unverified, new migration remains unapplied, and anonymous product rendering does not establish RLS/auth/checkout correctness. Production verdict remains NOT READY.
