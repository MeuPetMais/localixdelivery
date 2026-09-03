-- RW-1 — Localix Rewards Core
-- Rewards owns merit/progress. Localix Benefits owns economic value.
-- Staging-first; kill switch defaults OFF.

alter table public.platform_settings
  add column if not exists localix_rewards_enabled boolean not null default false;

create table if not exists public.reward_programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ENDED')),
  event_type text not null default 'ORDER_COMPLETED' check (event_type in ('ORDER_COMPLETED')),
  required_orders integer not null check (required_orders > 0),
  benefit_campaign_id uuid not null references public.benefit_campaigns(id) on delete restrict,
  restaurant_id uuid references public.restaurants(id) on delete restrict,
  min_order_amount numeric(12,2) not null default 0 check (min_order_amount >= 0),
  max_cycles integer not null default 1 check (max_cycles > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint reward_program_period_ck check (ends_at > starts_at)
);

create table if not exists public.customer_reward_progress (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.reward_programs(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  cycle integer not null check (cycle > 0),
  qualified_orders integer not null default 0 check (qualified_orders >= 0),
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS','GOAL_REACHED','REWARDED','ENDED','REVIEW_REQUIRED')),
  goal_reached_at timestamptz,
  reward_granted_at timestamptz,
  reward_credit_id uuid references public.customer_benefit_credits(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(program_id, customer_id, cycle)
);

create table if not exists public.reward_progress_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.reward_programs(id) on delete restrict,
  progress_id uuid not null references public.customer_reward_progress(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  cycle integer not null check (cycle > 0),
  event_type text not null
    check (event_type in ('ORDER_QUALIFIED','ORDER_REVERSED','GOAL_REACHED','REWARD_GRANTED','REWARD_REVERSED')),
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists reward_progress_events_order_qualified_uniq
  on public.reward_progress_events(program_id, order_id, event_type)
  where event_type='ORDER_QUALIFIED' and order_id is not null;

create index if not exists reward_programs_active_period_idx
  on public.reward_programs(status, starts_at, ends_at);
create index if not exists reward_programs_benefit_campaign_idx
  on public.reward_programs(benefit_campaign_id);
create index if not exists reward_programs_restaurant_idx
  on public.reward_programs(restaurant_id)
  where restaurant_id is not null;

create index if not exists customer_reward_progress_customer_idx
  on public.customer_reward_progress(customer_id, program_id, cycle desc);
create index if not exists customer_reward_progress_reward_credit_idx
  on public.customer_reward_progress(reward_credit_id)
  where reward_credit_id is not null;

create index if not exists reward_progress_events_customer_created_idx
  on public.reward_progress_events(customer_id, occurred_at desc);
create index if not exists reward_progress_events_order_idx
  on public.reward_progress_events(order_id)
  where order_id is not null;
create index if not exists reward_progress_events_progress_idx
  on public.reward_progress_events(progress_id);

alter table public.reward_programs enable row level security;
alter table public.customer_reward_progress enable row level security;
alter table public.reward_progress_events enable row level security;

revoke all on public.reward_programs from anon, authenticated;
revoke all on public.customer_reward_progress from anon, authenticated;
revoke all on public.reward_progress_events from anon, authenticated;

grant select on public.customer_reward_progress to authenticated;
grant select on public.reward_progress_events to authenticated;

drop policy if exists "Customers read own reward progress" on public.customer_reward_progress;
create policy "Customers read own reward progress"
  on public.customer_reward_progress
  for select to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "Customers read own reward events" on public.reward_progress_events;
create policy "Customers read own reward events"
  on public.reward_progress_events
  for select to authenticated
  using ((select auth.uid()) = customer_id);

create or replace function public.rewards_process_completed_order(
  _order_id uuid,
  _metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rewards_enabled boolean;
  v_order public.orders%rowtype;
  v_program public.reward_programs%rowtype;
  v_progress public.customer_reward_progress%rowtype;
  v_last public.customer_reward_progress%rowtype;
  v_cycle integer;
  v_inserted_event uuid;
  v_grant jsonb;
  v_credit_id uuid;
  v_processed integer := 0;
  v_rewards integer := 0;
begin
  select coalesce(localix_rewards_enabled, false)
    into v_rewards_enabled
  from public.platform_settings
  where id = true
  limit 1;

  if coalesce(v_rewards_enabled, false) is not true then
    raise exception 'REWARDS_DISABLED';
  end if;

  select * into v_order
  from public.orders
  where id = _order_id
  for share;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'concluido' then raise exception 'ORDER_NOT_COMPLETED'; end if;
  if v_order.customer_id is null then raise exception 'CUSTOMER_AUTH_REQUIRED'; end if;

  perform 1 from public.customer_profiles where id = v_order.customer_id;
  if not found then raise exception 'CUSTOMER_PROFILE_NOT_FOUND'; end if;

  for v_program in
    select *
    from public.reward_programs rp
    where rp.status = 'ACTIVE'
      and rp.event_type = 'ORDER_COMPLETED'
      and v_order.updated_at >= rp.starts_at
      and v_order.updated_at < rp.ends_at
      and v_order.total >= rp.min_order_amount
      and (rp.restaurant_id is null or rp.restaurant_id = v_order.restaurant_id)
    order by rp.created_at, rp.id
    for share
  loop
    select * into v_last
    from public.customer_reward_progress
    where program_id = v_program.id
      and customer_id = v_order.customer_id
    order by cycle desc
    limit 1
    for update;

    if not found then
      v_cycle := 1;
      insert into public.customer_reward_progress(program_id, customer_id, cycle)
      values(v_program.id, v_order.customer_id, v_cycle)
      on conflict(program_id, customer_id, cycle) do update
        set updated_at = public.customer_reward_progress.updated_at
      returning * into v_progress;
    elsif v_last.status = 'REWARDED' then
      if v_last.cycle >= v_program.max_cycles then
        continue;
      end if;
      v_cycle := v_last.cycle + 1;
      insert into public.customer_reward_progress(program_id, customer_id, cycle)
      values(v_program.id, v_order.customer_id, v_cycle)
      on conflict(program_id, customer_id, cycle) do update
        set updated_at = public.customer_reward_progress.updated_at
      returning * into v_progress;
    else
      v_cycle := v_last.cycle;
      v_progress := v_last;
    end if;

    insert into public.reward_progress_events(
      program_id, progress_id, customer_id, order_id, cycle,
      event_type, idempotency_key, metadata
    ) values (
      v_program.id,
      v_progress.id,
      v_order.customer_id,
      v_order.id,
      v_cycle,
      'ORDER_QUALIFIED',
      'reward:' || v_program.id::text || ':order:' || v_order.id::text || ':qualified',
      coalesce(_metadata, '{}'::jsonb)
    )
    on conflict do nothing
    returning id into v_inserted_event;

    if v_inserted_event is null then
      continue;
    end if;

    update public.customer_reward_progress
    set qualified_orders = qualified_orders + 1,
        updated_at = now()
    where id = v_progress.id
    returning * into v_progress;

    v_processed := v_processed + 1;

    if v_progress.qualified_orders >= v_program.required_orders
       and v_progress.status = 'IN_PROGRESS' then
      update public.customer_reward_progress
      set status = 'GOAL_REACHED',
          goal_reached_at = coalesce(goal_reached_at, now()),
          updated_at = now()
      where id = v_progress.id
        and status = 'IN_PROGRESS'
      returning * into v_progress;

      if found then
        insert into public.reward_progress_events(
          program_id, progress_id, customer_id, cycle,
          event_type, idempotency_key, metadata
        ) values (
          v_program.id,
          v_progress.id,
          v_order.customer_id,
          v_cycle,
          'GOAL_REACHED',
          'reward:' || v_program.id::text || ':customer:' || v_order.customer_id::text || ':cycle:' || v_cycle::text || ':goal',
          coalesce(_metadata, '{}'::jsonb)
        ) on conflict(idempotency_key) do nothing;

        v_grant := public.benefits_grant(
          v_program.benefit_campaign_id,
          v_order.customer_id,
          'LOCALIX_REWARD',
          v_program.id::text || ':' || v_cycle::text,
          'reward:' || v_program.id::text || ':' || v_order.customer_id::text || ':cycle:' || v_cycle::text,
          jsonb_build_object(
            'reward_program_id', v_program.id,
            'reward_cycle', v_cycle,
            'trigger_order_id', v_order.id
          ) || coalesce(_metadata, '{}'::jsonb)
        );

        v_credit_id := nullif(v_grant->>'credit_id', '')::uuid;

        update public.customer_reward_progress
        set status = 'REWARDED',
            reward_granted_at = coalesce(reward_granted_at, now()),
            reward_credit_id = coalesce(reward_credit_id, v_credit_id),
            updated_at = now()
        where id = v_progress.id;

        insert into public.reward_progress_events(
          program_id, progress_id, customer_id, order_id, cycle,
          event_type, idempotency_key, metadata
        ) values (
          v_program.id,
          v_progress.id,
          v_order.customer_id,
          v_order.id,
          v_cycle,
          'REWARD_GRANTED',
          'reward:' || v_program.id::text || ':customer:' || v_order.customer_id::text || ':cycle:' || v_cycle::text || ':granted',
          jsonb_build_object('benefit_credit_id', v_credit_id) || coalesce(_metadata, '{}'::jsonb)
        ) on conflict(idempotency_key) do nothing;

        v_rewards := v_rewards + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'order_id', _order_id,
    'qualified_events', v_processed,
    'rewards_granted', v_rewards
  );
end;
$$;

revoke all on function public.rewards_process_completed_order(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.rewards_process_completed_order(uuid,jsonb)
  to service_role;
