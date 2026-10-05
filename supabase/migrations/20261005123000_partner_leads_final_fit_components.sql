alter table public.partner_leads
  add column if not exists has_structured_operation boolean,
  add column if not exists has_active_marketing boolean,
  add column if not exists committed_to_promotion boolean;
