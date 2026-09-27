# Phase 3: accounts, cart and administration

The existing KULTURA storefront and catalog routes remain in place. Checkout, order creation, inventory reservations and TBC payments are deliberately absent.

## Configure Supabase

1. Create or select your Supabase project. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local and your deployment's server environment. A legacy anon JWT is also accepted. Never configure a service-role key in this app. Set SITE_URL to the canonical HTTPS origin (http://localhost:3000 for local development).
2. Using the Supabase CLI, run supabase login, supabase link --project-ref YOUR_PROJECT_REF, then supabase db push --dry-run. Review the changes and run supabase db push. If Phase 2 is already applied, only the three new migrations should be pending. Do not reapply or replace the existing Phase 2 migrations. On an empty project, apply all five in chronological order.
3. For development only, execute supabase/seed.sql through the SQL editor. This is repeatable and does not overwrite catalog edits. Never import QA fixture accounts or orders into a real project.
4. Enable email/password Auth and email confirmation. Set Auth's Site URL to SITE_URL and explicitly allow your origins' /auth/callback and /auth/callback?next=/reset-password URLs. Configure a production SMTP provider, appropriate Auth rate limits and password policy (the UI requires 12–128 characters). Test signup, confirmation, login, refresh, logout and recovery against your hosted project.
5. Default Supabase email redirects use the PKCE callback and should open in the same browser that requested the email. To support confirmation on another device, customize confirmation and recovery templates to your fixed trusted origin followed by /auth/confirm?token_hash={{ .TokenHash }}&type=email or type=recovery respectively. Never construct that origin from user-controlled metadata. Verify templates on the hosted project.
6. Sign up and confirm your intended administrator normally. Obtain its UUID from Authentication / Users. In the trusted SQL editor only, run the following with that exact UUID. Verify the account identity before running it.

~~~sql
update public.profiles set role = 'admin'
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
~~~

Revoke admin access by setting role back to customer. Neither users nor app administrators can edit roles through the app or public API. No hardcoded admin identity exists.

The Storage migration creates the public product-images bucket with a 5 MB size limit and JPEG/PNG/WebP MIME allowlist. Authenticated protected-profile administrators alone can upload/delete; object overwrites are denied. Server actions decode uploads, reject mismatched/animated/oversized images, strip metadata and re-encode WebP under random UUID paths. All images in this bucket, including draft product images, are intentionally public assets. Do not upload confidential images.

## Routes

Authentication: /login, /register, /forgot-password, /reset-password, /auth/callback, /auth/confirm.
Customer: /account, /account/orders, /account/addresses, /cart.
Administration: /admin, /admin/products, /admin/products/new, /admin/products/[id], /admin/orders, /admin/orders/[id].

## Database and security

Phase 2's eleven tables and original migration files are preserved.

- 20260924000100_admin_authorization.sql: protected-role helper, catalog administration and order-read RLS, atomic product/collection save, optimistic concurrency, image attach/reorder RPCs.
- 20260924000200_product_storage.sql: public image bucket and admin-only object policies.
- 20260924000300_customer_address.sql: identity-derived address save and serialized default-address changes.

Generated TypeScript types include RPCs. The seed's image insertion now supports the deferred ordering constraint.

Every protected page/data request verifies Supabase Auth getUser and the protected profile. Every mutation repeats authorization; layout visibility is not the security boundary. RLS independently enforces customer isolation and admin catalog permissions. Profiles allow only name/phone updates. Orders and payment states remain read-only for customers and administrators. Server Actions retain Next.js origin checks. Session cookies are HTTP-only, SameSite=Lax and Secure on HTTPS. Private routes refresh sessions and emit no-store headers.

Product/collection assignments save transactionally. Product, variant and image edits reject stale versions. Image reorder validates the complete ordered set transactionally. Archive removes storefront visibility without deleting purchase history. React escapes text; product descriptions are never interpreted as HTML.

## Cart

Versioned local storage contains product/variant IDs, option labels, quantity and an optional previously observed price used only for change notices. Pure cart operations are separated from server quotation and the React provider. Each quotation retrieves current active catalog data through the server-only anonymous repository. Submitted prices, totals and stock are ignored. Changed prices, reduced stock, missing variants and sold-out products are explained in the UI. Corrupt storage becomes an empty bag.

This cart does not reserve inventory. Future checkout must re-read prices and inventory transactionally; a current quotation is not authorization to charge. Signed-in cross-device synchronization is deferred. Storage may be unavailable in privacy modes; the current session remains usable.

## Verification

Run:

~~~sh
pnpm typecheck
pnpm lint
pnpm test:db
pnpm test:catalog
pnpm test:phase3
pnpm db:types:check
pnpm build
node scripts/audit-client-bundle.mjs
~~~

The Phase 2 database suite intentionally tests the historical Phase 2 policy boundary. Phase 3's suite applies all migrations and tests new admin permissions and continuing customer restrictions. Both use isolated PostgreSQL with minimal Supabase schema shims.

Browser QA runs the actual production app and Server Actions against scripts/phase3-browser-fixture.mjs, an explicitly test-only Auth/PostgREST transport with RLS-protected local SQL. It is not a Supabase emulator and does not verify hosted email delivery, GoTrue token validation or real Storage HTTP behavior. Fixture credentials are synthetic and have no external authority. The fixture listens only on loopback. Do not deploy it. Reports and screenshots are under qa/.

To reproduce browser QA, start the fixture with node scripts/phase3-browser-fixture.mjs; run the production app on port 3002 with SUPABASE_URL=http://127.0.0.1:54329, SUPABASE_PUBLISHABLE_KEY=sb_publishable_TEST_ONLY_NOT_REAL and SITE_URL=http://localhost:3002. Set PLAYWRIGHT_MODULE to your installed Playwright index.mjs path, then run node scripts/test-phase3-browser.mjs. It uses the installed Edge browser.

## Remaining deployment checks

No hosted Supabase project was configured or modified. Verify real Auth emails/session expiry and Storage upload/removal after applying migrations. Database and Storage changes cannot share a transaction: upload failures trigger cleanup, and deletion cleanup failures show a safe warning, but abandoned network requests can leave orphan objects for operational cleanup. Existing bucket policies from outside this repository must be reviewed for broader write access before launch.

Complete the privacy notice and commercial policies before accepting real customer registrations. Seed product imagery and content remain illustrative. No checkout, paid-order simulation, payment status editing, service-role application credential, or deployment was added.
