BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $migration$
DECLARE
  v_job_name CONSTANT text := 'kultura-checkout-reservation-expiry';
  v_schedule CONSTANT text := '* * * * *';
  v_command CONSTANT text := 'BEGIN; SET LOCAL lock_timeout=''2s''; SET LOCAL statement_timeout=''20s''; SELECT private.expire_checkout_reservations(100); COMMIT;';
  v_existing record;
BEGIN
  IF current_setting('cron.database_name', true) IS DISTINCT FROM current_database() THEN
    RAISE EXCEPTION 'pg_cron database does not match the KULTURA application database';
  END IF;
  IF to_regprocedure('private.expire_checkout_reservations(integer)') IS NULL THEN
    RAISE EXCEPTION 'KULTURA reservation expiry function is missing';
  END IF;
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'pg_cron schedule function is missing';
  END IF;
  IF NOT has_function_privilege(current_user, 'cron.schedule(text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration role cannot schedule the KULTURA expiry job';
  END IF;

  SELECT jobid, schedule, command, username, active
    INTO v_existing
    FROM cron.job
   WHERE jobname = v_job_name
     AND database = current_database();

  IF FOUND THEN
    IF v_existing.schedule IS DISTINCT FROM v_schedule
       OR v_existing.command IS DISTINCT FROM v_command
       OR v_existing.username IS DISTINCT FROM current_user
       OR v_existing.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Existing KULTURA expiry job differs from the reviewed schedule';
    END IF;
  ELSE
    PERFORM cron.schedule(v_job_name, v_schedule, v_command);
  END IF;
END
$migration$;

COMMIT;