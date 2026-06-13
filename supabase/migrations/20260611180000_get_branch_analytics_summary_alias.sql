-- Alias for docs/verify script compatibility. App uses get_branch_benchmark directly.
create or replace function public.get_branch_analytics_summary(p_period_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.get_branch_benchmark(p_period_days);
$$;

grant execute on function public.get_branch_analytics_summary(int) to authenticated;
