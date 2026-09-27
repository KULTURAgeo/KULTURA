# KULTURA production deployment

## Current release status

The code has been hardened for Vercel, but this is NOT yet a launch-ready purchasing service. Checkout, order creation, payment processing and inventory reservations remain intentionally unimplemented. Customers can browse, use a local cart and manage an account once Supabase is configured; they cannot place an order.

The latest local full production build passes. Next.js uses its documented TypeScript API checker and worker threads to remain compatible with restricted Windows process execution; standalone tsc also passes. No build checks have been disabled. Current verification is recorded in PRODUCTION-REVIEW.md. Hosted Auth/Storage and authenticated browser flows still require staging verification; historical Phase 3 browser results are not certification of this revised release.

No Vercel project, hosted Supabase project, GitHub repository, DNS record or external account was created or changed.

## Required services

- Vercel: Next.js server rendering, Server Actions, hosting, TLS and image optimization. This app cannot use static-only hosting.
- Supabase: PostgreSQL, Auth and the public product-images Storage bucket.
- SMTP provider: configure credentials in Supabase Auth, with a verified sender domain and required SPF/DKIM/DMARC records from that provider. Supabase's default email service is not a production delivery service.
- GitHub (or another supported Git provider): source control and deployment integration. The local Git repository currently has no commits.
- Your domain registrar / DNS provider: only needed for a custom domain.

Still missing: approved real product photography/descriptions/SKUs/stock, garment care and size information, working customer support contact, privacy/terms/shipping/returns policies and the next checkout/payment phase. Newsletter signup is deliberately disabled until a mailing-list provider and consent flow exist. Instagram is still labelled coming soon. These business details cannot safely be invented.

## All environment variables

| Variable | Required | Where / value |
| --- | --- | --- |
| SUPABASE_URL | Yes for hosted deployment | Exact Supabase project HTTPS origin, with no path |
| SUPABASE_PUBLISHABLE_KEY | Yes for hosted deployment | Publishable key or legacy anon JWT; NEVER service_role or sb_secret_ |
| SITE_URL | Yes for hosted deployment | Exact canonical HTTPS origin, e.g. https://your-domain.example |
| SITE_INDEXABLE | Optional, default false | Keep false until the launch checklist is complete; then true in Production only |
| ENABLE_EXPERIMENTAL_COREPACK | Yes for the documented Vercel setup | 1 in Vercel build environments; honors packageManager pnpm@11.25.0 |
| VERCEL / VERCEL_ENV | Platform-managed | Supplied by Vercel; do not set yourself |
| QA_BASE_URL | Optional, HTTP QA only | Base URL for scripts/test-production-http.mjs; defaults to http://localhost:3000 |
| PLAYWRIGHT_MODULE | Optional, local browser QA only | Absolute path to an installed Playwright index.mjs, if not resolvable as playwright |

Node is pinned to 24.x. The package manager is pinned in package.json. Vercel uses the lockfile/Corepack and the build:vercel command from vercel.json. That command rejects missing URLs, localhost URLs, credentials in URLs, privileged keys and known test keys before building. It does not verify that credentials work or that migrations are applied.

There are no NEXT_PUBLIC variables, application SMTP keys, payment keys or service-role keys. Supabase's publishable key is intentionally public by design, but the server validates it and passes only this public key and URL to the browser SSR session client. Data authorization remains enforced by RLS and server guards.

Use separate Supabase projects for production and development/staging. Set Preview environment variables separately. For staging Auth, use a fixed staging URL on the same origin you actually open; PKCE recovery may not survive a change of browser or domain. Do not point arbitrary preview deployments at production customer data. Vercel previews stay noindex regardless of SITE_INDEXABLE.

## Step 1 — verify locally and prepare Git

Open a terminal in outputs/kultura (the directory containing package.json):

~~~sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm build
corepack pnpm audit:secrets
corepack pnpm audit --audit-level=high
~~~

Do not deploy if a command fails. The aggregate check uses &&, so failures stop it. The custom in-process TypeScript loader only runs source tests; it does not replace tsc or suppress errors.

Create a private GitHub repository without adding a README. In the KULTURA directory:

