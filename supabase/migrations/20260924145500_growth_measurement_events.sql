-- GROWTH-7 — durable measurement ledger for Customer 360 Growth actions.
-- Analytical only: this table is NOT a financial source of truth.

create table if not exists public.growth_measurement_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_type text not null check (event_type in (
    'OPPORTUNITY_VIEWED',
    'ACTION_SELECTED',
    'ACTION_EXECUTED',
    'ORDER_ATTRIBUTED'
  )),
  source_type text not null,
  source_ref text,
  action_key text,
  parent_event_id uuid references public.growth_measurement_events(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  attributed_order_total numeric(12,2),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint growth_measurement_events_order_total_nonnegative
    check (attributed_order_total is null or attributed_order_total >= 0),
  constraint growth_measurement_events_order_event_shape
    check (
      (event_type = 'ORDER_ATTRIBUTED' and order_id is not null and attributed_order_total is not null)
      or
      (event_type <> 'ORDER_ATTRIBUTED' and order_id is null and attributed_order_total is null)
    )
);

create index if not exists growth_measurement_events_restaurant_occurred_idx
  on public.growth_measurement_events (restaurant_id, occurred_at desc);

create index if not exists growth_measurement_events_customer_occurred_idx
  on public.growth_measurement_events (restaurant_id, customer_id, occurred_at desc);

create index if not exists growth_measurement_events_parent_idx
  on public.growth_measurement_events (parent_event_id)
  where parent_event_id is not null;

create index if not exists growth_measurement_events_order_idx
  on public.growth_measurement_events (order_id)
  where order_id is not null;

alter table public.growth_measurement_events enable row level security;

revoke all on table public.growth_measurement_events from anon;
revoke insert, update, delete, truncate, references, trigger on table public.growth_measurement_events from authenticated;
grant select on table public.growth_measurement_events to authenticated;

drop policy if exists "Growth measurement tenant read" on public.growth_measurement_events;
create policy "Growth measurement tenant read"
on public.growth_measurement_events
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = growth_measurement_events.restaurant_id
      and r.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role::text = 'admin'
  )
  or (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role::text = 'partner_growth'
    )
    and exists (
      select 1
      from public.partner_growth_assignments pga
      where pga.user_id = (select auth.uid())
        and pga.restaurant_id = growth_measurement_events.restaurant_id
        and pga.active = true
    )
  )
);

comment on table public.growth_measurement_events is
  'GROWTH-7 analytical event ledger. Not authoritative for price, payment, split, balance, refund, or order state.';
