-- EST-02: explicit Builder option -> ingredient composition and stock consumption.
-- No name-based inference. Existing builders remain unchanged until mappings are configured.

create table if not exists public.builder_option_ingredients (
  id uuid primary key default gen_random_uuid(),
  builder_option_id uuid not null references public.builder_options(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (builder_option_id, ingredient_id)
);

create index if not exists builder_option_ingredients_option_idx
  on public.builder_option_ingredients(builder_option_id);
create index if not exists builder_option_ingredients_ingredient_idx
  on public.builder_option_ingredients(ingredient_id);

alter table public.builder_option_ingredients enable row level security;

-- Partner owners can read mappings only for builders from their own restaurant.
drop policy if exists builder_option_ingredients_owner_select on public.builder_option_ingredients;
create policy builder_option_ingredients_owner_select
on public.builder_option_ingredients
for select
to authenticated
using (
  exists (
    select 1
    from public.builder_options bo
    join public.builder_groups bg on bg.id = bo.group_id
    join public.builders b on b.id = bg.builder_id
    join public.restaurants r on r.id = b.restaurant_id
    where bo.id = builder_option_ingredients.builder_option_id
      and r.owner_id = auth.uid()
  )
);

-- Partner owners can manage mappings only when ingredient and builder belong to the same owned restaurant.
drop policy if exists builder_option_ingredients_owner_insert on public.builder_option_ingredients;
create policy builder_option_ingredients_owner_insert
on public.builder_option_ingredients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.builder_options bo
    join public.builder_groups bg on bg.id = bo.group_id
    join public.builders b on b.id = bg.builder_id
    join public.restaurants r on r.id = b.restaurant_id
    join public.ingredients i on i.id = builder_option_ingredients.ingredient_id
    where bo.id = builder_option_ingredients.builder_option_id
      and i.restaurant_id = b.restaurant_id
      and r.owner_id = auth.uid()
  )
);

drop policy if exists builder_option_ingredients_owner_update on public.builder_option_ingredients;
create policy builder_option_ingredients_owner_update
on public.builder_option_ingredients
for update
to authenticated
using (
  exists (
    select 1
    from public.builder_options bo
    join public.builder_groups bg on bg.id = bo.group_id
    join public.builders b on b.id = bg.builder_id
    join public.restaurants r on r.id = b.restaurant_id
    where bo.id = builder_option_ingredients.builder_option_id
      and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.builder_options bo
    join public.builder_groups bg on bg.id = bo.group_id
    join public.builders b on b.id = bg.builder_id
    join public.restaurants r on r.id = b.restaurant_id
    join public.ingredients i on i.id = builder_option_ingredients.ingredient_id
    where bo.id = builder_option_ingredients.builder_option_id
      and i.restaurant_id = b.restaurant_id
      and r.owner_id = auth.uid()
  )
);

drop policy if exists builder_option_ingredients_owner_delete on public.builder_option_ingredients;
create policy builder_option_ingredients_owner_delete
on public.builder_option_ingredients
for delete
to authenticated
using (
  exists (
    select 1
    from public.builder_options bo
    join public.builder_groups bg on bg.id = bo.group_id
    join public.builders b on b.id = bg.builder_id
    join public.restaurants r on r.id = b.restaurant_id
    where bo.id = builder_option_ingredients.builder_option_id
      and r.owner_id = auth.uid()
  )
);

