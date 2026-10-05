alter table public.partner_leads
  add column if not exists has_own_customer_base boolean;
