-- RW-1.2 — Durable order-event queue for Localix Rewards

create table if not exists public.reward_order_event_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null check (event_type in ('ORDER_COMPLETED','ORDER_REFUNDED','ORDER_CHARGEBACK','ORDER_CANCELLED')),
  order_status text not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSED','FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 10 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(order_id,event_type)
);

create index if not exists reward_order_event_queue_pending_idx
  on public.reward_order_event_queue(status,available_at,created_at)
  where status in ('PENDING','FAILED');
create index if not exists reward_order_event_queue_order_idx
  on public.reward_order_event_queue(order_id);

alter table public.reward_order_event_queue enable row level security;
revoke all on public.reward_order_event_queue from public, anon, authenticated;

create or replace function public.tg_rewards_enqueue_order_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean := false;
  v_event_type text;
begin
  select coalesce(localix_rewards_enabled,false) into v_enabled
  from public.platform_settings where id=true limit 1;
  if not v_enabled then return new; end if;
  if new.customer_id is null then return new; end if;
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;

  v_event_type := case new.status
    when 'concluido' then 'ORDER_COMPLETED'
    when 'reembolsado' then 'ORDER_REFUNDED'
    when 'chargeback' then 'ORDER_CHARGEBACK'
    when 'cancelado' then 'ORDER_CANCELLED'
    else null end;
  if v_event_type is null then return new; end if;

  insert into public.reward_order_event_queue(order_id,event_type,order_status,source_updated_at,metadata)
  values(new.id,v_event_type,new.status,new.updated_at,
    jsonb_build_object('restaurant_id',new.restaurant_id,'customer_id',new.customer_id))
  on conflict(order_id,event_type) do nothing;
  return new;
end;
$$;

revoke execute on function public.tg_rewards_enqueue_order_event() from public, anon, authenticated;

drop trigger if exists trg_rewards_enqueue_order_event on public.orders;
create trigger trg_rewards_enqueue_order_event
after insert or update of status on public.orders
for each row execute function public.tg_rewards_enqueue_order_event();

create or replace function public.rewards_process_order_event_queue(_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.reward_order_event_queue%rowtype;
  v_processed integer := 0;
  v_failed integer := 0;
  v_result jsonb;
begin
  if _limit is null or _limit < 1 or _limit > 500 then raise exception 'INVALID_LIMIT'; end if;

  for v_item in
    select * from public.reward_order_event_queue
    where status in ('PENDING','FAILED')
      and attempts < max_attempts
      and available_at <= now()
    order by created_at,id
    limit _limit
    for update skip locked
  loop
    -- Increment outside the inner EXCEPTION block so a failed attempt remains counted.
    update public.reward_order_event_queue
    set attempts=attempts+1,last_error=null,updated_at=now()
    where id=v_item.id
    returning * into v_item;

    begin
      if v_item.event_type='ORDER_COMPLETED' then
        v_result := public.rewards_process_completed_order(
          v_item.order_id,
          jsonb_build_object('queue_event_id',v_item.id,'queue_event_type',v_item.event_type)
        );
      else
        v_result := public.rewards_reverse_order(
          v_item.order_id,
          v_item.event_type,
          jsonb_build_object('queue_event_id',v_item.id,'queue_event_type',v_item.event_type)
        );
      end if;

      update public.reward_order_event_queue
      set status='PROCESSED',processed_at=now(),last_error=null,updated_at=now(),
          metadata=metadata||jsonb_build_object('result',v_result)
      where id=v_item.id;
      v_processed := v_processed+1;
    exception when others then
      update public.reward_order_event_queue
      set status='FAILED',last_error=left(sqlerrm,2000),
          available_at=now()+make_interval(secs => least(3600,greatest(30,(power(2,least(v_item.attempts,7))::integer)*30))),
          updated_at=now()
      where id=v_item.id;
      v_failed := v_failed+1;
    end;
  end loop;

  return jsonb_build_object('ok',true,'processed',v_processed,'failed',v_failed);
end;
$$;

revoke all on function public.rewards_process_order_event_queue(integer) from public, anon, authenticated;
grant execute on function public.rewards_process_order_event_queue(integer) to service_role;

-- Worker stays active; feature kill switch prevents new queue rows while Rewards is disabled.
select cron.unschedule(jobid) from cron.job where jobname='localix-rewards-order-events';
select cron.schedule(
  'localix-rewards-order-events',
  '* * * * *',
  'select public.rewards_process_order_event_queue(50);'
);