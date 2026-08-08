-- Collections AR chase worklist: issued invoices with open balance,
-- aged in Asia/Manila. Matches overdue attention (sent/partial) and
-- get_ar_aging bucket cutoffs (0–30 / 31–60 / 60+).

create or replace function public.list_collections_ar_worklist(
  p_branch_id uuid,
  p_limit int default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_user_org_id();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_rows jsonb;
  v_has_open_ar boolean;
  v_bucket_totals jsonb;
begin
  if v_org is null then
    raise exception 'Not authenticated';
  end if;
  if p_branch_id is null then
    raise exception 'Branch is required';
  end if;
  if not public.has_permission('billing.read', p_branch_id) then
    raise exception 'Permission denied';
  end if;
  if not exists (
    select 1
    from public.branches b
    where b.id = p_branch_id
      and b.organization_id = v_org
      and b.is_active
  ) then
    raise exception 'Branch not found';
  end if;

  select exists (
    select 1
    from public.invoices inv
    where inv.branch_id = p_branch_id
      and inv.organization_id = v_org
      and inv.status in ('sent', 'partial')
      and (inv.total_amount - inv.paid_amount) > 0
  )
  into v_has_open_ar;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invoice_id', t.invoice_id,
        'invoice_number', t.invoice_number,
        'patient_id', t.patient_id,
        'first_name', t.first_name,
        'last_name', t.last_name,
        'status', t.status,
        'total_amount', t.total_amount,
        'paid_amount', t.paid_amount,
        'balance', t.balance,
        'due_date', t.due_date,
        'issued_date', t.issued_date,
        'days_outstanding', t.days_outstanding,
        'aging_bucket', t.aging_bucket,
        'is_overdue', t.is_overdue
      )
      order by t.days_outstanding desc, t.balance desc, t.issued_at asc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      inv.id as invoice_id,
      inv.invoice_number,
      inv.patient_id,
      p.first_name,
      p.last_name,
      inv.status,
      inv.total_amount,
      inv.paid_amount,
      (inv.total_amount - inv.paid_amount) as balance,
      inv.due_date,
      (inv.created_at at time zone 'Asia/Manila')::date as issued_date,
      inv.created_at as issued_at,
      greatest(
        0,
        v_today - coalesce(
          inv.due_date,
          (inv.created_at at time zone 'Asia/Manila')::date
        )
      ) as days_outstanding,
      case
        when greatest(
          0,
          v_today - coalesce(
            inv.due_date,
            (inv.created_at at time zone 'Asia/Manila')::date
          )
        ) <= 30 then '0_30'
        when greatest(
          0,
          v_today - coalesce(
            inv.due_date,
            (inv.created_at at time zone 'Asia/Manila')::date
          )
        ) <= 60 then '31_60'
        else '60_plus'
      end as aging_bucket,
      (
        inv.due_date is not null
        and inv.due_date < v_today
        and (inv.total_amount - inv.paid_amount) > 0
      ) as is_overdue
    from public.invoices inv
    join public.patients p on p.id = inv.patient_id
    where inv.branch_id = p_branch_id
      and inv.organization_id = v_org
      and p.organization_id = v_org
      and inv.status in ('sent', 'partial')
      and (inv.total_amount - inv.paid_amount) > 0
    order by
      greatest(
        0,
        v_today - coalesce(
          inv.due_date,
          (inv.created_at at time zone 'Asia/Manila')::date
        )
      ) desc,
      (inv.total_amount - inv.paid_amount) desc,
      inv.created_at asc
    limit v_limit
  ) t;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', b.aging_bucket,
        'balance', b.balance_sum,
        'count', b.row_count
      )
      order by b.ord
    ),
    '[]'::jsonb
  )
  into v_bucket_totals
  from (
    select
      x.aging_bucket,
      sum(x.balance) as balance_sum,
      count(*)::int as row_count,
      case x.aging_bucket
        when '0_30' then 1
        when '31_60' then 2
        else 3
      end as ord
    from (
      select
        (inv.total_amount - inv.paid_amount) as balance,
        case
          when greatest(
            0,
            v_today - coalesce(
              inv.due_date,
              (inv.created_at at time zone 'Asia/Manila')::date
            )
          ) <= 30 then '0_30'
          when greatest(
            0,
            v_today - coalesce(
              inv.due_date,
              (inv.created_at at time zone 'Asia/Manila')::date
            )
          ) <= 60 then '31_60'
          else '60_plus'
        end as aging_bucket
      from public.invoices inv
      where inv.branch_id = p_branch_id
        and inv.organization_id = v_org
        and inv.status in ('sent', 'partial')
        and (inv.total_amount - inv.paid_amount) > 0
    ) x
    group by x.aging_bucket
  ) b;

  -- No PHI in return metadata; rows omit phone/email for worklist MVP.
  return jsonb_build_object(
    'as_of_date', v_today,
    'has_open_ar', coalesce(v_has_open_ar, false),
    'bucket_totals', coalesce(v_bucket_totals, '[]'::jsonb),
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_collections_ar_worklist(uuid, int) from public;
revoke all on function public.list_collections_ar_worklist(uuid, int) from anon;
grant execute on function public.list_collections_ar_worklist(uuid, int) to authenticated;

comment on function public.list_collections_ar_worklist(uuid, int) is
  'Lists issued invoices with open balance for billing.read; Asia/Manila aging; no phone in payload.';
