
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior, se existir
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-outbox');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-email-outbox',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--f1dbd651-3cbb-43b9-9ae4-53e107d58496.lovable.app/api/public/process-email-outbox',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
