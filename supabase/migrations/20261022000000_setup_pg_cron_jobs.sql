-- Enable pg_cron and pg_net extensions if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing jobs with these names if they exist to prevent duplicates
SELECT cron.unschedule('publish-scheduled-every-minute') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-scheduled-every-minute');
SELECT cron.unschedule('renew-tokens-every-12h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renew-tokens-every-12h');
SELECT cron.unschedule('sync-analytics-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-analytics-daily');

-- 1. Scheduled publishing worker: checks every minute for scheduled posts due
SELECT cron.schedule(
  'publish-scheduled-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/publish-scheduled',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- 2. Token renewal worker: runs twice daily to renew OAuth refresh tokens expiring in < 48 hours
SELECT cron.schedule(
  'renew-tokens-every-12h',
  '0 */12 * * *',
  $$SELECT net.http_post(
    url := 'https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/renew-tokens',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

-- 3. Analytics sync worker: runs every night at 03:00 UTC to snapshot daily follower & view metrics
SELECT cron.schedule(
  'sync-analytics-daily',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://vusbdvgspxjaoigqfipa.supabase.co/functions/v1/sync-analytics',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
