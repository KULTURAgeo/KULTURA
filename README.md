# KULTURA

Premium streetwear storefront with a Supabase/PostgreSQL foundation.

## Stripe test checkout

Stripe Checkout is implemented for **test mode only**. The server re-reads current product prices and stock, requires a signed-in customer with a default address, writes pending order snapshots with a server-only Supabase service-role key, and only marks an order paid after Stripe reports a paid Checkout Session.

Live Stripe keys are intentionally rejected. Inventory is validated before checkout but is not reserved/decremented yet, so this is for payment integration testing rather than production commerce.

Configure `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and then `STRIPE_WEBHOOK_SECRET` in Vercel before testing.
