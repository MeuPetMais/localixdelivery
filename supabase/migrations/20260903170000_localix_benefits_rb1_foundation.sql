-- RB-1 Localix Benefits foundation
-- Staging reference: dnotmvbhuqujvqdtgzav
-- Keeps feature disabled by default and exposes financial RPCs only to service_role.

alter table public.platform_settings
  add column if not exists localix_benefits_enabled boolean not null default false;

create table if not exists public.benefit_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','ENDED')),
  funding_source text not null default 'LOCALIX' check (funding_source in ('LOCALIX')),
  benefit_type text not null default 'CREDIT' check (benefit_type in ('CREDIT')),
  credit_amount numeric(12,2) not null check (credit_amount > 0),
  budget_total numeric(12,2) not null check (budget_total >= 0),
  budget_committed numeric(12,2) not null default 0 check (budget_committed >= 0),
  budget_redeemed numeric(12,2) not null default 0 check (budget_redeemed >= 0),
  max_grants_per_customer integer not null default 1 check (max_grants_per_customer > 0),
  min_order_amount numeric(12,2) not null default 0 check (min_order_amount >= 0),
  validity_days integer not null default 30 check (validity_days between 1 and 3650),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint benefit_campaign_budget_ck check (budget_committed <= budget_total and budget_redeemed <= budget_committed),
  constraint benefit_campaign_period_ck check (ends_at > starts_at)
);

create table if not exists public.customer_benefit_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  campaign_id uuid not null references public.benefit_campaigns(id) on delete restrict,
  granted_amount numeric(12,2) not null check (granted_amount > 0),
  available_amount numeric(12,2) not null default 0 check (available_amount >= 0),
  reserved_amount numeric(12,2) not null default 0 check (reserved_amount >= 0),
  redeemed_amount numeric(12,2) not null default 0 check (redeemed_amount >= 0),
  expired_amount numeric(12,2) not null default 0 check (expired_amount >= 0),
  reversed_amount numeric(12,2) not null default 0 check (reversed_amount >= 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','PARTIALLY_USED','USED','EXPIRED','REVERSED')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_type text not null,
  source_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint customer_benefit_credit_conservation_ck check (
    granted_amount = available_amount + reserved_amount + redeemed_amount + expired_amount
  )
);

