# KULTURA final security / production release report

Status: **PRODUCTION NOT READY — BLOCKED**

Updated: 2026-10-20 (Asia/Tbilisi). This is a checkpoint of the actual integration work, not a release certificate.

## Source and integration

- Integration worktree: `outputs/kultura-final-integration`.
- Branch: `integration/final-security-production`.
- Base fetched from GitHub: `cc5e2e8285b063ac0415ca5246f17d78cbfaa031` (`feat: publish approved KULTURA Motion+ animations`).
- No integration commit, push, PR, merge or deployment has been performed in this integration task. HEAD remains the base; changes are local and uncommitted.
- Handoff ZIP SHA256: `7E983FB7989C894E9A12A2B646D9291B51E1D7F35431637DF113CD8D96DC6905`. Archive includes earlier uncommitted audit work and separate historical security reference, not a production snapshot.
- Inspected `security/production-hardening` at `5449fdf803b64269e4aa344800a07236e9af58a0`, `audit/master-hardening-20261012` at `56c082f15415ea60a8bd89cc14ce17e1199ef124`, and PRs 47 and 48. PR47 checkout restoration overlaps PR48; do not merge both blindly.
- Latest main's Motion+, motion/react, Lenis, cinematic/mobile changes and current public assets/lockfile were retained. Historical security layout was not copied over the current layout.
- All 56 remote branches (excluding main and symbolic HEAD) were inventoried in qa/integration-branch-inventory-20261019.json: 24 already in main by ancestry, 1 with changed files matching main, 27 requiring semantic review, 1 excluded unselected payment-provider implementation, 1 overlapping audit branch and 2 selectively integrated. This is an ancestry/blob inventory, not a completed semantic audit of every branch. Main was freshly fetched and remains cc5e2e8285b063ac0415ca5246f17d78cbfaa031.

## Existing protections and integrated changes

Existing main already had server-side Supabase authentication, ownership checks, RLS-based repositories, SQL checkout pricing, secure cookie options and baseline headers. Integration adds the reviewed distributed rate limiting, strict Origin/CSRF checks, strict mutation payload validation, nonce CSP, dedicated POST `/auth/logout`, sensitive-response `Referrer-Policy: same-origin`, server-only notification dispatch and durable checkout idempotency.

The audit branch's cart restoration, shipping-error handling, durable browser retry key and notification boundary fixes were integrated. The three later staging migration files and associated tests were copied without executing hosted SQL or rewriting their contents. Historical `20261007000100_security_hardening.sql` was deliberately not added to the executable chain: its overlapping definitions/counter behavior must not be replayed on the newer chain.

Integration-specific fixes:

- Added `/search` to the security route allowlist; the old list would incorrectly reject the newer production page. Security test detected this before release.
- Preserved bilingual/theme/Motion layout and attached the request nonce to the existing theme bootstrap script.
- Passed nonce through the existing Motion provider to `MotionConfig`, supporting Motion-created styles without weakening CSP.
- Projected promo/test-checkout cart lines to the strict product/variant/quantity payload rather than passing presentation fields.
- Restricted sandbox checkout UI to explicitly enabled non-production admin sessions; corresponding server/DB gates remain.
- Retained checkout notification/idempotency logic from the newer audit implementation and added the security branch's action guard and strict input checks.
- Restored the schema-only regression fixture required by the staging-repair tests; no customer data backup was copied.
- Removed the unused SHOP `Link` import reported by lint.

Logout remains independent of Redis only for dedicated POST `/auth/logout` without a `next-action` header. Origin null/missing/invalid and cross-site requests remain rejected. Login, checkout and admin mutations remain fail-closed on Redis failure. No rate thresholds were lowered.

## Database inspection and safety

Read-only project discovery verified staging `fpahkxmlcvywspamftma` and production `asnkxfudkodgyhdawhfq` as separate projects. Read-only metadata/advisor queries were performed; no production data or schema was changed.

Staging history contains the three previously applied versions `20261015201827`, `20261017211555`, `20261018111916`; older bootstrap SQL was applied outside migration history. All 20 public/private tables returned in the staging RLS inventory had RLS enabled.

