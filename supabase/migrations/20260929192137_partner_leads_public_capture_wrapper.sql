-- Commercial acquisition: narrow public PostgREST wrapper.
-- Authorization and write semantics remain authoritative in private.create_partner_lead_manual.
create or replace function public.create_partner_lead_manual(
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
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
 select private.create_partner_lead_manual(
  _business_name,_contact_name,_phone,_segment,_city,_neighborhood,
  _estimated_monthly_orders,_current_channels,_main_pain,_is_decision_maker,
  _source,_medium,_utm_source,_utm_medium,_utm_campaign,_utm_content,_utm_term,
  _meta_campaign_id,_meta_adset_id,_meta_ad_id,_creative_code,_external_ref
 );
$$;

revoke all on function public.create_partner_lead_manual(text,text,text,text,text,text,integer,text[],text,boolean,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_partner_lead_manual(text,text,text,text,text,text,integer,text[],text,boolean,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
