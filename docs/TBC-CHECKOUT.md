# TBC Checkout integration — work in progress

This branch adds a server-only TBC Checkout REST client and environment variable names. **It does not enable customer charges, change the checkout button, deploy, or reconcile payments.** The client must not be called in a live route until the transaction ledger and reconciliation steps below are implemented and verified.

## Merchant configuration

Configure these as secret **server-only** values in Vercel Production/Preview separately:

- `TBC_API_KEY`: developer portal API key
- `TBC_CLIENT_ID`: merchant's Checkout client ID
- `TBC_CLIENT_SECRET`: merchant's Checkout client secret
- `SITE_URL`: canonical HTTPS site URL (already required)

Register `https://<your-domain>/api/payments/tbc/callback` on the TBC merchant dashboard before attempting live payments. Never send secrets in chat, commit them, or expose them through `NEXT_PUBLIC_*`. The TBC documentation specifies callback sender IP addresses that must be allowed by the deployment firewall, if configured.

## Outstanding tasks before turning on payment

1. Add a trusted transaction ledger mapping the internal order ID to the TBC `payId`, currency and amount in tetri; enforce uniqueness and idempotency. Add a reviewed Supabase migration and regenerate database types.
2. Reuse the existing `checkout_submit_order` RPC and reservation rules, not a browser-supplied price. Before initiating a charge, read the persisted order under the authenticated customer's identity and verify positive amount, pending state, reservation validity and currency.
3. Atomically claim one payment initiation per order. Avoid two browser actions creating multiple charge attempts. Handle uncertain network outcomes through reconciliation, not an immediate second charge.
4. Persist the TBC payment ID *before* redirecting the customer. If that persistence fails, do not expose the redirect URL; reconcile or cancel the orphaned bank transaction.
5. Implement a POST callback endpoint that accepts only `PaymentId`, finds a matching transaction, retrieves status via `getTbcPaymentDetails`, validates amount/currency and bank transaction mapping, then invokes a narrowly scoped, transactional database function for the valid state transition. Do not trust the callback body or browser return as proof of payment.
6. Handle expired reservations and late successes as a manual reconciliation/refund case; never silently set an expired order to paid, restock twice, or lose customer funds.
7. Implement an idempotent customer-visible return/status page that reads the verified internal payment state. Do not mark an order paid on redirect.
8. Update checkout UI, copy, tests, migration validation and Vercel deployment config only after the whole safe payment lifecycle works.
9. Verify failed, cancelled, duplicated and delayed callbacks, repeated clicks, currency/amount mismatch, duplicate orders and callback retries in staging. Run `pnpm check`, `pnpm build` and secret audits, then complete a merchant-approved payment test.

The current unpaid-order checkout remains the fallback until the full integration passes review.

## References

- https://developers.tbcbank.ge/reference/post_v1-tpay-payments
- https://developers.tbcbank.ge/reference/post_v1-tpay-access-token
- https://developers.tbcbank.ge/docs/checkout-create-checkout-payment
