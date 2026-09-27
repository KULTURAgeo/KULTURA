> Historical Phase 2 report. Phase 3 adds protected administrator catalog writes, Auth and Storage; see [current setup](PHASE-3.md).

# Phase 2 — Supabase database foundation

The existing visual system, styles, header, footer and route paths are preserved. Catalog pages now use a server-only repository; there is no mock fallback. No hosted Supabase database has been modified.

## Connect a Supabase project

Use a new development Supabase project first. These migrations assume the eleven table/type names do not already exist. For an existing database, inspect and baseline its schema before applying migrations; do not reset a populated remote project.

From this project directory, with the Supabase CLI installed:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

The CLI keeps migration history. Apply both migrations in filename order. Alternatively run their SQL in the Dashboard SQL Editor in that order, but reconcile CLI migration history before later CLI deployments.

For development only, load the existing examples explicitly:

```sh
supabase db push --include-seed
```

The seed is re-runnable and does not overwrite existing product edits or stock. Do not load example products into the production catalog by accident.

Copy `.env.example` to `.env.local` and set:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Get the project URL and publishable key from the project's Connect/API Keys panel. A legacy anon JWT is also supported. Never use a secret key, service-role key or database password for this variable. The reader rejects privileged key formats before querying. Both values are server-side; no NEXT_PUBLIC variables are needed. Do not paste credentials into source control.

Restart `pnpm dev` after setting the environment. Configure the same two values in Vercel when you later deploy, then rebuild (the image hostname allowlist is built from the URL). No environment is required to build: missing configuration shows an honest, empty preparation state.

Keep the `private` schema out of Supabase's exposed API schemas. There is no Storage bucket or upload endpoint provisioned in this phase. Development seed images use the existing local files. To use `storage_path`, first prepare an approved public `product-images` bucket and upload only publishable catalog photography. Public-bucket files are public regardless of product RLS; never put confidential draft assets there. Private draft media and upload policies remain deferred. HTTPS URLs outside the configured project bucket are intentionally replaced by a local placeholder.

## Migrations

- `20260923000100_commerce_schema.sql`: eleven tables, enums, keys, checks, indexes, timestamps, auth-profile creation/backfill, baseline RLS and revoked browser privileges.
- `20260923000200_row_level_security.sql`: explicit read policies, owner-only profile/address permissions and order-history read access.

Both files are transactional. New tables have RLS enabled and browser grants revoked before the first transaction commits.

## Tables

| Table               | Purpose                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| profiles            | Auth-user profile, protected role, name, phone                                                    |
| categories          | Unique slug, active state, display order                                                          |
| products            | Unique slug, integer GEL prices, status, featured/drop, category, SEO                             |
| product_variants    | Unique SKU, case-insensitive size/color uniqueness, nonnegative independent stock, active state   |
| product_images      | Exactly one URL or storage path, unique product position, alt text                                |
| collections         | Unique slug, description and active state                                                         |
| product_collections | Many-to-many membership and order                                                                 |
| addresses           | Owned customer addresses; at most one default                                                     |
| orders              | Customer, generated unique number, currency, amounts, statuses, delivery snapshot                 |
| order_items         | Product/variant references plus purchased name, slug, SKU, size, color, price and image snapshots |
| promo_codes         | Fixed-minor-unit or basis-point discounts, dates, bounds, usage counters; no redemption API       |

Amounts are integer minor units: GEL 249 = 24900 tetri. Catalog currency is GEL because the storefront is GEL-only. Orders reserve a three-letter currency field for future use. Order item currency is inherited from its parent order. Row totals use bigint arithmetic in checks to avoid intermediate overflow. Integer monetary columns cap any one amount at 2,147,483,647 minor units.

Deleting an auth user removes profile/addresses and detaches order ownership, while retaining the delivery/purchase snapshot. Referenced products, variants and orders cannot be deleted: archive catalog records instead. Unpurchased product children and collection memberships cascade. Categories with products cannot be deleted. Data retention/anonymization policy must be settled before collecting real orders.

## RLS / privilege matrix

