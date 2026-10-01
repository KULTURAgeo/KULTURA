# KULTURA commerce polish — 2026-10-01

This pass builds on the existing commerce foundation rather than duplicating features that are already implemented.

## Added in this pass

- Dedicated authenticated Review Order step between bag and checkout.
- Live stock/price refresh and quantity editing on the review step.
- Configured shipping and total preview before checkout.
- Wishlist quick add-to-bag with variant selection.
- Full-screen product image zoom/lightbox with keyboard escape support.
- Seven-day paid-sales trend in the admin dashboard, including revenue, order count and average order value.
- Route-level loading skeletons for cart, checkout, review, shop and product pages.
- Mobile interaction sizing and responsive review/skeleton layouts.
- Extra private-route response headers: nosniff, deny framing, COOP and permissions policy.
- Checkout and review routes are covered by the private/no-store proxy matcher.

## Existing features verified during this pass

- Bag quantity +/- controls, remove, stock caps and live subtotal.
- Checkout saved/new addresses, errors/loading transitions, shipping calculation and promo application.
- Promo codes: percentage/fixed, minimum subtotal, maximum discount, active window, expiry and max uses.
- Order confirmation page, My Orders and fulfillment timeline.
- Wishlist persistence with RLS.
- Catalog search/filter/sort controls.
- Product gallery, size selection, size guide, stock status, related products and recently viewed.
- Admin products, categories, inventory, orders, promos, shipping and returns.
- Low-stock and sold-out inventory filters.
- Return/refund request workflow.
- Order notification infrastructure plus auth password reset flows.
- Product metadata, Open Graph, structured data, sitemap and robots controls.
- Catalog caching/lazy UI and database query-performance indexes.
- Server-side admin/customer authorization, Supabase RLS and server-side stock/promo revalidation.

## Deployment note

Keep this branch separate until the Vercel build-rate limit clears. Run CI/build checks before merging to `main`, then let the GitHub integration trigger production deployment.
