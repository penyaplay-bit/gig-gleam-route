
DO $$
DECLARE
  job RECORD;
  new_cmd TEXT;
BEGIN
  FOR job IN SELECT jobid, jobname, command FROM cron.job WHERE command ILIKE '%/api/public/cron/%' LOOP
    new_cmd := regexp_replace(
      job.command,
      '"apikey"\s*,\s*''[^'']*''',
      '"x-cron-secret", current_setting(''app.settings.cron_secret'', true)',
      'gi'
    );
    -- Fall back: replace any explicit publishable key reference too
    PERFORM cron.alter_job(job_id => job.jobid, command => new_cmd);
  END LOOP;
END $$;
