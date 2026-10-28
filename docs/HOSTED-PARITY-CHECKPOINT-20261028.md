# KULTURA hosted parity checkpoint — 2026-10-28

> **Production release: BLOCKED.** Read-only checkpoint of the currently connected GitHub, Vercel and Supabase environments. No customer records were queried; no SQL migration, deploy, merge, credentials change or data mutation was performed.

## Verified release pointers

| Surface | Observed state |
| --- | --- |
| GitHub `main` | `cc5e2e8285b063ac0415ca5246f17d78cbfaa031` — approved Motion+ release (PR #51, merged October 18) |
| Vercel `kultura` production | `READY`, commit `cc5e2e8`; alias `kultura-liart.vercel.app` |
| Vercel `kultura-staging` | Latest `READY` deployment uses commit `cc5e2e8` |
| GitHub PR #48 | `audit/master-hardening-20261012` remains **open/draft** at `56c082f15415ea60a8bd89cc14ce17e1199ef124` before this checkpoint |
| Supabase production | `KULTURA`, `ACTIVE_HEALTHY` |
| Supabase staging | `KULTURA staging`, `ACTIVE_HEALTHY` |

A Vercel `READY` state proves a successful deployment build; it does **not** certify checkout, payments, authentication, or runtime tests.

## Read-only SQL findings

The following were compared using `pg_proc`, `to_regprocedure`, `pg_class`, `information_schema.columns`, `pg_trigger` and role privilege metadata. Fingerprints are `md5(replace(prosrc, chr(13), ''))` matching PR #48's guard convention.

| Object / property | Production | Staging |
| --- | --- | --- |
| `public.checkout_create_unpaid_order(jsonb,jsonb,text)` | Present, hash `9700e36290f01749bc3e86856df6bfb4`; **authenticated EXECUTE allowed** | Present, hash `d46730dfaa22f994777c3fb9a00e03fa`; authenticated EXECUTE denied |
| `public.checkout_submit_order(uuid,jsonb,jsonb,text)` | Absent | Present, hash `c588d20ea335f767b0f058f0603be90e`; authenticated EXECUTE allowed |
| `public.notification_prepare(uuid,text)` | `54e2dca5a00c7908c050627d241e91f2`; **authenticated EXECUTE allowed** | `c05e3cf3662124116af93865d70bb75a`; authenticated EXECUTE denied |
| `public.notification_record_delivery(uuid,text,text)` | `a3f74ab4fe6bb0829d09cbae4760165a`; **authenticated EXECUTE allowed** | `53a22ce0e9f5d613e1e2a9675bc55adb`; authenticated EXECUTE denied |
| `public.notification_claim(uuid,text)` | Absent | Present; authenticated EXECUTE denied |
| `private.customer_rate_limit(text,integer,integer)` | Absent | Present; authenticated EXECUTE denied |
| `private.request_limits` and `private.checkout_requests` | Absent | Both present with RLS enabled |
| `private.checkout_settings` | Present; **RLS off** | Present; RLS on |
| Outbox claim timestamps | Absent | `email_claimed_at` and `sms_claimed_at` exist |
| `orders_queue_notification` trigger | Absent | Present |
| `supabase_migrations.schema_migrations` | Absent (migration history not available through Supabase migrations API) | Present; three entries reported: `20261015201827`, `20261017211555`, `20261018111916` |
| Reservation machinery | Not observed | `private.reserve_checkout_order(uuid,uuid)`, two RLS reservation tables and `orders_resolve_checkout_reservation` trigger present |

**Important: staging has evolved beyond the October 14 candidate.** A read-only inspection of its `checkout_submit_order` shows the additional call `private.reserve_checkout_order(order_id,promo_id)`, absent from PR #48's October 14 function. The stage migration `checkout_stock_promo_reservations` must be reconciled; blindly replacing this function would risk losing reservations. The existing guarded PR #48 migration should *refuse* the unreviewed staging body, rather than overwriting it.

**Important: production differs from the candidate baseline.** PR #48's migration only accepts legacy `checkout_create_unpaid_order` hash `d46730df...`; live production is `9700e362...`. A direct run should fail its guard and is **not** authorized. Comparing the two hosted definitions shows the staging version adds explicit SQL NULL-cart and NULL-address rejection. Do not simply whitelist the production fingerprint without separately validating the prerequisite `20261012000100_checkout_null_inputs.sql` and the complete migration chain.

The security advisor also reported executable `SECURITY DEFINER` functions (14 production / 10 staging) and disabled leaked-password protection in both projects. These advisory counts are **not** a conclusion that all listed functions are vulnerable; each must be checked against its authorization logic. Review [Supabase security-definer function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Private RLS tables without policies can be intentional.

## What is still required before changing hosted SQL or production code

1. **Freeze and reconcile source:** compare `main`, PR #48, and the three staging-only migrations; determine the authoritative checkout, stock reservation, promo-use, outbox, authorization, and quote semantics. The staging hosted SQL is not equivalent to the PR #48 candidate. Review any other hosted-only functions/triggers and the old checkout RPCs still executable on production.
2. **Document complete hosted migration provenance:** production has no tracked Supabase migration history table; do not infer that baseline migrations are absent. Match exact schema, owners, constraints, policies, grants, triggers and function definitions before preparing a *new*, guarded forward migration in repository source. Do not edit/replay historical migrations.
3. **Secure rollback:** obtain and independently verify a production restorable backup or PITR checkpoint; record targeted pre-migration definitions, privileges and current order/promo/outbox counts without exposing customer data. The prior Windows backup failure is not evidence of a successful backup.
4. **Staging rehearsal:** apply only a reviewed, schema-compatible forward migration to the isolated staging project, preserving the existing reservation functionality; ensure the staging application actually targets the staging DB. Run migrations, negative privilege tests, true independent-connection concurrency tests, idempotent checkout/network retry, stock/promo allocation, outbox claims and recovery, and authenticated 390px/1440px browser E2E with disposable accounts. No real payments or customer messages.
5. **Release gate:** verify exact Vercel team/project/commit, environment *presence* without printing values, GitHub checks and rollback path. A schema-breaking change needs a coordinated checkout maintenance window. Only after all required gates pass, review the production deploy and migration together.
6. **Merchant decisions:** confirm policy for promo uses on unpaid orders, inventory reservation/expiration and provider-based payment confirmation before shipping behavioral changes.

## Known limitations

This checkpoint did not inspect secrets, payment gateway account settings, runtime logs, authenticated checkout, backup restore capability or actual browser execution. The separate staging project's presence and deploy SHA alone do not prove its environment variables point at the staging database. The live storefront could not be fetched from the public browsing tool in this session, so no storefront smoke-test claim is made.

**Disposition:** keep PR #48 **draft**. Do not merge it to `main`, apply its October 14 SQL to either hosted database, or declare the security hardening released on the evidence above.
