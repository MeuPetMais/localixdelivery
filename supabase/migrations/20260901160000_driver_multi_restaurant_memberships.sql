-- DEC: entregador possui uma identidade Localix e pode operar em varios restaurantes.
-- Compatibilidade: delivery_drivers continua sendo o perfil operacional por restaurante.
-- owner_id continua unico e representa o contexto operacional atualmente selecionado.

create table if not exists public.driver_restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, restaurant_id),
  unique (driver_id)
);

create index if not exists idx_driver_restaurant_memberships_owner
  on public.driver_restaurant_memberships(owner_id, status);
create index if not exists idx_driver_restaurant_memberships_restaurant
  on public.driver_restaurant_memberships(restaurant_id, status);

alter table public.driver_restaurant_memberships enable row level security;

revoke all on public.driver_restaurant_memberships from anon;
revoke all on public.driver_restaurant_memberships from authenticated;
grant select on public.driver_restaurant_memberships to authenticated;

drop policy if exists driver_memberships_select_own on public.driver_restaurant_memberships;
create policy driver_memberships_select_own
on public.driver_restaurant_memberships
for select
to authenticated
using (owner_id = auth.uid());

-- Backfill: cada entregador atualmente ativado vira o primeiro vinculo da conta.
insert into public.driver_restaurant_memberships (owner_id, driver_id, restaurant_id, status)
select d.owner_id, d.id, d.restaurant_id, 'ativo'
from public.delivery_drivers d
where d.owner_id is not null
on conflict (driver_id) do nothing;

