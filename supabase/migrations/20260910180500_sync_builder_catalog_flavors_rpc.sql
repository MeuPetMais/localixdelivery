-- DEC-BUILDER-001: sincronização atômica dos sabores do builder com o cardápio real.
-- O cliente autenticado só pode alterar grupos pertencentes ao restaurante do qual é owner.

create or replace function public.sync_builder_catalog_flavors(
  p_group_id uuid,
  p_menu_item_ids uuid[]
)
returns table (
  id uuid,
  group_id uuid,
  name text,
  price_delta numeric,
  max_qty integer,
  position integer,
  menu_item_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_owner_id uuid;
  v_requested_count integer;
  v_valid_count integer;
begin
  if auth.uid() is null then
    raise exception 'builder_catalog_auth_required';
  end if;

  if p_group_id is null then
    raise exception 'builder_catalog_group_required';
  end if;

  v_requested_count := coalesce(array_length(p_menu_item_ids, 1), 0);
  if v_requested_count = 0 then
    raise exception 'builder_catalog_items_required';
  end if;

  if v_requested_count <> (
    select count(distinct requested_id)
    from unnest(p_menu_item_ids) as requested(requested_id)
  ) then
    raise exception 'builder_catalog_items_duplicated';
  end if;

  select b.restaurant_id, r.owner_id
    into v_restaurant_id, v_owner_id
  from public.builder_groups g
  join public.builders b on b.id = g.builder_id
  join public.restaurants r on r.id = b.restaurant_id
  where g.id = p_group_id
  for update of g;

  if v_restaurant_id is null then
    raise exception 'builder_catalog_group_invalid';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'builder_catalog_forbidden';
  end if;

  select count(*)
    into v_valid_count
  from public.menu_items mi
  where mi.id = any(p_menu_item_ids)
    and mi.restaurant_id = v_restaurant_id
    and mi.is_active = true
    and coalesce(mi.is_available, true) = true
    and coalesce(mi.is_paused, false) = false;

  if v_valid_count <> v_requested_count then
    raise exception 'builder_catalog_item_invalid_or_unavailable';
  end if;

  update public.builder_groups
  set source_type = 'MENU_ITEMS',
      price_strategy = 'MAX_MENU_ITEM'
  where builder_groups.id = p_group_id;

  delete from public.builder_options bo
  where bo.group_id = p_group_id
    and (bo.menu_item_id is null or not (bo.menu_item_id = any(p_menu_item_ids)));

  insert into public.builder_options (
    group_id,
    name,
    price_delta,
    max_qty,
    position,
    menu_item_id
  )
  select
    p_group_id,
    mi.name,
    0,
    1,
    row_number() over (order by mi.position nulls last, mi.name, mi.id)::integer - 1,
    mi.id
  from public.menu_items mi
  where mi.id = any(p_menu_item_ids)
    and mi.restaurant_id = v_restaurant_id
  on conflict (group_id, menu_item_id) where menu_item_id is not null
  do update set
    name = excluded.name,
    price_delta = 0,
    max_qty = 1,
    position = excluded.position;

  return query
  select
    bo.id,
    bo.group_id,
    bo.name,
    bo.price_delta,
    bo.max_qty,
    bo.position,
    bo.menu_item_id
  from public.builder_options bo
  where bo.group_id = p_group_id
    and bo.menu_item_id = any(p_menu_item_ids)
  order by bo.position, bo.name, bo.id;
end;
$$;

revoke all on function public.sync_builder_catalog_flavors(uuid, uuid[]) from public;
grant execute on function public.sync_builder_catalog_flavors(uuid, uuid[]) to authenticated;
