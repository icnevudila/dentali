-- Global consent_templates (organization_id IS NULL) upsert onkosulu
-- ON CONFLICT (organization_id, slug) NULL org satirlarinda calismaz — partial index gerekir

delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

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

drop index if exists public.idx_consent_templates_global_slug;
create unique index idx_consent_templates_global_slug
  on public.consent_templates (slug)
  where organization_id is null;
