alter table public.partner_leads
  add column if not exists has_recurring_customers boolean;
