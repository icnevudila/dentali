-- =============================================================================
-- ADIM 1 — Gerekli PostgreSQL uzantıları (Supabase SQL Editor)
-- =============================================================================
-- Önce Dashboard → Database → Extensions bölümünden de açabilirsiniz:
--   pgcrypto, pg_cron, pg_net
-- Bu script idempotent — tekrar çalıştırmak güvenli.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Doğrulama
select
  extname,
  extversion,
  'OK' as status
from pg_extension
where extname in ('pgcrypto', 'pg_cron', 'pg_net')
order by extname;

-- Beklenen: 3 satır (hepsi OK). pg_cron/pg_net yoksa cron HTTP job'ları kurulamaz.
