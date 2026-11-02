BEGIN;

DO $rollback$
DECLARE
  v_job_id integer;
BEGIN
  IF to_regclass('private.checkout_reservations') IS NULL THEN
    RAISE EXCEPTION 'KULTURA reservation table is missing; refusing scheduler rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM private.checkout_reservations WHERE state = 'held') THEN
    RAISE EXCEPTION 'Held reservations remain; refusing to remove automatic expiry';
  END IF;

  SELECT jobid INTO v_job_id
    FROM cron.job
   WHERE jobname = 'kultura-checkout-reservation-expiry'
     AND database = current_database();
  IF FOUND THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$rollback$;

COMMIT;