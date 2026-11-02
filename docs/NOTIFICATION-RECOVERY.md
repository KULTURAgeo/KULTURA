# Stale notification claims — staging operator procedure

The automatic sender remains at-most-once per claim. A crash or ambiguous provider timeout leaves the claim held; blindly clearing it can duplicate messages. `sent` means provider accepted, not confirmed recipient delivery.

`scripts/notification-recovery.mjs` supplies an explicit manual recovery path. It is staging-only (`fpahkxmlcvywspamftma`), selects no recipients or payloads, and never calls a provider. No new environment names, RPCs, grants or schema changes are required. Supply existing `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` securely to the operator process; never put values in command arguments or logs.

1. List up to 100 claimed rows: `node scripts/notification-recovery.mjs list fpahkxmlcvywspamftma`. This is read-only. Sent/skipped rows can appear but cannot be reset by this tool.
2. Pause notification-producing workers/actions and ensure in-flight execution has ended. Inspect provider logs securely using the original order/event idempotency key or provider request evidence. Do not infer non-acceptance merely from an application timeout or absent receipt. Unknown outcomes stay quarantined.
3. If the provider conclusively accepted the message, resolve with `node scripts/notification-recovery.mjs resolve fpahkxmlcvywspamftma NOTIFICATION_UUID email accepted --workers-paused-provider-verified`. This records acceptance at reconciliation time; it does not assert delivery time or resend. Use `sms` for SMS.
4. Only if the provider conclusively did NOT accept the message, use outcome `not-accepted`. This releases that channel's claim for a later normal authorized dispatch, consumes one attempt from the recovery budget, and does not itself dispatch. Claims must be at least 15 minutes old. At three recorded/recovery attempts, the tool refuses another reset; investigate manually without bypassing the cap.
5. Each write compares ID, channel status, claim timestamp and attempt count. A changed row fails rather than overwriting concurrent work. Save the redacted command result as operational evidence. Resume normal processing only after reviewing the outcome.

The worker-pause/provider-verification flag is an operator attestation, not automated provider verification. This tool cannot prove what a provider did, stop a frozen process, or replace authenticated provider delivery webhooks. No live recovery was performed during development; tests use a conditional-update adapter. Production use is deliberately refused until release gates and operational recovery procedures are approved.
