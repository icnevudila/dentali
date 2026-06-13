-- Revoke pending staff invitations (admin)

create or replace function public.revoke_staff_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.staff_invitations%rowtype;
begin
  select * into v_inv
  from public.staff_invitations
  where id = p_invitation_id
    and organization_id = public.current_user_org_id();

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_inv.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  if not public.user_is_org_admin() then
    raise exception 'Permission denied';
  end if;

  update public.staff_invitations
  set status = 'revoked'
  where id = p_invitation_id;

  return jsonb_build_object('status', 'revoked', 'invitation_id', p_invitation_id);
end;
$$;

grant execute on function public.revoke_staff_invitation(uuid) to authenticated;
