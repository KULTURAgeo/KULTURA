# Order email + SMS notifications

KULTURA sends transactional order updates from the server. Notification delivery is deliberately fail-safe: an email/SMS provider outage must never undo an order or fulfillment update.

## Providers

### Email — Resend

Set these Vercel environment variables for Production:

- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL_FROM` — for example `KULTURA <orders@yourdomain.ge>`

Verify the sending domain in Resend before using a custom From address.

### SMS — Twilio

Set:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- either `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`

`TWILIO_FROM` may be a supported Twilio sender/number. If a Messaging Service is configured, `TWILIO_MESSAGING_SERVICE_SID` takes priority.

Georgian 9-digit delivery phone numbers are normalized to `+995...` before sending. Other countries should provide an E.164 number (`+...`).

## Notification events

| Event | Email | SMS |
| --- | --- | --- |
| Order received / payment pending | Yes | Yes |
| Payment confirmed | Yes | Yes |
| Payment failed/cancelled | Yes | Yes |
| Refund update | Yes | Yes |
| Processing | Yes | No |
| Shipped | Yes | Yes |
| Delivered | Yes | Yes |
| Order cancelled | Yes | Yes |
| Returned | Yes | Yes |

Test orders never send real notifications.

## Queue behavior

`notification_outbox` keeps one row per order/event. Provider status is tracked separately for email and SMS.

- Missing provider configuration: channel stays `pending`.
- Provider request failed: channel becomes `failed` and can be retried.
- Successful provider request: channel becomes `sent`.
- Intentionally unavailable channel (for example SMS on `processing`) becomes `skipped`.
- Resend requests use an order/event idempotency key to reduce duplicate email delivery.

The storefront/order action succeeds even if notification delivery fails.

## Current integration points

- Customer checkout calls `notifyOrderEvent(..., "order_received")` after an unpaid order is saved.
- Admin fulfillment calls `notifyFulfillmentStatus(...)` after a valid fulfillment transition.
- `notifyPaymentStatus(...)` is ready for the future verified bank webhook. When the bank API is connected, call it only after the payment status update has been verified and committed.

## Database migration

Run:

`supabase/migrations/20260930000600_order_notifications.sql`

before enabling the provider environment variables in Production.