create table if not exists public.benefit_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.customer_benefit_credits(id) on delete restrict,
  campaign_id uuid not null references public.benefit_campaigns(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('GRANT','RESERVE','RELEASE','REDEEM','REVERSE','EXPIRE','ADJUSTMENT')),
  amount numeric(12,2) not null check (amount > 0),
  balance_before numeric(12,2) not null check (balance_before >= 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  reference_type text,
  reference_id text,
  idempotency_key text not null unique,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.benefit_reservations (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.customer_benefit_credits(id) on delete restrict,
  campaign_id uuid not null references public.benefit_campaigns(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  checkout_reference text,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','REDEEMED','EXPIRED')),
  idempotency_key text not null,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  released_at timestamptz,
  redeemed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint benefit_reservation_reference_ck check (order_id is not null or checkout_reference is not null),
  unique (idempotency_key, credit_id)
);

create index if not exists benefit_campaigns_status_period_idx on public.benefit_campaigns(status, starts_at, ends_at);
create index if not exists customer_benefit_credits_customer_expiry_idx on public.customer_benefit_credits(customer_id, expires_at) where available_amount > 0;
create index if not exists customer_benefit_credits_campaign_customer_idx on public.customer_benefit_credits(campaign_id, customer_id);
create index if not exists benefit_credit_ledger_customer_created_idx on public.benefit_credit_ledger(customer_id, created_at desc);
create index if not exists benefit_credit_ledger_campaign_created_idx on public.benefit_credit_ledger(campaign_id, created_at desc);
create index if not exists benefit_reservations_customer_status_idx on public.benefit_reservations(customer_id, status, expires_at);
create index if not exists benefit_reservations_key_idx on public.benefit_reservations(idempotency_key);

alter table public.benefit_campaigns enable row level security;
alter table public.customer_benefit_credits enable row level security;
alter table public.benefit_credit_ledger enable row level security;
alter table public.benefit_reservations enable row level security;

revoke all on public.benefit_campaigns from anon, authenticated;
revoke all on public.customer_benefit_credits from anon, authenticated;
revoke all on public.benefit_credit_ledger from anon, authenticated;
revoke all on public.benefit_reservations from anon, authenticated;

grant select on public.customer_benefit_credits to authenticated;
grant select on public.benefit_credit_ledger to authenticated;
grant select on public.benefit_reservations to authenticated;

create policy "Customers read own benefit credits" on public.customer_benefit_credits for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Customers read own benefit ledger" on public.benefit_credit_ledger for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Customers read own benefit reservations" on public.benefit_reservations for select to authenticated using ((select auth.uid()) = customer_id);

create or replace function public.benefit_credit_ledger_prevent_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user <> 'postgres' then raise exception 'BENEFIT_LEDGER_APPEND_ONLY'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.benefit_credit_ledger_prevent_mutation() from public, anon, authenticated;
create trigger trg_benefit_credit_ledger_append_only before update or delete on public.benefit_credit_ledger for each row execute function public.benefit_credit_ledger_prevent_mutation();

create or replace function public.benefits_grant(_campaign_id uuid,_customer_id uuid,_source_type text,_source_id text,_idempotency_key text,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_campaign public.benefit_campaigns%rowtype; v_existing public.customer_benefit_credits%rowtype; v_credit public.customer_benefit_credits%rowtype; v_count integer; v_enabled boolean;
begin
  select coalesce(localix_benefits_enabled,false) into v_enabled from public.platform_settings where id=true limit 1;
  if coalesce(v_enabled,false) is not true then raise exception 'BENEFITS_DISABLED'; end if;
  if nullif(trim(_idempotency_key),'') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  select * into v_existing from public.customer_benefit_credits where idempotency_key=_idempotency_key;
  if found then
    if v_existing.customer_id<>_customer_id or v_existing.campaign_id<>_campaign_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'credit_id',v_existing.id,'amount',v_existing.granted_amount,'available',v_existing.available_amount,'expires_at',v_existing.expires_at);
  end if;
  perform 1 from public.customer_profiles where id=_customer_id; if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  select * into v_campaign from public.benefit_campaigns where id=_campaign_id for update; if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if v_campaign.status<>'ACTIVE' then raise exception 'CAMPAIGN_INACTIVE'; end if;
  if now()<v_campaign.starts_at or now()>=v_campaign.ends_at then raise exception 'CAMPAIGN_EXPIRED'; end if;
  if v_campaign.budget_committed+v_campaign.credit_amount>v_campaign.budget_total then raise exception 'BUDGET_EXHAUSTED'; end if;
  select count(*) into v_count from public.customer_benefit_credits where campaign_id=_campaign_id and customer_id=_customer_id;
  if v_count>=v_campaign.max_grants_per_customer then raise exception 'CUSTOMER_LIMIT_REACHED'; end if;
  insert into public.customer_benefit_credits(customer_id,campaign_id,granted_amount,available_amount,expires_at,source_type,source_id,idempotency_key,metadata)
  values(_customer_id,_campaign_id,v_campaign.credit_amount,v_campaign.credit_amount,now()+make_interval(days=>v_campaign.validity_days),_source_type,_source_id,_idempotency_key,coalesce(_metadata,'{}'::jsonb)) returning * into v_credit;
  insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,metadata)
  values(v_credit.id,_campaign_id,_customer_id,'GRANT',v_campaign.credit_amount,0,v_campaign.credit_amount,_source_type,_source_id,_idempotency_key||':grant',coalesce(_metadata,'{}'::jsonb));
  update public.benefit_campaigns set budget_committed=budget_committed+v_campaign.credit_amount,updated_at=now() where id=_campaign_id;
  return jsonb_build_object('ok',true,'replayed',false,'credit_id',v_credit.id,'amount',v_credit.granted_amount,'available',v_credit.available_amount,'expires_at',v_credit.expires_at);
end; $$;

-- benefits_reserve uses FEFO and row locks; benefits_release/redeem/reverse/release_expired
-- are intentionally versioned in a second migration to keep this foundation reviewable.

revoke all on function public.benefits_grant(uuid,uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.benefits_grant(uuid,uuid,text,text,text,jsonb) to service_role;
