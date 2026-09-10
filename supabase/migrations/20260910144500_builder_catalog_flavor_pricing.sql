-- DEC-BUILDER-001: sabores do builder vinculados ao cardápio real.
-- Compatível com builders existentes: todos permanecem MANUAL + SUM por padrão.

alter table public.builder_groups
  add column if not exists source_type text not null default 'MANUAL',
  add column if not exists price_strategy text not null default 'SUM';

alter table public.builder_options
  add column if not exists menu_item_id uuid null references public.menu_items(id) on delete set null;

alter table public.builder_groups
  drop constraint if exists builder_groups_source_type_check;
alter table public.builder_groups
  add constraint builder_groups_source_type_check
  check (source_type in ('MANUAL', 'MENU_ITEMS'));

alter table public.builder_groups
  drop constraint if exists builder_groups_price_strategy_check;
alter table public.builder_groups
  add constraint builder_groups_price_strategy_check
  check (price_strategy in ('SUM', 'MAX_MENU_ITEM'));

create unique index if not exists builder_options_group_menu_item_uidx
  on public.builder_options(group_id, menu_item_id)
  where menu_item_id is not null;

-- Um único grupo pode ancorar o preço-base do builder pelo maior produto selecionado.
create unique index if not exists builder_groups_one_max_menu_item_per_builder_uidx
  on public.builder_groups(builder_id)
  where price_strategy = 'MAX_MENU_ITEM';

create index if not exists builder_options_menu_item_id_idx
  on public.builder_options(menu_item_id)
  where menu_item_id is not null;

create or replace function public.validate_builder_option_menu_item_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_builder_restaurant_id uuid;
  v_menu_restaurant_id uuid;
  v_group_source_type text;
begin
  if new.menu_item_id is null then
    return new;
  end if;

  select b.restaurant_id, g.source_type
    into v_builder_restaurant_id, v_group_source_type
  from public.builder_groups g
  join public.builders b on b.id = g.builder_id
  where g.id = new.group_id;

  select mi.restaurant_id
    into v_menu_restaurant_id
  from public.menu_items mi
  where mi.id = new.menu_item_id;

  if v_builder_restaurant_id is null or v_menu_restaurant_id is null then
    raise exception 'builder_menu_item_invalid';
  end if;

  if v_builder_restaurant_id <> v_menu_restaurant_id then
    raise exception 'builder_menu_item_wrong_restaurant';
  end if;

  if v_group_source_type <> 'MENU_ITEMS' then
    raise exception 'builder_menu_item_requires_menu_source';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_builder_option_menu_item_scope on public.builder_options;
create trigger trg_validate_builder_option_menu_item_scope
before insert or update of group_id, menu_item_id
on public.builder_options
for each row
execute function public.validate_builder_option_menu_item_scope();
