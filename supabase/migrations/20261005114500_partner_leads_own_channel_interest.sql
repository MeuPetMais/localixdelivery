alter table public.partner_leads
  add column if not exists interested_in_own_channel boolean;