Production has no `supabase_migrations.schema_migrations` relation. The initial metadata query referencing it failed read-only with 42P01; a follow-up existence check confirmed its absence. No history was invented or backfilled. Public table RLS was enabled; `private.checkout_settings` was reported with RLS disabled. This private flag alone is not proof of public exploitability; grants/schema exposure require complete review.

Production exposes the alternate checkout implementation (`checkout_submit(uuid,jsonb,text,jsonb,jsonb)`, `checkout_quote(jsonb,text)`, `private.checkout_price(jsonb,text)`) as well as legacy storefront functions. It cannot accept a blind replay of the staging migration chain. A production-compatible migration is NOT yet prepared/tested.

The integrated staging chain includes:

1. `20261012000100_checkout_null_inputs.sql`
2. `20261013000100_checkout_notification_security.sql`
3. `20261015201827_repair_staging_checkout_notification_null_guards.sql`
4. `20261017211555_checkout_stock_promo_reservations.sql`
5. `20261018111916_reconcile_security_controls.sql`

These files follow the repository's earlier migrations; this list is not an instruction to rerun them on either hosted project. No hosted migration was applied in this integration task.

Reservation behavior in disposable tests: atomic 30-minute stock/promo holds, request replay without duplicate deduction, safe cancellation/expiry release, trusted payment transition handling, and late-payment rejection for reconciliation. No payment provider success was fabricated. Native multi-connection tests from prior work are historical evidence; they have not yet been rerun on this integration candidate.

**Backup archive integrity: VERIFIED; restore/recovery gate: NOT MET.** A complete database-level custom-format pg_dump was created on 2026-10-19 at 17:58:17 UTC (21:58:17 Tbilisi) through the verified production project connection. It is stored outside Git under Windows LocalApplicationData/KULTURA-Backups. Size: 526977 bytes; SHA256 EF4F2B2832B8D5D74D1773CA08C614D33E9DCCB8787BB7BB56DF69402FFD125B. pg_dump exited successfully without diagnostics; pg_restore --list (803 entries, 54 table-data entries) and full payload decode passed. A fresh recheck confirmed the same hash and successful archive listing. The pooler-aware preflight uses mandatory client TLS and an explicit read-only transaction. No ACL changes, data writes or restore occurred. Cluster-level roles and external Storage object bytes are not included. An isolated restore and production-copy migration test remain mandatory. Earlier dashboard Free-plan findings remain historical; they no longer mean no logical backup exists.

## Fresh local verification

Passed on this integration candidate (local adapters are explicitly not hosted proof):

- TypeScript and ESLint (initial unused import warning corrected).
- Next.js 16.3.8 production build after integration fixes, including Motion nonce forwarding.
- 55 security checks (PGlite + real proxy + isolated Redis transport).
- 32 auth/session checks (real Supabase SSR SDK with simulated HTTP/cookies).
- 63 foundation DB assertions and 49 Phase 3 checks.
- 13 catalog and 14 production-configuration checks.
- 10 cart/checkout regression checks.
- 5 earlier migration checks; 4 staging-repair checks; 11 reconciliation checks.
- 17 reservation checks; 23 DB boundary checks.
- 10 notification recovery and 5 notification service checks.
- Database TypeScript types match the integrated migration chain.
- Logo asset existence/decoding/dimensions verification.
- 29 HTTP checks against local production build on localhost:3100, including fresh CSP script nonces, 404s, CSRF rejection, XML rejection and asset responses.
- Repository secret scan: 262 text files, zero findings after writing this report. Client bundle boundary scan: 34 chunks passed.
- Fresh production dependency audit: 0 vulnerabilities. Full audit: 1 HIGH development-only `braces` advisory, GHSA-vfj7-8cjw-p6xm, no patched version reported. Do not describe the full dependency graph as vulnerability-free.

`pnpm install --frozen-lockfile` verified the unchanged lockfile and supplied packages but failed at esbuild lifecycle child-process spawn with Windows EPERM. Individual Node-based commands were used and their results recorded separately. The aggregate `pnpm check` exited 1 during its automatic dependency install, before running the check script: esbuild lifecycle child-process spawn EPERM. Do not equate individual tests with a completed install/CI gate.

Local browser: homepage rendered with current Motion design, cookie consent interaction worked, and captured error/warning console was empty. This was an unconfigured empty-catalog local build; it does not prove real product/checkout/admin journeys, scroll timing, every viewport, analytics, or authenticated hosted flows.

