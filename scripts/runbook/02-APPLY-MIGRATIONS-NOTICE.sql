-- =============================================================================
-- ADIM 2 — Migration bundle (BU DOSYAYI SQL EDITOR'A YAPIŞTIRMAYIN)
-- =============================================================================
-- Ana migration dosyası çok büyük (~14.000+ satır).
-- Supabase SQL Editor'da doğrudan şu dosyayı açıp tamamını çalıştırın:
--
--   supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql
--
-- Önce yerelde güncelleyin:
--   npm run db:bundle:idempotent
--   (çıktı: 88 files)
--
-- Detaylı rehber: docs/SQL_RUNBOOK_TR.md
-- =============================================================================

select
  'ADIM 2: supabase/migrations/_APPLY_ALL_IDEMPOTENT.sql dosyasini SQL Editor''da calistirin' as next_step,
  'Sonra: scripts/runbook/02-verify-complete.sql' as after_step;
