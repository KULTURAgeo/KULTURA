# KULTURA

Premium streetwear storefront with a Supabase/PostgreSQL foundation. Phase 3 preserves the existing black/silver design and routes. Ordering remains closed.

## Production preparation

Read [the current verification report](docs/PRODUCTION-REVIEW.md) and [Vercel, Supabase and custom-domain deployment instructions](docs/DEPLOYMENT.md). Checkout remains closed. Older phase reports are historical.

## Run

Node.js 24 LTS and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Set the server-side Supabase values and SITE_URL in `.env.local` using `.env.example`. Without configuration, the catalog displays a preparation notice and no products. There is no mock fallback.

See [Phase 3 setup, Auth, administration and security](docs/PHASE-3.md) for migration and seed instructions. No hosted project has been modified.

## Architecture

- `src/app`: preserved routes; catalog pages render server-side on request.
- `src/components`: existing visual system and presentational interactions.
- `src/lib/catalog.ts`: UI product/category types and money formatting.
- `src/lib/catalog/repository.ts`: server-only Supabase reads, pagination and failure states.
- `src/lib/catalog/mapper.ts`: public database rows mapped to storefront data.
- `src/lib/supabase`: publishable-key client and generated database types.
- `supabase/migrations`: transactional schema and RLS migrations.
- `supabase/seed.sql`: explicit development seed for the four original example products.
- `scripts`: isolated database, repository and client-bundle security checks.
- `qa`: verification results. Phase 1 screenshots/results are historical.

## Verify

```sh
pnpm test:db
pnpm test:catalog
pnpm test:phase3
pnpm db:types:check
pnpm typecheck
pnpm lint
pnpm build
node scripts/audit-client-bundle.mjs
pnpm start
```

Run `pnpm db:types` after schema changes. Tests run an isolated PostgreSQL engine with Supabase auth shims; repository tests use the actual SDK with test-only HTTP responses. Hosted PostgREST/Auth/Storage still require verification on the connected project.

## Current scope

Homepage, catalog search/filter/sort, categories, drops and product pages use database-backed public data. Per-variant stock is display information. Multiple ordered product images are supported; a single image retains the existing labelled crop view.

Customer authentication, private profiles/addresses/orders, a persistent server-quoted cart and protected product/inventory/image administration are implemented. Admin orders are read-only. Newsletter signup is visibly disabled until an email-list integration exists. No checkout, order creation, inventory reservation, promo redemption or payments exist. No service-role key is used by the application.

The deployment target remains Vercel; nothing was deployed. Search indexing remains disabled until launch preparation is authorized.

## Imagery

Campaign: [Bùi Hoàng Long on Unsplash](https://unsplash.com/photos/a-man-standing-next-to-a-wall-with-graffiti-on-it-If3YeZMcHQQ). Seed catalog imagery is AI-generated illustrative sample photography. Replace it with approved KULTURA assets before commerce opens. Local images work without Storage; Storage bucket setup is documented separately.

## Reports

- [Phase 3 completion report](docs/PHASE-3-REPORT.md)

- [Phase 3 setup and security](docs/PHASE-3.md)
- [Phase 3 security and behavior tests](qa/phase3-results.json)
- [Phase 3 browser verification](qa/phase3-browser-results.json)

- [Phase 2 setup, security decisions and remaining risks](docs/PHASE-2.md)
- [Database policy results](qa/database-results.json)
- [Catalog repository results](qa/catalog-results.json)
- [Phase 2 browser results](qa/phase2-browser-results.json)
- [Client bundle audit](qa/secret-audit.json)
- [Historical Phase 1 QA](docs/QA.md)