~~~sh
git status --short
git add .
git diff --cached --stat
git diff --cached -- .env.example
git commit -m "Prepare KULTURA for Vercel deployment"
git branch -M main
git remote add origin YOUR_PRIVATE_REPOSITORY_URL
git push -u origin main
~~~

Review the staged files before committing. .env.local, node_modules, .next and local QA screenshots are ignored. Never commit credentials. If a remote already exists, inspect it instead of running remote add again. The supplied GitHub Actions workflow runs install, type/lint/tests, audit, build and secret checks without production credentials.

## Step 2 — configure Supabase

1. Create your production Supabase project and save the database password securely. Choose a suitable region, enable MFA on the owner account and configure backups appropriate to the business.
2. Open the project's connection/API settings. Copy the project URL and publishable key into Vercel later; do not copy the secret/service-role key.
3. Install the Supabase CLI using its official instructions. From the KULTURA directory, run:

~~~sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
~~~

Review the dry run before applying it. There are six migrations in chronological order: the original two Phase 2 migrations, three Phase 3 migrations, and 20260926000100_vercel_upload_limit.sql. Existing projects should apply only pending migrations. Do not reset a live database.

4. Confirm all eleven public tables have RLS enabled and the product-images bucket exists. The new migration limits uploads to 3 MiB. The app validates both client-side and server-side, decodes images and stores re-encoded WebP under UUID names. The bucket is intentionally public: draft-product images are public assets too.
5. Do NOT run supabase/seed.sql in production. It contains development examples. Create real categories/collections through the trusted SQL editor or dashboard; their admin editors are outside current scope. Create real products through /admin after bootstrapping an administrator.
6. Enable email/password Auth and confirmation. Configure custom SMTP and verify delivery to an address outside your Supabase organization. Configure password policy (app signup requires at least 12 characters), rate limits and abuse protection. Do not enable CAPTCHA without also integrating its token into the app's Auth forms.
7. Set Authentication → URL Configuration → Site URL to your actual canonical origin. Add exact allowed redirects:

~~~text
https://YOUR_DOMAIN/auth/callback
https://YOUR_DOMAIN/auth/callback?next=/reset-password
~~~

Use the generated production .vercel.app origin temporarily if you do not yet have a domain. Update it when connecting the final domain.

8. For cross-device confirmation, customize the confirmation template to link to your fixed trusted origin at /auth/confirm?token_hash={{ .TokenHash }}&type=email. For recovery use type=recovery. Otherwise keep the standard PKCE callback and open the email in the browser that requested it. Verify actual templates rather than assuming default behavior.
9. Sign up, confirm your intended administrator and copy its exact UUID from Authentication → Users. In the trusted SQL editor, promote only that verified account:

~~~sql
update public.profiles
set role = 'admin'
where id = 'YOUR_VERIFIED_AUTH_USER_UUID';
~~~

Set it back to customer to revoke access. Customer metadata, email addresses and browser storage never grant admin powers. Admin catalog permissions do not include modifying roles, order totals or payment states.

## Step 3 — deploy on Vercel

1. In Vercel, choose Add New → Project and import the repository.
2. If you pushed the KULTURA directory itself, set Root Directory to the repository root. If you pushed the parent workspace, set it to outputs/kultura. It must contain package.json and vercel.json.
3. Confirm Next.js framework and Node.js 24.x. Leave Install Command on automatic so Corepack/lockfile selection works. The committed build command is pnpm run build:vercel. Do not select static export or an output directory override.
4. Add the environment values listed above to Production. Set ENABLE_EXPERIMENTAL_COREPACK=1. Keep SITE_INDEXABLE=false.
5. Set SITE_URL to your chosen production Vercel hostname, e.g. https://YOUR_PROJECT.vercel.app. If Vercel assigns a different hostname, update SITE_URL and redeploy before testing Auth. Never use localhost here.
6. Deploy and inspect the complete build log. Do not ignore failing configuration checks. Confirm that the final build succeeds on Linux/Vercel.
7. Open the production URL and complete the hosted acceptance checklist below. Fix any failures before sharing publicly.
8. Review Vercel runtime logs without adding passwords, email recovery URLs, access tokens or raw Supabase errors to logs. Use Vercel deployment protection for staging/prelaunch access where available.
9. Set SITE_INDEXABLE=true only after approved content and launch checks are complete, then redeploy. robots.txt and sitemap.xml will then expose public content; account/admin/auth/cart pages remain excluded/noindex. noindex is not access control.

