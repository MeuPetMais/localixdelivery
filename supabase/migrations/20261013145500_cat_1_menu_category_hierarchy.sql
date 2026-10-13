-- CAT-1 — DEC-015: category hierarchy foundation
-- Additive migration. Existing categories remain root categories (parent_category_id IS NULL).

alter table public.menu_categories
  add column if not exists parent_category_id uuid null,
  add column if not exists image_url text null,
  add column if not exists description text null;

alter table public.menu_categories
  drop constraint if exists menu_categories_parent_category_id_fkey;

alter table public.menu_categories
  add constraint menu_categories_parent_category_id_fkey
  foreign key (parent_category_id)
  references public.menu_categories(id)
  on delete restrict;

alter table public.menu_categories
  drop constraint if exists menu_categories_not_self_parent;

alter table public.menu_categories
  add constraint menu_categories_not_self_parent
  check (parent_category_id is null or parent_category_id <> id);

create index if not exists menu_categories_parent_category_id_idx
  on public.menu_categories(parent_category_id);

create or replace function private.validate_menu_category_hierarchy()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  parent_restaurant_id uuid;
  parent_parent_id uuid;
begin
  if new.parent_category_id is null then
    return new;
  end if;

  if new.parent_category_id = new.id then
    raise exception 'CATEGORY_SELF_PARENT';
  end if;

  select restaurant_id, parent_category_id
    into parent_restaurant_id, parent_parent_id
  from public.menu_categories
  where id = new.parent_category_id;

  if parent_restaurant_id is null then
    raise exception 'CATEGORY_PARENT_NOT_FOUND';
  end if;

  if parent_restaurant_id <> new.restaurant_id then
    raise exception 'CATEGORY_PARENT_TENANT_MISMATCH';
  end if;

  if parent_parent_id is not null then
    raise exception 'CATEGORY_MAX_DEPTH_EXCEEDED';
  end if;

  if exists (
    select 1
    from public.menu_categories child
    where child.parent_category_id = new.id
      and child.id <> new.id
  ) then
    raise exception 'CATEGORY_WITH_CHILDREN_CANNOT_BECOME_CHILD';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_menu_category_hierarchy on public.menu_categories;

create trigger trg_validate_menu_category_hierarchy
before insert or update of parent_category_id, restaurant_id
on public.menu_categories
for each row
execute function private.validate_menu_category_hierarchy();

create or replace function private.menu_category_is_publicly_visible(category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.menu_items mi
    where mi.category_id = category_id
      and mi.is_active = true
      and coalesce(mi.is_paused, false) = false
      and coalesce(mi.is_available, true) = true
  )
  or exists (
    select 1
    from public.menu_categories child
    join public.menu_items mi on mi.category_id = child.id
    where child.parent_category_id = category_id
      and mi.is_active = true
      and coalesce(mi.is_paused, false) = false
      and coalesce(mi.is_available, true) = true
  );
$$;

revoke all on function private.menu_category_is_publicly_visible(uuid) from public;
grant execute on function private.menu_category_is_publicly_visible(uuid) to anon, authenticated;

drop policy if exists "Public can view categories with active items" on public.menu_categories;

create policy "Public can view categories with active items"
on public.menu_categories
for select
to public
using (private.menu_category_is_publicly_visible(id));

comment on column public.menu_categories.parent_category_id is
  'DEC-015: NULL for root category; references a root category for one-level subcategories.';
comment on column public.menu_categories.image_url is
  'DEC-015: optional image for root category presentation.';
comment on column public.menu_categories.description is
  'DEC-015: optional short description for root category presentation.';
