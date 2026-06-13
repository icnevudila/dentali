-- =============================================================================
-- ADIM 4 — Demo showcase verisi (opsiyonel, idempotent)
-- =============================================================================
-- ÖN KOŞUL: En az bir branch kaydı olmalı.
--   - Uygulamada /onboarding ile klinik oluşturduysanız hazırsınız.
--   - Yoksa önce uygulamaya giriş yapıp onboarding tamamlayın.
-- SONUÇ: branch_id değerini .env.local → LANDING_SHOWCASE_BRANCH_ID olarak kaydedin.
-- =============================================================================

do $$
declare
  v_branch_count int;
begin
  select count(*) into v_branch_count from public.branches;
  if v_branch_count = 0 then
    raise exception
      'HATA: branches tablosu boş. Önce uygulamada /onboarding ile klinik oluşturun, sonra bu scripti tekrar çalıştırın.';
  end if;
end $$;

-- Tam seed fonksiyonu bundle içinde; güncel gövde için scripts/seed-demo-showcase.sql de kullanılabilir.
select public.seed_demo_showcase_data(null);
