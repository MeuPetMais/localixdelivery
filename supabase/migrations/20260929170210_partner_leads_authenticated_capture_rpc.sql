-- Commercial acquisition: authenticated manual capture authority.
-- Versioned from the function validated in Staging.
create or replace function private.create_partner_lead_manual(
 _business_name text, _contact_name text, _phone text,
 _segment text default null, _city text default null, _neighborhood text default null,
 _estimated_monthly_orders integer default null, _current_channels text[] default null,
 _main_pain text default null, _is_decision_maker boolean default null,
 _source text default 'manual', _medium text default null,
 _utm_source text default null, _utm_medium text default null, _utm_campaign text default null,
 _utm_content text default null, _utm_term text default null,
 _meta_campaign_id text default null, _meta_adset_id text default null, _meta_ad_id text default null,
 _creative_code text default null, _external_ref text default null
) returns public.partner_leads
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare v_uid uuid; v_lead public.partner_leads;
begin
 v_uid:=auth.uid();
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not (private.has_role(v_uid,'admin'::public.app_role) or private.has_role(v_uid,'comercial'::public.app_role)) then raise exception 'FORBIDDEN'; end if;
 insert into public.partner_leads(
 business_name,contact_name,phone,segment,city,neighborhood,estimated_monthly_orders,current_channels,main_pain,is_decision_maker,
 source,medium,utm_source,utm_medium,utm_campaign,utm_content,utm_term,meta_campaign_id,meta_adset_id,meta_ad_id,creative_code,external_ref,
 assigned_to,created_by)
 values(
 btrim(_business_name),btrim(_contact_name),_phone,nullif(btrim(_segment),''),nullif(btrim(_city),''),nullif(btrim(_neighborhood),''),
 _estimated_monthly_orders,_current_channels,nullif(btrim(_main_pain),''),_is_decision_maker,
 coalesce(nullif(btrim(_source),''),'manual'),nullif(btrim(_medium),''),nullif(btrim(_utm_source),''),nullif(btrim(_utm_medium),''),
 nullif(btrim(_utm_campaign),''),nullif(btrim(_utm_content),''),nullif(btrim(_utm_term),''),nullif(btrim(_meta_campaign_id),''),
 nullif(btrim(_meta_adset_id),''),nullif(btrim(_meta_ad_id),''),nullif(btrim(_creative_code),''),nullif(btrim(_external_ref),''),
 v_uid,v_uid)
 on conflict (source,external_ref) where external_ref is not null do update set updated_at=now()
 returning * into v_lead;
 return v_lead;
end
$function$;

revoke all on function private.create_partner_lead_manual(text,text,text,text,text,text,integer,text[],text,boolean,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function private.create_partner_lead_manual(text,text,text,text,text,text,integer,text[],text,boolean,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
