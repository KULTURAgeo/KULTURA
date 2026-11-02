# Production compatibility and recovery gate

Date: 2026-10-25. Status: BLOCKED. This is a reviewed plan, not executable SQL. The user's latest execution request authorizes a release only after the outstanding gates pass.

## Latest local verification (2026-10-25)

- A checkout bridge prototype now exists outside the deployable repository in `work/production-compatibility/`. It passed nine archived-DDL offline checks and native PostgreSQL overlapping-request/expiry tests (backend PIDs 1098/1099, database `kultura_bridge_06d9e037`). Tested SHA256: `5234f1ea5d5827c6a1b18054a055b1fac7ac91c69d3cd8e1d11ec47c4c312e30`. It preserves old request hashes and creates new reservation records without a second inventory debit. Pre-use rollback passed; post-use rollback deliberately refuses. Full schema/ACL reconciliation, mixed-request concurrency, cron and restored-copy validation remain gates. See the workspace-only `REHEARSAL-REPORT.md`; this is not production-ready SQL.

- Resumed the existing disposable `kultura-auth-probe-d89e11e0` services after Docker Desktop restarted. Auth health was reachable. Docker API access from Codex remains denied, but direct local HTTP and PostgreSQL access work.
- Applied all 21 candidate migrations to the verified empty local public schema, with real Supabase Auth/Storage database objects. Each applied file's SHA256 is recorded in workspace-only `work/kultura-auth-probe-d89e11e0/candidate-schema-results.json`. This was not an upgrade of the production baseline. No backup was loaded.
- Real GoTrue, Mailpit and PostgREST integration passed 18 checks, recorded in `work/kultura-auth-probe-d89e11e0/auth-flow-results.json`. Coverage: signup and email confirmation, blocked unconfirmed login, password login, invalid token rejection, refresh, global logout preventing refresh, recovery/password replacement and recovery-token replay denial.
- Two real synthetic customers could read their own profiles but not each other's. Anonymous enumeration and profile-role updates were rejected. A newly issued JWT containing user-editable `user_metadata.role=admin` still could not invoke the admin RPC.
- Parallel authenticated HTTP checkout calls with the same key returned the same pending order and deducted inventory once. Trusted total was 9800 minor units for two synthetic items. Another customer could not read that order. Changed retry payload, anonymous checkout, and direct legacy checkout bypass were rejected; the bypass returned HTTP 403.
- These tests created only synthetic local accounts, catalog fixtures and pending orders. Passwords/tokens are neither printed nor saved. The local bridge has outbound networking; it must not receive production backup data or hosted provider credentials. No browser UI, real payments, Storage HTTP flows or successful admin journey is claimed by these results.
- The 32 application auth/session adapter checks and 11 offline archived-production contract checks also passed again. The latter still marks production compatibility BLOCKED: the candidate RPC is absent from the archived baseline and the legacy implementation already deducts stock.
- Still required: production-compatible forward SQL and rollback rehearsal; successful admin and complete browser journeys; fresh production backup/configuration and Vercel access verification. Nothing was pushed, merged, migrated on Production or deployed during this verification.

## Earlier evidence (2026-10-22; local startup status superseded above)

- Full local archive restore and round-trip dump passed in the network-disabled restore container. Separate role metadata matched 15 roles and 21 memberships. Sixteen role/database settings were restored and verified in fresh local sessions. Password/service restoration and application services remain separate gates.
- `qa/postgres-concurrency-results.json`: native PostgreSQL 17.6, separate backend PIDs and measured transaction overlap, same-key retry isolation and pending order/stock assertions passed against the 21-migration candidate chain with synthetic fixtures. Auth/Storage were SQL shims; this is not a browser or GoTrue/PostgREST test.
- Workspace-only `work/production-checkout-contract-results.json`: ten offline PGlite checks passed against application DDL extracted from the verified archive, with no production rows or network connection. This verifies the old contract, not the proposed migration or hosted permissions. Ownership/grants were deliberately excluded from the extracted DDL and therefore this is not ACL/RLS evidence.
- Proven legacy semantics: immediate stock deduction; same-key retry without another deduction; promo retry remains valid after its last available use; preserved per-item discounts and delivery notes; server shipping/totals; rejection of forged totals and excessive quantity.
- Current candidate RPC remains absent from the archived production baseline. Its action/address input does not carry legacy delivery notes or an expected quote. A compatible release must preserve these behaviors explicitly and must not combine legacy stock deduction with a second reservation deduction.
- Local Auth/API startup is not completed: earlier Docker probes returned permission denied; the latest probe reports the desktop-linux named pipe does not exist. Engine availability/access remains unverified. The CLI configuration-directory blocker was resolved using its supported process-local SUPABASE_HOME override, outside the project. Both requested npx help commands passed with CLI 2.121.0 using a temporary npm runner. A separate local project configuration was initialized with automatic seeding disabled and local confirmation email enabled; no services were started. Windows ACLs and production configuration were not changed.
- Follow-up offline suite now passes eleven checks, including deliberate rejection of the reservation migration on the legacy baseline and explicit transaction rollback preserving both synthetic orders and stock. Local auth/session tests passed 32 checks and security tests passed 55; none establishes hosted Auth/API/browser correctness.

## Verified baseline