-- Reconciliacao de perfis operacionais ja cadastrados em outro parceiro antes desta migration.
-- CPF e a identidade civil autoritativa; telefone pode ter sido alterado entre cadastros.
insert into public.driver_restaurant_memberships (owner_id, driver_id, restaurant_id, status)
select identity.owner_id, candidate.id, candidate.restaurant_id, 'ativo'
from public.delivery_drivers candidate
cross join lateral (
  select source.owner_id
  from public.delivery_drivers source
  where source.owner_id is not null
    and source.id <> candidate.id
    and regexp_replace(coalesce(source.cpf, ''), '\D', '', 'g') <> ''
    and regexp_replace(coalesce(source.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(candidate.cpf, ''), '\D', '', 'g')
  order by source.created_at asc
  limit 1
) identity
where candidate.owner_id is null
  and candidate.status::text = 'ativo'
on conflict (driver_id) do nothing;

-- Mantem o vinculo em sincronia quando uma conta nova e ativada normalmente.
create or replace function public.tg_sync_driver_restaurant_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.driver_restaurant_memberships(owner_id, driver_id, restaurant_id, status)
    values (new.owner_id, new.id, new.restaurant_id, 'ativo')
    on conflict (driver_id) do update
      set owner_id = excluded.owner_id,
          restaurant_id = excluded.restaurant_id,
          status = 'ativo',
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_driver_restaurant_membership on public.delivery_drivers;
create trigger trg_sync_driver_restaurant_membership
after insert or update of owner_id on public.delivery_drivers
for each row execute function public.tg_sync_driver_restaurant_membership();

-- Se o parceiro cadastrar um CPF que ja pertence a uma conta Localix ativa,
-- o novo registro vira perfil operacional do novo restaurante sem criar outro Auth user.
create or replace function public.tg_reuse_existing_driver_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
begin
  if new.owner_id is null and new.status::text = 'aguardando_ativacao' and v_cpf <> '' then
    select d.owner_id, d.email
      into v_existing
      from public.delivery_drivers d
     where d.owner_id is not null
       and d.status::text = 'ativo'
       and d.restaurant_id <> new.restaurant_id
       and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf
     order by d.created_at asc
     limit 1;

    if v_existing.owner_id is not null then
      new.status := 'ativo';
      new.email := coalesce(new.email, v_existing.email);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reuse_existing_driver_identity on public.delivery_drivers;
create trigger trg_reuse_existing_driver_identity
before insert on public.delivery_drivers
for each row execute function public.tg_reuse_existing_driver_identity();

-- Depois do INSERT, associa o perfil novo a identidade existente.
create or replace function public.tg_link_reused_driver_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
begin
  if new.owner_id is null and new.status::text = 'ativo' and v_cpf <> '' then
    select d.owner_id
      into v_owner
      from public.delivery_drivers d
     where d.id <> new.id
       and d.owner_id is not null
       and d.status::text = 'ativo'
       and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf
     order by d.created_at asc
     limit 1;

    if v_owner is not null then
      insert into public.driver_restaurant_memberships(owner_id, driver_id, restaurant_id, status)
      values (v_owner, new.id, new.restaurant_id, 'ativo')
      on conflict (driver_id) do update
        set owner_id = excluded.owner_id,
            restaurant_id = excluded.restaurant_id,
            status = 'ativo',
            updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_reused_driver_identity on public.delivery_drivers;
create trigger trg_link_reused_driver_identity
after insert on public.delivery_drivers
for each row execute function public.tg_link_reused_driver_identity();

-- Troca de estabelecimento sem alterar os contratos atuais do app:
-- somente o perfil operacional selecionado recebe delivery_drivers.owner_id.
create or replace function public.driver_switch_restaurant_context(_driver_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_target record;
  v_current record;
begin
  if v_owner is null then
    return jsonb_build_object('ok', false, 'reason', 'UNAUTHENTICATED');
  end if;

  select m.driver_id, m.restaurant_id, m.status, d.owner_id, d.online
    into v_target
    from public.driver_restaurant_memberships m
    join public.delivery_drivers d on d.id = m.driver_id
   where m.owner_id = v_owner
     and m.driver_id = _driver_id
     and m.status = 'ativo'
   for update of m, d;

  if v_target.driver_id is null then
    return jsonb_build_object('ok', false, 'reason', 'MEMBERSHIP_NOT_FOUND');
  end if;

  select id, restaurant_id, online
    into v_current
    from public.delivery_drivers
   where owner_id = v_owner
   for update;

  if v_current.id = _driver_id then
    return jsonb_build_object('ok', true, 'reason', 'ALREADY_SELECTED', 'driver_id', _driver_id, 'restaurant_id', v_target.restaurant_id);
  end if;

  if v_current.id is not null then
    if v_current.online then
      return jsonb_build_object('ok', false, 'reason', 'CURRENT_CONTEXT_ONLINE');
    end if;
    if exists (
      select 1 from public.delivery_assignments a
       where a.driver_id = v_current.id
         and a.status in ('ATRIBUIDO','COLETANDO','EM_ROTA')
    ) then
      return jsonb_build_object('ok', false, 'reason', 'CURRENT_CONTEXT_HAS_ACTIVE_ASSIGNMENT');
    end if;
    if exists (
      select 1 from public.delivery_queue q
       where q.driver_id = v_current.id
         and q.status <> 'INATIVO'
    ) then
      return jsonb_build_object('ok', false, 'reason', 'CURRENT_CONTEXT_IN_QUEUE');
    end if;
  end if;

  if v_target.owner_id is not null and v_target.owner_id <> v_owner then
    return jsonb_build_object('ok', false, 'reason', 'TARGET_CONTEXT_IN_USE');
  end if;

  -- O indice unico de owner_id continua protegendo contra dois contextos simultaneos.
  if v_current.id is not null then
    update public.delivery_drivers
       set owner_id = null, online = false, updated_at = now()
     where id = v_current.id;
  end if;

  update public.delivery_drivers
     set owner_id = v_owner, online = false, updated_at = now()
   where id = _driver_id;

  return jsonb_build_object('ok', true, 'reason', 'SWITCHED', 'driver_id', _driver_id, 'restaurant_id', v_target.restaurant_id);
end;
$$;

revoke all on function public.driver_switch_restaurant_context(uuid) from public;
grant execute on function public.driver_switch_restaurant_context(uuid) to authenticated;
