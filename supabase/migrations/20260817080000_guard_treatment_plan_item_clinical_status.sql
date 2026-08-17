-- Allow clinical progress status updates (planned / in_progress / completed / cancelled)
-- on approved, in_progress, and completed treatment plans.
-- Financial values, descriptions, procedure links, and tooth numbers remain guarded.

create or replace function public.guard_treatment_plan_items_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select tp.status
  into v_status
  from public.treatment_plans tp
  where tp.id = coalesce(NEW.plan_id, OLD.plan_id);

  if v_status in ('approved', 'in_progress', 'completed') then
    -- Allow clinical progress status updates (status, status_changed_at)
    if TG_OP = 'UPDATE'
       and NEW.id = OLD.id
       and NEW.plan_id = OLD.plan_id
       and NEW.procedure_id is not distinct from OLD.procedure_id
       and NEW.tooth_number is not distinct from OLD.tooth_number
       and NEW.description is not distinct from OLD.description
       and NEW.estimated_price is not distinct from OLD.estimated_price
       and NEW.priority is not distinct from OLD.priority
    then
      return NEW;
    end if;

    raise exception 'Cannot modify procedure details or prices on an approved treatment plan. Unapprove the plan to edit procedures, or update the linked invoice in Billing.';
  end if;

  return coalesce(NEW, OLD);
end;
$$;