- Fresh origin/main: cc5e2e8285b063ac0415ca5246f17d78cbfaa031.
- Candidate: integration/final-security-production, local uncommitted integration on that base.
- Production project: asnkxfudkodgyhdawhfq. Staging: fpahkxmlcvywspamftma.
- Fresh read-only captures: production has 16 public/private tables and 23 functions; staging has 20 tables and 30 functions.
- Offline comparison of the 21-file executable chain against the fresh staging capture: zero missing, differing or additional objects within the comparator's scope.
- Production: 76 missing, 12 differing and 8 additional objects. These are object counts, not migration counts. Full names are in qa/schema-baseline-comparison.json. ACLs, RLS flags, ownership, auth/storage and cron require separate verification.
- Production archive: 526977 bytes; SHA256 EF4F2B2832B8D5D74D1773CA08C614D33E9DCCB8787BB7BB56DF69402FFD125B. Original pg_restore listing and full decode passed; recheck found 803 archive entries with identical SHA256. Isolated database restore has now passed; see latest evidence above. The archive remains outside Git in Windows LocalApplicationData/KULTURA-Backups.

## Critical accounting incompatibility

Production has public.checkout_submit(uuid,jsonb,text,jsonb,jsonb), checkout_quote(jsonb,text), and private.checkout_price(jsonb,text). Its submit implementation deducts stock and increments promo used_count immediately, records orders.checkout_key / checkout_request_hash, and preserves delivery_notes and per-item discount allocation.

Production ALSO retains authenticated access to the legacy checkout_create_unpaid_order(jsonb,jsonb,text). Its inspected body validates stock but does not deduct/reserve stock. The existence of this alternate directly callable path must be resolved, even if the current UI does not use it. No mutation was executed to test it on real data.

The candidate instead calls checkout_submit_order(uuid,jsonb,jsonb,text), which is absent in Production. Deploying application code first would break checkout. The staged 30-minute reservation SQL deliberately rejects a database where public.checkout_submit exists. Do not remove that guard or replay that migration against Production.

The release migration must preserve existing orders, stock levels, promo counts and production-only columns/indexes. Do not backfill historical orders as new reservations: some historical orders may already have deducted stock/promo. Do not infer accounting state solely from pending payment status.

## Required ordered work before approval

1. Prepare an isolated production-copy restore target with required PostgreSQL/Supabase extensions and roles, without outbound notification/payment credentials or active cron workers. Do not use the live staging database as a restore target. Do not upload production data to an unapproved external service.
2. Restore the archive and verify data/constraint/ACL coverage. Database-only pg_dump excludes cluster role definitions and Storage object bytes; capture/reconstruct required role definitions without passwords and maintain a separate Storage recovery plan. Resolve missing extensions before calling restore verified.
3. Capture production schema/roles/ACLs/policies/triggers/indexes/cron definitions immediately before the migration. Read-only snapshots of function definitions exist locally, but are not a complete restore test or certified rollback.
4. Develop a NEW baseline-guarded forward migration on the restored copy. Do not replay the 21 historical files and do not fabricate migration history.
5. Add missing idempotency, quota and reservation tables/columns/indexes with RLS and restricted grants. Preserve production-only checkout columns and order snapshots.
6. Reconcile both active and legacy checkout RPCs into a single accounting contract. Provide tested compatibility for old application requests and retries, preserving existing request-key results, submitted delivery data and discount snapshots. Revoke or safely wrap unprotected alternate entry points; do not leave a stock/promo reservation bypass callable by authenticated clients.
7. Install hardened validation, admin/customer quotas, notification claim/recovery controls, ownership checks and expiry handling. Keep test checkout disabled in production. Retain all legitimate admin flows.
8. Reconcile the checkout_settings free-shipping threshold constraint explicitly; verify existing settings first. Do not change delivery prices silently. Enable private checkout-settings RLS with the intended grants and definer access intact.
9. Test native concurrent requests, historical retry keys, new requests, promo caps, cancellation, expiration exactly once, admin inventory edits with active holds, and late payment transitions. No real provider success or charge may be fabricated.
10. Validate cron expiry in the isolated target, then define a production schedule with exact function ownership/permissions. Do not copy unrelated jobs or their credentials from staging.
11. Verify Vercel project/commit/env isolation, Redis behavior, hosted customer/admin journeys and full CI on the final candidate. Preserve current Motion/mobile/locale/theme behavior.
12. Present the exact new SQL, test evidence, affected objects and rollback procedure for explicit production schema approval. Only after approval apply it, verify compatibility and release through the repository review/protection process.

## Recovery procedure and limitations

- Never restore the archive over live Production as an automatic rollback. A restore would overwrite orders created after the backup.
- Before any change, record the exact live Vercel deployment/commit, database definitions and ACLs. Latest deployment verification is currently blocked through the connector (403).
- A failed migration transaction must roll back atomically; no destructive fallback or manual skipping of guards.
- Before new orders use reservations, a tested definition/ACL rollback may be possible. It is not certified until the actual forward migration exists and has been exercised on the isolated copy.
- After reservation-backed orders exist, retain ledger tables and compatible RPCs. Roll back the application only to a verified compatible deployment; use forward repair/reconciliation for database state. Never reset promo counters or re-credit stock indiscriminately.
- Disable notification dispatch in the isolated copy and prevent copied cron jobs from running. Restoration is validation, not a production clone to expose publicly.
- Preserve the verified archive and verification.json; do not commit or upload either. Take a fresh backup before the eventual approved production schema change.

## Release decision

NOT READY. Archive integrity, isolated database restore/role-setting checks and candidate native checkout concurrency have passed. Production-compatible SQL and its rollback exercise, integrated Auth/API/browser journeys, and Vercel environment/deployment confirmation remain incomplete. No production schema change, merge or deployment is authorized by this document.
