-- ADIM 5 (opsiyonel): Ayni slug icin cift global sablonlari temizle
-- "multiple rows returned" hatasi aldiysaniz once bunu calistirin

delete from public.consent_templates a
using public.consent_templates b
where a.organization_id is null
  and b.organization_id is null
  and a.slug = b.slug
  and a.id < b.id;

delete from public.consent_templates ct
where ct.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by organization_id, slug
        order by version desc nulls last, id desc
      ) as rn
    from public.consent_templates
  ) ranked
  where ranked.rn > 1
);

-- dpa-consent govdesi bos kaldiysa doldur
update public.consent_templates
set
  body = 'I consent to the collection, use, and processing of my personal and health information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).',
  name = 'Data Privacy Act (DPA) Consent',
  is_active = true
where organization_id is null
  and slug = 'dpa-consent'
  and coalesce(trim(body), '') = '';
