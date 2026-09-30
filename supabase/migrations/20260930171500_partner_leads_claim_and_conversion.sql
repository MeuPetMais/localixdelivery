-- DEC-017: controlled ownership claim and authenticated conversion for public partner leads.

create or replace function private.claim_partner_lead(_lead_id uuid)
returns public.partner_leads
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_lead public.partner_leads;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not (
    private.has_role(v_uid, 'admin'::public.app_role)
    or private.has_role(v_uid, 'comercial'::public.app_role)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select *
    into v_lead
    from public.partner_leads
   where id = _lead_id
   for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_lead.status in ('converted', 'lost', 'disqualified') then
    raise exception 'LEAD_NOT_CLAIMABLE';
  end if;

  if v_lead.assigned_to is null then
    update public.partner_leads
       set assigned_to = v_uid,
           updated_at = now()
     where id = _lead_id
     returning * into v_lead;
    return v_lead;
  end if;

  if v_lead.assigned_to = v_uid then
    return v_lead;
  end if;

  raise exception 'LEAD_ALREADY_ASSIGNED';
end;
$$;

revoke all on function private.claim_partner_lead(uuid) from public, anon;
grant execute on function private.claim_partner_lead(uuid) to authenticated;

create or replace function public.claim_partner_lead(_lead_id uuid)
returns public.partner_leads
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.claim_partner_lead(_lead_id);
$$;

revoke all on function public.claim_partner_lead(uuid) from public, anon;
grant execute on function public.claim_partner_lead(uuid) to authenticated;

create or replace function public.convert_partner_lead(_lead_id uuid, _restaurant_id uuid)
returns public.partner_leads
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.convert_partner_lead(_lead_id, _restaurant_id);
$$;

revoke all on function public.convert_partner_lead(uuid, uuid) from public, anon;
grant execute on function public.convert_partner_lead(uuid, uuid) to authenticated;
