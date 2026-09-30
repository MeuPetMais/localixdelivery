-- Public pre-partner acquisition capture: anti-abuse + idempotent first-touch preservation.
create table if not exists private.partner_lead_public_capture_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
revoke all on table private.partner_lead_public_capture_limits from public, anon, authenticated;

create or replace function private.consume_partner_lead_public_rate_limit(
  _ip_hash text, _limit integer default 5, _window interval default interval '1 hour'
) returns boolean language plpgsql security definer
set search_path = pg_catalog, private as $$
declare v_allowed boolean;
begin
  if _ip_hash is null or length(_ip_hash) < 32 then return false; end if;
  insert into private.partner_lead_public_capture_limits(ip_hash,window_started_at,request_count,updated_at)
  values (_ip_hash,now(),1,now())
  on conflict (ip_hash) do update set
    window_started_at=case when partner_lead_public_capture_limits.window_started_at <= now()-_window then now() else partner_lead_public_capture_limits.window_started_at end,
    request_count=case when partner_lead_public_capture_limits.window_started_at <= now()-_window then 1 else partner_lead_public_capture_limits.request_count+1 end,
    updated_at=now()
  returning request_count <= _limit into v_allowed;
  return coalesce(v_allowed,false);
end $$;
revoke all on function private.consume_partner_lead_public_rate_limit(text,integer,interval) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.consume_partner_lead_public_rate_limit(text,integer,interval) to service_role;

create or replace function public.consume_partner_lead_public_rate_limit(
  _ip_hash text,_limit integer default 5,_window interval default interval '1 hour'
) returns boolean language sql security invoker
set search_path=pg_catalog,public,private as $$
 select private.consume_partner_lead_public_rate_limit(_ip_hash,_limit,_window);
$$;
revoke all on function public.consume_partner_lead_public_rate_limit(text,integer,interval) from public,anon,authenticated;
grant execute on function public.consume_partner_lead_public_rate_limit(text,integer,interval) to service_role;

create or replace function private.create_partner_lead_public_idempotent(
  _business_name text,_contact_name text,_phone text,_email text default null,_segment text default null,
  _city text default null,_neighborhood text default null,_estimated_monthly_orders integer default null,
  _main_pain text default null,_source text default 'meta_ads',_medium text default 'paid_social',
  _utm_source text default null,_utm_medium text default null,_utm_campaign text default null,
  _utm_content text default null,_utm_term text default null,_meta_campaign_id text default null,
  _meta_adset_id text default null,_meta_ad_id text default null,_creative_code text default null,_external_ref text default null
) returns public.partner_leads language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare v_row public.partner_leads;
begin
 if _external_ref is null or btrim(_external_ref)='' then raise exception 'external_ref required' using errcode='22023'; end if;
 select * into v_row from public.partner_leads where source=_source and external_ref=_external_ref limit 1;
 if found then return v_row; end if;
 begin
  insert into public.partner_leads(business_name,contact_name,phone,email,segment,city,neighborhood,estimated_monthly_orders,main_pain,source,medium,utm_source,utm_medium,utm_campaign,utm_content,utm_term,meta_campaign_id,meta_adset_id,meta_ad_id,creative_code,external_ref,status,assigned_to,created_by)
  values(_business_name,_contact_name,_phone,_email,_segment,_city,_neighborhood,_estimated_monthly_orders,_main_pain,_source,_medium,_utm_source,_utm_medium,_utm_campaign,_utm_content,_utm_term,_meta_campaign_id,_meta_adset_id,_meta_ad_id,_creative_code,_external_ref,'new',null,null)
  returning * into v_row; return v_row;
 exception when unique_violation then
  select * into v_row from public.partner_leads where source=_source and external_ref=_external_ref limit 1;
  if not found then raise; end if; return v_row;
 end;
end $$;
revoke all on function private.create_partner_lead_public_idempotent(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.create_partner_lead_public_idempotent(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) to service_role;

create or replace function public.create_partner_lead_public_idempotent(
  _business_name text,_contact_name text,_phone text,_email text default null,_segment text default null,
  _city text default null,_neighborhood text default null,_estimated_monthly_orders integer default null,
  _main_pain text default null,_source text default 'meta_ads',_medium text default 'paid_social',
  _utm_source text default null,_utm_medium text default null,_utm_campaign text default null,
  _utm_content text default null,_utm_term text default null,_meta_campaign_id text default null,
  _meta_adset_id text default null,_meta_ad_id text default null,_creative_code text default null,_external_ref text default null
) returns public.partner_leads language sql security invoker
set search_path=pg_catalog,public,private as $$
 select private.create_partner_lead_public_idempotent(_business_name,_contact_name,_phone,_email,_segment,_city,_neighborhood,_estimated_monthly_orders,_main_pain,_source,_medium,_utm_source,_utm_medium,_utm_campaign,_utm_content,_utm_term,_meta_campaign_id,_meta_adset_id,_meta_ad_id,_creative_code,_external_ref);
$$;
revoke all on function public.create_partner_lead_public_idempotent(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_partner_lead_public_idempotent(text,text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,text,text) to service_role;