## Step 4 — connect a custom domain

The domain and DNS provider were not supplied. Replace YOUR_DOMAIN with the actual domain and copy the DNS values Vercel shows; do not use a guessed IP or a generic CNAME.

1. Buy or use your domain. Keep DNS management at the current provider unless you intentionally want to move nameservers.
2. Open Vercel → your project → Settings → Domains → Add Domain. Add the apex domain (YOUR_DOMAIN) and www.YOUR_DOMAIN.
3. Choose the primary host. For example, use the apex as primary and configure the www host to redirect to it in Vercel. This also prevents Auth cookies from being split between hostnames.
4. Vercel displays the DNS records required for each host. Open your DNS provider's DNS editor. Create the exact A record for the apex and exact CNAME for www that Vercel displays. If it requests domain-ownership verification, add its exact TXT record too.
5. Remove only conflicting A/AAAA/CNAME records for those same web hostnames. Preserve MX, SPF, DKIM, DMARC and other email/service records. Do not change nameservers merely to add a website.
6. Wait until Vercel reports Valid Configuration and the HTTPS certificate is issued. With Cloudflare, start with DNS-only records while verifying the deployment; configure proxying deliberately afterward.
7. Update Vercel Production SITE_URL to https://YOUR_PRIMARY_DOMAIN. Update Supabase Site URL, the exact callback allowlist and any fixed-domain confirmation/recovery templates to match.
8. Redeploy after changing SITE_URL, since metadata and security headers include build-time configuration. Configure any old production hostname to redirect to the canonical host through Vercel if appropriate.
9. Test apex and www, HTTPS, redirect behavior, login, confirmation and recovery again on the primary domain. Confirm canonical URLs and social cards point to the new domain.
10. When launch-approved, set SITE_INDEXABLE=true and redeploy. Submit https://YOUR_PRIMARY_DOMAIN/sitemap.xml to your search console.

The application makes same-origin Server Action requests; Supabase data queries and form actions are server-side; the browser SSR client also calls Supabase Auth to refresh the shared session. No wildcard CORS policy or Server Action allowedOrigins override is necessary. Preserve Next.js built-in origin validation.

## Hosted acceptance checklist — mandatory

- All public routes and navigation; unknown /constructor, /toString, product and category slugs return a real not-found experience.
- Responsive checks at 375, 390, 430, 768, 1024 and 1440 px. Keyboard tab order, visible focus, mobile navigation and bag dialog focus/escape.
- Real signup email, confirmation, login, session refresh/expiry, logout, recovery and invalid/expired links. Session cookies are shared with the browser SSR client (not HTTP-only), host-only, SameSite=Lax and Secure over HTTPS.
- Customer cannot open admin pages, replay admin actions, update roles or access another customer's address/orders.
- Real admin product save, stock validation, archive confirmation, image upload under 3 MiB, rejected oversize/non-image upload, image alt text/reorder/remove.
- Cart add/deduplicate/change/remove, reload persistence, price changes, lower stock, missing/inactive/sold-out variants and corrupt local storage.
- Empty catalog/orders and safe network-error messages. Newsletter clearly disabled. No checkout/payment claims.
- Inspect browser console and failed network requests. Verify image optimization, social card, favicon, canonical tags, robots and sitemap.
- Run Supabase's advisors and review any pre-existing policies outside these migrations for broader access. Test backups/restoration and document recovery ownership.

Database and Storage changes cannot share one transaction; interrupted uploads/deletes can leave orphan files despite cleanup attempts. Review unused files operationally. The catalog currently fetches all active products for client-side filtering; plan server-side search/pagination before a substantially larger catalog.

## Official references checked for this preparation

- [Vercel package managers / Corepack](https://vercel.com/docs/package-managers)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel payload limit](https://vercel.com/docs/errors/function_payload_too_large)
- [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls)
