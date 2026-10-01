drop policy if exists "partner leads commercial own update" on public.partner_leads;

create policy "partner leads commercial own update"
on public.partner_leads
for update
to authenticated
using (
  assigned_to = (select auth.uid())
  and private.has_role((select auth.uid()), 'comercial'::app_role)
)
with check (
  assigned_to = (select auth.uid())
  and (created_by = (select auth.uid()) or created_by is null)
  and restaurant_id is null
  and converted_at is null
  and status <> 'converted'
  and private.has_role((select auth.uid()), 'comercial'::app_role)
);

create or replace function private.protect_partner_lead_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is not null
     and not private.has_role(auth.uid(), 'admin'::app_role)
     and (
       new.created_by is distinct from old.created_by
       or new.source is distinct from old.source
       or new.medium is distinct from old.medium
       or new.utm_source is distinct from old.utm_source
       or new.utm_medium is distinct from old.utm_medium
       or new.utm_campaign is distinct from old.utm_campaign
       or new.utm_content is distinct from old.utm_content
       or new.utm_term is distinct from old.utm_term
       or new.meta_campaign_id is distinct from old.meta_campaign_id
       or new.meta_adset_id is distinct from old.meta_adset_id
       or new.meta_ad_id is distinct from old.meta_ad_id
       or new.creative_code is distinct from old.creative_code
       or new.external_ref is distinct from old.external_ref
       or new.created_at is distinct from old.created_at
     )
  then
    raise exception 'LEAD_PROVENANCE_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partner_leads_protect_provenance on public.partner_leads;
create trigger trg_partner_leads_protect_provenance
before update on public.partner_leads
for each row execute function private.protect_partner_lead_provenance();

revoke all on function private.protect_partner_lead_provenance() from public, anon, authenticated;