| Data                    | Anonymous                                                                  | Authenticated customer                                     |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Products/categories     | Read active products in active categories                                  | Same public catalog                                        |
| Variants/images         | Read active variants and images of readable products                       | Same                                                       |
| Collections/memberships | Active collections; memberships only when both parent records are readable | Same                                                       |
| Profiles                | No access                                                                  | Own row read; update only full_name and phone              |
| Addresses               | No access                                                                  | Own row read/create/update/delete; owner cannot be changed |
| Orders/items            | No access                                                                  | Read own history only                                      |
| Promo codes             | No access                                                                  | No access                                                  |

There are 14 policies. Grants and RLS work together: profile role/identity/timestamps have no client UPDATE grant, and clients have no INSERT/UPDATE/DELETE grants for commerce tables. Even a profile labelled admin receives no special API write permissions in Phase 2. Auth metadata is never used to assign roles. New profiles always default to customer.

Only trusted SQL and service_role can manage catalog/orders/promotions. No application service-role client exists. There are no exposed security-definer RPCs. The sole security-definer function is the private auth trigger, with an empty search_path, fully qualified names and revoked public execution.

## Data access and types

- `src/lib/supabase/server.ts`: server-only, anonymous/publishable Supabase reader, no sessions, no-store fetch and 10-second request timeout.
- `src/lib/supabase/database.types.ts`: generated Row/Insert/Update/relationship/enum types for all eleven tables.
- `src/lib/catalog/repository.ts`: explicit public fields, paged reads, exact slug lookup, sanitized failures, per-render React deduplication.
- `src/lib/catalog/mapper.ts`: database rows to the existing presentation model; image ordering/alt text/fallback and active variants.
- `src/lib/catalog.ts`: UI types and GEL formatting only; no products array.
- `scripts/generate-database-types.mjs`: regenerates types by executing and introspecting these migrations in isolated PostgreSQL.
- `pnpm db:types:check`: prevents migration/type drift.

Catalog routes are rendered on request, so newly published products work without rebuilding route lists. Unconfigured, empty and unavailable catalogs are separate states; connection failures do not fabricate products or display database errors. Product metadata uses database SEO fields. Stock in the browser is informational, not a reservation.

After deployment, optionally compare types with the hosted schema using `supabase gen types typescript --linked --schema public`. Do not blindly replace the migration-derived types with output from an unrelated or drifted database.

## Validation

Run:

```sh
pnpm test:db
pnpm test:catalog
pnpm db:types:check
pnpm typecheck
pnpm lint
pnpm build
```

Database tests execute migrations/seed against PGlite's PostgreSQL engine, with minimal auth roles and auth.uid() shims. They test RLS under anon/authenticated/service_role, customer isolation, profile-role injection, denied price/stock/order writes, constraints and historical snapshots.

Repository tests use the real Supabase JS SDK with a test-only HTTP response double backed by RLS-filtered SQL. This verifies listing/detail mapping, multi-page retrieval, images, empty states, failures and key rejection. It is not a test of hosted PostgREST, Supabase Auth or Storage. Test-only transport code is confined to scripts and is not used by the application.

## Remaining work and risks

- Hosted migration application and end-to-end checks against your actual Supabase project remain unverified until configured.
- No checkout, payments, admin dashboard, login UI, cart persistence or promo redemption was implemented.
- Before ordering: an atomic trusted order operation must recalculate prices/discounts, enforce aggregate item totals, reserve stock safely and provide idempotency. Current checks protect each row; they do not synchronize orders with the sum of order_items or manage concurrent reservations.
- Before TBC: provider verification and payment-state transitions require a separate authorized phase.
- Public catalog inventory quantities are readable by design. Privileged service-role operations bypass RLS and must stay restricted to trusted backend paths.
- The current catalog UI still receives all public products; the repository fetches them in pages. A large inventory will need server-driven search/pagination.
- Seed photography and product details remain illustrative. Storage upload security, real-device browser QA, retention rules and operational monitoring remain launch work.

Official references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [CLI deployment workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [TypeScript support](https://supabase.com/docs/reference/javascript/typescript-support).