create or replace function private.consume_order_stock(
  _order_id uuid,
  _performed_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_restaurant_id uuid;
  v_items jsonb;
  v_req record;
  v_previous numeric;
  v_new numeric;
  v_consumed_count integer := 0;
begin
  select restaurant_id, items
    into v_restaurant_id, v_items
    from public.orders
   where id = _order_id
   for update;

  if v_restaurant_id is null then
    return jsonb_build_object('ok', false, 'reason', 'ORDER_NOT_FOUND');
  end if;

  if exists (
    select 1 from public.stock_movements sm
     where sm.reference_type = 'order'
       and sm.reference_id = _order_id
       and coalesce(sm.metadata->>'operation', '') = 'consume'
  ) then
    return jsonb_build_object('ok', true, 'already_processed', true, 'consumed_ingredients', 0);
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    return jsonb_build_object('ok', true, 'consumed_ingredients', 0);
  end if;

  -- Build one authoritative requirement set by ingredient, combining:
  -- 1) normal products -> recipe_items
  -- 2) builder selections -> builder_option_ingredients
  -- Builder quantities respect selection.quantity and order item qty.
  for v_req in
    with normal_lines as (
      select (line->>'id')::uuid as menu_item_id,
             coalesce(nullif(line->>'qty', '')::numeric, 0) as item_qty
      from jsonb_array_elements(v_items) line
      where coalesce(line->>'kind', 'product') <> 'builder'
        and coalesce(line->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(nullif(line->>'qty', '')::numeric, 0) > 0
    ),
    normal_req as (
      select ri.ingredient_id,
             sum(ri.quantity * nl.item_qty)::numeric as required_qty,
             'recipe_items'::text as source
      from normal_lines nl
      join public.recipe_items ri on ri.menu_item_id = nl.menu_item_id
      group by ri.ingredient_id
    ),
    builder_selected as (
      select (sel->>'option_id')::uuid as option_id,
             coalesce(nullif(sel->>'quantity', '')::numeric, 1) as selection_qty,
             coalesce(nullif(line->>'qty', '')::numeric, 0) as item_qty
      from jsonb_array_elements(v_items) line
      cross join lateral jsonb_array_elements(coalesce(line->'selections', '[]'::jsonb)) sel
      where line->>'kind' = 'builder'
        and coalesce(sel->>'option_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(nullif(line->>'qty', '')::numeric, 0) > 0
        and coalesce(nullif(sel->>'quantity', '')::numeric, 1) > 0
    ),
    builder_req as (
      select boi.ingredient_id,
             sum(boi.quantity * bs.selection_qty * bs.item_qty)::numeric as required_qty,
             'builder_option_ingredients'::text as source
      from builder_selected bs
      join public.builder_option_ingredients boi on boi.builder_option_id = bs.option_id
      join public.builder_options bo on bo.id = boi.builder_option_id
      join public.builder_groups bg on bg.id = bo.group_id
      join public.builders b on b.id = bg.builder_id
      where b.restaurant_id = v_restaurant_id
      group by boi.ingredient_id
    ),
    combined as (
      select ingredient_id, required_qty from normal_req
      union all
      select ingredient_id, required_qty from builder_req
    )
    select c.ingredient_id,
           ing.name as ingredient_name,
           ing.unit as ingredient_unit,
           sum(c.required_qty)::numeric as required_qty
      from combined c
      join public.ingredients ing on ing.id = c.ingredient_id
     where ing.restaurant_id = v_restaurant_id
     group by c.ingredient_id, ing.name, ing.unit
     order by c.ingredient_id
  loop
    select stock into v_previous
      from public.ingredients
     where id = v_req.ingredient_id
       and restaurant_id = v_restaurant_id
     for update;

    if v_previous is null then
      return jsonb_build_object('ok', false, 'reason', 'INGREDIENT_NOT_FOUND', 'ingredient_id', v_req.ingredient_id, 'ingredient_name', v_req.ingredient_name);
    end if;

    if v_previous < v_req.required_qty then
      return jsonb_build_object('ok', false, 'reason', 'INSUFFICIENT_STOCK', 'ingredient_id', v_req.ingredient_id, 'ingredient_name', v_req.ingredient_name, 'unit', v_req.ingredient_unit, 'available', v_previous, 'required', v_req.required_qty);
    end if;
  end loop;

  for v_req in
    with normal_lines as (
      select (line->>'id')::uuid as menu_item_id,
             coalesce(nullif(line->>'qty', '')::numeric, 0) as item_qty
      from jsonb_array_elements(v_items) line
      where coalesce(line->>'kind', 'product') <> 'builder'
        and coalesce(line->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(nullif(line->>'qty', '')::numeric, 0) > 0
    ),
    normal_req as (
      select ri.ingredient_id, sum(ri.quantity * nl.item_qty)::numeric as required_qty
      from normal_lines nl
      join public.recipe_items ri on ri.menu_item_id = nl.menu_item_id
      group by ri.ingredient_id
    ),
    builder_selected as (
      select (sel->>'option_id')::uuid as option_id,
             coalesce(nullif(sel->>'quantity', '')::numeric, 1) as selection_qty,
             coalesce(nullif(line->>'qty', '')::numeric, 0) as item_qty
      from jsonb_array_elements(v_items) line
      cross join lateral jsonb_array_elements(coalesce(line->'selections', '[]'::jsonb)) sel
      where line->>'kind' = 'builder'
        and coalesce(sel->>'option_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and coalesce(nullif(line->>'qty', '')::numeric, 0) > 0
        and coalesce(nullif(sel->>'quantity', '')::numeric, 1) > 0
    ),
    builder_req as (
      select boi.ingredient_id, sum(boi.quantity * bs.selection_qty * bs.item_qty)::numeric as required_qty
      from builder_selected bs
      join public.builder_option_ingredients boi on boi.builder_option_id = bs.option_id
      join public.builder_options bo on bo.id = boi.builder_option_id
      join public.builder_groups bg on bg.id = bo.group_id
      join public.builders b on b.id = bg.builder_id
      where b.restaurant_id = v_restaurant_id
      group by boi.ingredient_id
    ),
    combined as (
      select ingredient_id, required_qty from normal_req
      union all
      select ingredient_id, required_qty from builder_req
    )
    select c.ingredient_id,
           ing.name as ingredient_name,
           ing.unit as ingredient_unit,
           sum(c.required_qty)::numeric as required_qty
      from combined c
      join public.ingredients ing on ing.id = c.ingredient_id
     where ing.restaurant_id = v_restaurant_id
     group by c.ingredient_id, ing.name, ing.unit
     order by c.ingredient_id
  loop
    select stock into v_previous
      from public.ingredients
     where id = v_req.ingredient_id
       and restaurant_id = v_restaurant_id
     for update;

    v_new := v_previous - v_req.required_qty;

    update public.ingredients
       set stock = v_new
     where id = v_req.ingredient_id
       and restaurant_id = v_restaurant_id;

    insert into public.stock_movements (
      ingredient_id, movement_type, quantity, previous_stock, new_stock,
      reason, reference_type, reference_id, performed_by, metadata
    ) values (
      v_req.ingredient_id,
      'SALE'::public.stock_movement_type,
      v_req.required_qty,
      v_previous,
      v_new,
      'Consumo automático por aceite de pedido',
      'order',
      _order_id,
      _performed_by,
      jsonb_build_object(
        'operation', 'consume',
        'source', 'order_recipe_and_builder',
        'ingredient_unit', v_req.ingredient_unit
      )
    );

    v_consumed_count := v_consumed_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'already_processed', false, 'consumed_ingredients', v_consumed_count);
end;
$$;