## Vercel / hosted staging blockers

The connected API returned 403 for `GET /v9/projects/{idOrName}` with explicit team `team_6JKvQUXBgzbHHNFJEhxj3iZW`, project `kultura-staging`. Browser dashboard access worked. Exact connector grant restriction remains unresolved; no evidence establishes a plan upgrade or new token as the necessary fix. No token was requested or exposed.

Browser verified staging project ID `prj_IKGhEul2RAKp8wZv2b4A1xUUTOK5` and current environment scopes:

- `RATE_LIMIT_HMAC_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `UPSTASH_REDIS_REST_URL`: separate Production and Preview entries visible.
- `SITE_URL`: Production and Preview entry visible.
- `UPSTASH_REDIS_REST_TOKEN`: initial inspection found only Production. On 2026-10-19, after the user configured it, a refreshed dashboard search confirmed separate Preview and Production secret entries. Missing Preview scope is RESOLVED; value correctness/runtime connectivity remain untested.
- Shared tab explicitly reports no shared variables linked.

No secret values were revealed. Variable names/scopes do not prove Supabase/Redis environment isolation. The user configured the staging Redis token in Preview scope; its presence was verified without revealing the value. No configuration was modified by the agent. Existing deployments have not been certified to use this update.

No integrated hosted Preview exists yet. Full customer/admin staging journeys, hosted mobile behavior, bilingual/theme/analytics behavior, authenticated cross-customer HTTP tests, hosted controlled Redis outage and native concurrency remain unverified for this candidate. A previous staging deployment is not proof for this code.

## Release and recovery gates

1. Preview token scope is resolved. Verify its runtime connectivity and staging Supabase/Redis/provider isolation without exposing secrets.
2. Complete outstanding branch classification and review combined diff; ensure a fresh main comparison before release.
3. Verified logical archive exists. Complete role/Storage recovery coverage and verify restoration in an isolated environment with delivery disabled; refresh backup before approved production changes.
4. Capture complete current production definitions/ACLs/policies/triggers/indexes/auth/storage/cron state; implement production-compatible forward migration guarded against unknown drift. Preserve existing orders/counters and old RPC behavior during rollout.
5. Test migration on restored production copy, compare data invariants and exercise stock/promo concurrency and recovery.
6. Complete frozen install/CI and native PostgreSQL tests; review remaining dev advisory.
7. Deploy only to isolated `kultura-staging`; verify exact commit/READY and full browser/security matrix.
8. Only then prepare final release PR, verify checks, apply reviewed compatible DB update and release main through the existing integration.

Rollback: no production changes have occurred, so no production rollback is presently needed. Preserve original audit/security worktrees. For a future release, save the exact prior production deployment/commit and all replaced function definitions, ACLs, policies, triggers and cron definitions. A code rollback must retain compatible RPCs; after real orders/reservations are written, do not drop ledgers, reset counters or blindly reverse SQL. Use a tested forward recovery/reconciliation procedure and preserve new orders. No executable production rollback SQL is certified until the compatible migration and restore test exist.

Final integration commit SHA: none (uncommitted work).
Production deployment URL for this release: none.
Production smoke tests for this release: not run; release did not occur.

**PRODUCTION NOT READY — BLOCKED**

## Additional verification on 2026-10-19

- Local production-build homepage checked at requested widths 320, 375, 390 and 430 (820 height). Browser scrollbar reduced content widths to 305, 360, 375 and 415; scrollWidth equaled clientWidth at every size. No horizontal document overflow detected.
- Initial image loading was transient: a subsequent DOM observation found no images with zero naturalWidth. The phone globe loaded. A 320-wide screenshot showed the current hero and navigation rendering.
- At 430 width the empty shop rendered its explicit collection-preparation message. Mobile navigation opened and closed successfully. Captured browser error/warning entries were empty. Viewport was reset after testing.
- These observations used localhost:3100 without database configuration. They do not establish authenticated, populated-catalog, hosted, scroll-animation, or checkout correctness.
- Fresh native PostgreSQL attempt did not reach concurrency tests: initdb completed for an isolated local fixture; pg_ctl could not start due to Windows restricted-token error 87/start error 3. No hosted connection or migration was attempted. PGlite results are not native multi-connection evidence.
- Production backup prerequisite was raised with the user: approved secure local logical-backup access or an existing complete backup plus isolated restore is needed. No credential value was requested in chat. Production remains blocked.

## Final migration refresh — 2026-10-20

Fresh main fetch remains cc5e2e8285b063ac0415ca5246f17d78cbfaa031. git diff --check passed (line-ending warnings only). Fresh hosted read-only metadata was compared against all 21 repository migrations: staging has 0 missing / 0 differing / 0 additional objects within the schema comparator scope; production has 76 missing / 12 differing / 8 additional. This is not an ACL/cron/auth/storage certification.

The production checkout_submit function deducts stock and increments promo usage; a separate legacy authenticated checkout_create_unpaid_order path does not deduct stock. The candidate checkout_submit_order RPC is absent in Production. This requires a new compatibility migration; deploying code first or replaying staged reservation SQL is unsafe. Detailed migration/recovery requirements are in docs/PRODUCTION-COMPATIBILITY-PLAN.md.

Fresh Vercel deployment-list requests for both kultura and kultura-staging with explicit kultura4 team scope returned HTTP 403. No Vercel CLI was found in the current command environment. Exact active deployment, environment values and runtime logs are not certified by these calls. No credentials were requested or changed; no release was performed.

## Latest execution evidence — 2026-10-20

- Browser dashboard successfully verified kultura's current Production deployment as Ready: kultura-8zc4mzm69-kultura4.vercel.app, deployment 7mmzswY6CNwuKixVBZoQJkjBDRnh; alias kultura-liart.vercel.app; source main at cc5e2e8285b063ac0415ca5246f17d78cbfaa031. This resolves current deployment identity via UI, despite connector 403. It is the unchanged existing deployment, not a release of this candidate.
- Production project environment list and Shared tab were inspected without revealing values. UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and RATE_LIMIT_HMAC_KEY were absent; Shared tab reported no shared variables linked. User agreed to prepare separate Production values; completion and runtime correctness are NOT verified. No settings were changed by the agent.
- The list contains SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY across Production and Preview. Names/scopes alone do not certify values or isolation. RESEND_API_KEY exists, but SUPABASE_SECRET_KEY was not listed; backend notification dispatch readiness remains unverified. TBC_API_KEY presence is not proof of a completed payment integration. No provider was selected or enabled by this work.
- Fresh direct Node executions: TypeScript exit 0; ESLint exit 0; security 55 passed; auth 32 passed; reservations 17 passed; reconciliation 11 passed; database boundary audit exit 0; repository secret scan 266 files, zero findings. These are local tests, not hosted proof.
- Fresh Next.js production build completed successfully (exit 0), including TypeScript and route generation. Database boundary audit: 23 passed, 0 failed. Frozen installation / aggregate pnpm check and native concurrency remain separate unresolved gates; this build does not certify them.


## Isolated runtime gate follow-up — 2026-10-20

An explicit-path pg_ctl retry against the disposable synthetic cluster failed with restricted-token error 87 / server-start error 3. No server or restore started. No ACL, Windows feature or security policy change was attempted. Docker is absent from the command environment; wsl.exe returned installation/help output rather than a usable distribution inventory.

Archive extension inspection found pg_stat_statements, pgcrypto, supabase_vault and uuid-ossp. The portable PostgreSQL installation lacks supabase_vault. A partial restore excluding that extension cannot be certified as a complete recovery test. A compatible isolated Supabase environment is needed; user was asked to choose local Docker/Supabase or a separate explicitly approved restore project. Do not upload the production archive to a third-party target before authorization.

A local synthetic-only concurrency runner was prepared outside the repository at work/Test-KulturaConcurrency.ps1. Its syntax passed; execution has NOT passed. It strips inherited PostgreSQL/Supabase/production-backup variables, creates a fresh loopback-only test cluster, runs the existing independent-connection test and shuts the cluster down. It does not restore or access production data. This is a fallback for normal-user execution outside the restricted Codex process, not an instruction to change Windows ACLs.

A fresh production environment UI inspection still did not show the three Redis/HMAC variables. User's earlier promise to prepare them remains pending; no credentials were revealed or settings changed. Production release remains blocked.
