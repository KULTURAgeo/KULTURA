# KULTURA master audit baseline — 2026-10-12

Recorded before application edits. This is a source/deployment inventory, not a production-readiness certificate.

## Scope and immutable baseline

- Repository: KULTURAgeo/KULTURA; verified remote main: `0ce2f80b46c6214baf189da3719aaa9d85052f5a`.
- Isolated worktree/branch: `kultura-master-audit`, `audit/master-hardening-20261012`.
- Original local main and security worktrees retained without edits.
- 251 tracked files at baseline; Next.js 16.3.8, React 19.2.8, Supabase SSR 0.12.7, PostgreSQL migrations and PGlite test harness.
- No production writes, deployments, migration applications, or merges authorized by this audit.

## Verified deployment and PR state

Vercel metadata inspection on 2026-10-12:

| Environment | Deployment | Commit | Branch |
| --- | --- | --- | --- |
| kultura Production | dpl_3WsR5eSMSpeMtbQ7ab7xqCEBhdeT | 0ce2f80b46c6214baf189da3719aaa9d85052f5a | main |
| kultura-staging current alias | dpl_571JXhAnKTYCMRFBapuzRpazkzSx | 0ce2f80b46c6214baf189da3719aaa9d85052f5a | main |
| Prior tested isolated staging | dpl_Cu7A87uoKRvaQXeDPRoHz9tzR7dF | 5449fdf803b64269e4aa344800a07236e9af58a0 | security/production-hardening |

PR #41 is merged (2968e92c8521749e9f8b7b9f0fe80512964d89c3): XML rejection, baseline headers and dependency patches. It is not the later, broader security/production-hardening branch.

PR #47 remains an open draft, head aaadff35536b864ba1a68bbc6d99e779100adbcf, with checkout mount refresh/retry and browser regression additions. Its fix is absent from deployed main. Reuse/review this work rather than claiming an independently discovered new fix.

## Architecture inventory

- App Router public home/catalog/search/product/information routes; authenticated account/profile/address/wishlist/order/confirmation; admin catalog/inventory/promos/shipping/orders/returns.
- Server Actions validate input and invoke session-bound repositories/RPCs. Auth uses the shared Supabase SSR cookie contract; guards verify user and stored role.
- Client providers manage cart, language, consent and auth configuration. Deferred cart quoting makes each cart consumer responsible for initial validation.
- Catalog repository, cache invalidation and static-params helpers separate queries from UI. Admin dashboard uses independently suspended server sections.
- 16 ordered SQL migrations, ending 20261001000100_query_performance_indexes.sql. Covers commerce, grants/RLS, storage, addresses, fulfillment, test/unpaid checkout, promos, shipping, categories, wishlist, notifications and returns.
- No production payment provider is integrated. Pending orders are not payments.
- Georgian/English dictionaries and localized components coexist with remaining English literals; completeness requires route-level QA.
- CI runs type/lint/database/catalog/phase3/production/auth/logo/type-generation checks, dependency advisory gates, build and secret scans. Browser harness exists but is not invoked in CI.

## Confirmed concerns before edits

1. Checkout cold-load restoration: provider defers validation, Checkout lacks the refresh effect present in CartContents/ReviewOrder. Previously reproduced on old isolated staging; source confirms the same defect in current main. PR #47 addresses it.
2. Broader hardening is unmerged: strict input/origin modules, distributed Redis limiter, dedicated logout route, checkout request idempotency, hardened notifications and 20261007000100 migration exist only on the security branch. Their earlier local/hosted results cannot certify main.
3. Current unpaid action calls checkout_create_unpaid_order without an idempotency key and awaits notification delivery after persistence. Investigate duplicate retry and notification failure semantics with regressions before changes.
4. Sensitive proxy prefixes omit /order-confirmation; inspect session refresh and cache/privacy headers there.
5. Database migration state and configuration parity cannot be inferred from matching Git SHAs. Hosted introspection remains unavailable without an approved connection.
6. Browser harness is local-only and expects external Playwright plus a mock Auth/PostgREST transport; passing PGlite is not hosted Supabase proof.

## Evidence boundaries and rollback

Prior audit: 92 local checks passed against the old security branch. Hosted A/B application-route checks and pending KUL-2 succeeded there; direct API/RLS probes, full recovery, cookie inspection and hosted outages were not proven. No reuse of those results as new main tests.

This audit starts with a clean branch. Keep changes in small reviewable commits; rollback application changes by reverting only audit commits. Never remove migration history or revert hosted SQL without separately reviewed backups and a migration-specific plan. No hosted DB migrations are planned as an automatic audit action.

Baseline install/check/build measurements are pending and will be recorded separately with exact command outcomes. No speed improvement or complete security claim is made.
