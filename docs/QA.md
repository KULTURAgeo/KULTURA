# Phase 1 verification — 2026-09-23

## Passed
- Next.js 16.3.6 production build, including TypeScript compilation and 22 generated pages.
- `pnpm typecheck` and `pnpm lint`.
- Playwright with installed Microsoft Edge (Chromium), against production `pnpm start`.
- Homepage, shop and hoodie detail at 375, 390, 430, 768, 1024 and 1440px: no horizontal overflow or broken images.
- 20 existing URLs: HTTP 200. Three unknown URLs: HTTP 404.
- Mobile menu open/Escape close; category filtering; search empty state; size-required cart control; stock states; gallery crop switching; delivery accordion; sold-out protection; newsletter preview feedback; reduced motion.
- No browser page errors.
- Visual review of full-page mobile and desktop screenshots.
- Source scan found no TypeScript suppressions, explicit any, or obvious secret markers. No real credentials were introduced. Git is initialized without commits.

## Commands
`create-next-app@latest`, `pnpm install`, `pnpm view next version`, `pnpm add next@16.3.6 eslint-config-next@16.3.6 --save-exact`, `git init`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm start`, Prettier source formatting, and `node qa/browser-check.mjs`.

Initial scaffolding could not find pnpm on PATH; installation succeeded with the bundled runtime added to PATH. The default Playwright browser was absent; checks used installed Edge. QA's initial image check was updated to wait for lazy image decoding. Unknown dynamic paths initially streamed HTTP 200; restricting mock routes to generated parameters fixed the response to 404.

## Reproduce browser checks
Install Playwright in a separate QA environment and set `PLAYWRIGHT_MODULE` to its module path, or make `playwright` resolvable from this project. Microsoft Edge must be installed; the script uses its msedge channel. Start the production server on port 3000 and run `node qa/browser-check.mjs` from the project root.

## Boundaries
No Supabase, authentication, order creation, checkout, TBC integration, newsletter storage or deployment. Mock content and informational policy pages require replacement before commerce opens. Browser checks used desktop Chromium at mobile widths, not physical mobile Safari/Chrome. Accessibility verification is basic, not a full audit.
