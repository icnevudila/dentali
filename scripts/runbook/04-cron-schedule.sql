-- =============================================================================
-- ADIM 5 — Supabase pg_cron zamanlayıcıları (opsiyonel, canlı otomasyon)
-- =============================================================================
-- ÖN KOŞULLAR:
--   1. 01-extensions.sql çalıştırılmış (pg_cron + pg_net)
--   2. Edge Functions deploy edilmiş
--   3. Supabase → Edge Functions → Secrets: CRON_SECRET ayarlı
--
-- DEĞİŞTİRİN (2 yerde):
--   <PROJECT_REF>  → Supabase proje ref (ör. ahipxdlxyuvqikcybjpm)
--   <CRON_SECRET>  → Edge secret ile aynı güçlü string
-- =============================================================================

-- Eski job'ları temizle (tekrar çalıştırmak güvenli)
select cron.unschedule(jobname)
from cron.job
where jobname like 'dentali-%';

select cron.schedule(
  'dentali-process-slot-notifications',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-slot-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-appointment-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/appointment-reminders-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-daily-reminder',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-payment-reminder',
  '0 2 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/payment-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-recall-reminder',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/recall-reminder-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-closeout-email',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-closeout-email-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'dentali-owner-digest-sms',
  '30 12 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/owner-digest-sms-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Doğrulama
select jobid, jobname, schedule, active
from cron.job
where jobname like 'dentali-%'
order by jobname;
