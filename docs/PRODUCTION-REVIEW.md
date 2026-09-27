# Production preparation report

## Outcome

The project is prepared for a Vercel deployment after service configuration and hosted acceptance testing. It is not ready to accept purchases: checkout, payment verification, order creation and inventory reservations remain outside the implemented scope. No external deployment or account changes were made.

## Fixes and additions

- Corrected unknown informational routes to return HTTP 404, including prototype-property names such as constructor/toString. Scoped Auth and catalog invalidation so it does not invalidate unrelated static informational pages.
- Reduced image uploads to 3 MiB with browser-side rejection, server decoding/validation and a new Storage bucket migration (20260926000100_vercel_upload_limit.sql). This leaves multipart overhead below Vercel's request cap.
- Added safe client feedback for failed Server Action transport and temporary recovery-email service/rate-limit failures.
- Fixed featured sorting, displayed compare-at pricing, limited related-product display to four and limited illustrative-image labelling to the actual development image paths.
- Made unavailable newsletter signup explicitly disabled instead of accepting an email it would not save.
- Added canonical metadata, a social sharing card, Twitter metadata, Apple icon, robots.txt and a dynamic public-catalog sitemap. Indexing requires an explicit production switch; private routes remain noindex.
- Added no-sniff, frame-denial, referrer and permissions headers; preserved Next.js origin validation and narrow Supabase image allowlisting.
- Validated deployment origins/keys and rejected credential-bearing URLs. Added Vercel configuration, Node 24 pin, environment example, CI workflow and redacted secret scanning.
- Stabilized account order pagination and added textarea focus styling and a named mobile navigation dialog.
- Source tests now use the existing TypeScript compiler in-process. Production builds use Next's documented TypeScript API checker and worker threads; no TypeScript/ESLint checks were disabled.

## Verification

| Check | Result / scope |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed, including full TypeScript checking and route generation |
| Database types | Match all migrations |
| Database / catalog / Phase 3 / configuration tests | 63 + 13 + 38 + 14 = 128 passed |
| Production HTTP checks | 24 passed: routes, actual 404s, security headers, canonical/social metadata, assets, robots/sitemap and invalid callback redirect |
| Current browser responsive checks | 24 fully loaded checks: home/shop/login/cart at 375, 390, 430, 768, 1024 and 1440 px; no horizontal overflow or broken loaded images |
| Other current browser checks | 14 public/guard/not-found route inspections; menu and bag opening/Escape; safe unavailable-auth submission; reviewed mobile and desktop screenshots |
| Browser console | No warning/error entries in inspected in-app browser session |
| Dependency audit | Zero known vulnerabilities in the recorded npm audit, including development dependencies |
| Secret scans | No findings in the project text scan or client JS bundle boundary scan |

The 83-check authenticated browser report from Phase 3 is historical. Its fresh standalone Edge run was blocked by Windows process permissions. Current browser checks used the in-app browser on the rebuilt app with Supabase unconfigured. The isolated test server launch with fixture configuration was also denied by the active approval policy. Real signup/confirmation/recovery email delivery, authenticated admin/customer flows and actual Storage operations must still be tested on the connected staging project. Unit/RLS tests use isolated PostgreSQL and are not hosted Supabase certification.

## Still required before launch

1. Configure Vercel, a production Supabase project and a custom SMTP service; apply all six migrations.
2. Populate approved real catalog/category/collection data and bootstrap the verified administrator through trusted SQL.
3. Supply customer support details, garment care/sizing information and final privacy, terms, delivery and returns policies. Development sample images/data must not be mistaken for actual sale items.
4. Complete the deployment guide's hosted acceptance checklist, including auth expiry/recovery, image CRUD, customer isolation and admin mutation rejection.
5. Connect the actual custom domain and update canonical/Auth URLs. The domain and DNS provider were not supplied.
6. Implement and verify checkout/payments/order creation in a separately authorized phase before accepting orders.
7. Newsletter/Instagram remain unfinished business integrations. The newsletter is visibly disabled.

Operational limitations: Storage and database updates cannot be one transaction, so interrupted operations may require orphan cleanup. Public product-image URLs are public even for draft products. Full-catalog fetching should become server-side pagination/search before scaling to a large catalog. No external performance/load test or hosted Vercel deployment was performed.

See DEPLOYMENT.md for all environment variables, exact deployment steps, Supabase setup, domain/DNS instructions and launch checks.
