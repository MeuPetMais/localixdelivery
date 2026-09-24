-- GROWTH-8 — consent-aware campaign automation foundation.
-- Customer 360 identity is public.customers (partner-scoped), including guest customers.
-- Existing communication preferences/history remain auth.users-scoped and are not reused
-- as authoritative marketing consent for Customer 360.

create table if not exists public.customer_growth_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('EMAIL','SMS','WHATSAPP','PUSH','IN_APP')),
  granted boolean not null,
  source text not null,
  evidence jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, customer_id, channel, captured_at)
);

create index if not exists customer_growth_marketing_consents_lookup_idx
  on public.customer_growth_marketing_consents
  (restaurant_id, customer_id, channel, captured_at desc);

alter table public.customer_growth_marketing_consents enable row level security;

revoke all on table public.customer_growth_marketing_consents from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.customer_growth_marketing_consents from authenticated;
grant select on table public.customer_growth_marketing_consents to authenticated;

drop policy if exists "Growth marketing consent tenant read"
  on public.customer_growth_marketing_consents;
create policy "Growth marketing consent tenant read"
on public.customer_growth_marketing_consents
for select
to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = customer_growth_marketing_consents.restaurant_id
      and r.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'admin'
  )
  or (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role::text = 'partner_growth'
    )
    and exists (
      select 1 from public.partner_growth_assignments pga
      where pga.user_id = (select auth.uid())
        and pga.restaurant_id = customer_growth_marketing_consents.restaurant_id
        and pga.active = true
    )
  )
);

create table if not exists public.growth_campaign_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  trigger_type text not null check (trigger_type in (
    'SECOND_PURCHASE',
    'AT_RISK',
    'INACTIVE',
    'REACTIVATED',
    'RECURRENCE'
  )),
  channel text not null check (channel in ('EMAIL','SMS','WHATSAPP','PUSH','IN_APP')),
  action_key text not null,
  source_ref text not null,
  status text not null check (status in (
    'BLOCKED_CONSENT',
    'BLOCKED_PROVIDER',
    'BLOCKED_FREQUENCY',
    'READY',
    'QUEUED',
    'SENT',
    'FAILED',
    'CANCELLED'
  )),
  reason text,
  consent_id uuid references public.customer_growth_marketing_consents(id) on delete set null,
  measurement_event_id uuid references public.growth_measurement_events(id) on delete set null,
  idempotency_key text not null unique,
  scheduled_for timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_campaign_automation_jobs_customer_idx
  on public.growth_campaign_automation_jobs
  (restaurant_id, customer_id, created_at desc);

create index if not exists growth_campaign_automation_jobs_status_idx
  on public.growth_campaign_automation_jobs
  (restaurant_id, status, scheduled_for);

alter table public.growth_campaign_automation_jobs enable row level security;

revoke all on table public.growth_campaign_automation_jobs from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.growth_campaign_automation_jobs from authenticated;
grant select on table public.growth_campaign_automation_jobs to authenticated;

drop policy if exists "Growth campaign jobs tenant read"
  on public.growth_campaign_automation_jobs;
create policy "Growth campaign jobs tenant read"
on public.growth_campaign_automation_jobs
for select
to authenticated
using (
  exists (
    select 1 from public.restaurants r
    where r.id = growth_campaign_automation_jobs.restaurant_id
      and r.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'admin'
  )
  or (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role::text = 'partner_growth'
    )
    and exists (
      select 1 from public.partner_growth_assignments pga
      where pga.user_id = (select auth.uid())
        and pga.restaurant_id = growth_campaign_automation_jobs.restaurant_id
        and pga.active = true
    )
  )
);

comment on table public.customer_growth_marketing_consents is
  'Explicit partner-scoped marketing consent for Customer 360 identities, including guests.';
comment on table public.growth_campaign_automation_jobs is
  'GROWTH-8 controlled automation queue. No delivery occurs without consent, provider availability, frequency checks and a separate sender.';
