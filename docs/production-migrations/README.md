# Production-applied migration archive

These SQL files preserve the compatibility migration sources applied to the KULTURA Production database through the Supabase migration API on 2026-11-02. Their filenames use the corresponding Production migration versions for traceability.

This directory is an audit archive, not the Supabase CLI migration directory. Do not run supabase db push against the legacy Production project: its pre-existing schema had no baseline migration history, so the ordinary supabase/migrations folder is not reconciled with Production. Apply future database changes only after a separate reviewed migration plan.

Rollback for the expiry scheduler is preserved at D:\KULTURA\Workspace\work\production-compatibility\supabase\migrations\20261102000000_legacy_reservation_expiry_cron.rollback.sql; it requires zero held reservations and was not run against Production.
