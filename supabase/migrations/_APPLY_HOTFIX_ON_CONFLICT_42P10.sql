-- HOTFIX: ERROR 42P10 — consent_templates ON CONFLICT
-- Supabase SQL Editor'da once bunu calistirin, sonra _APPLY_MASTER.sql (veya kaldiginiz yerden devam)
-- Sonra: Settings -> API -> Reload schema

-- 1) Cift global sablonlari temizle (organization_id IS NULL)
delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

-- 2) Org bazli unique (non-null org upsert icin)
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'consent_templates'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%organization_id%slug%'
  ) then
    alter table public.consent_templates
      add constraint consent_templates_organization_id_slug_key unique (organization_id, slug);
  end if;
exception
  when duplicate_object then null;
end $$;

-- 3) Global slug partial unique index (NULL org upsert icin — 42P10 cozumu)
drop index if exists public.idx_consent_templates_global_slug;
create unique index idx_consent_templates_global_slug
  on public.consent_templates (slug)
  where organization_id is null;

-- Dogrulama (tek satir slug basina global)
select slug, count(*) as cnt
from public.consent_templates
where organization_id is null
group by slug
having count(*) > 1;
