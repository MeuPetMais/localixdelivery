-- Finance-critical rule: driver earning must use the delivery fee charged on the order snapshot.
-- No automatic subsidy and no fallback to driver_earning_settings/default policy.
-- Historical delivered assignments are not rewritten by this migration.

create or replace function public.enforce_driver_earning_from_order_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery_fee numeric;
  v_snapshot_found boolean := false;
begin
  select s.delivery_fee, true
    into v_delivery_fee, v_snapshot_found
    from public.order_pricing_snapshot s
   where s.order_id = new.order_id
   limit 1;

  if coalesce(v_snapshot_found, false) then
    v_delivery_fee := coalesce(v_delivery_fee, 0);

    new.driver_base_fee := v_delivery_fee;
    new.driver_per_km_fee := 0;
    new.driver_earning_amount := v_delivery_fee;
    new.driver_earning_calculated_at := now();
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'driver_earning_source', 'order_pricing_snapshot_delivery_fee',
        'driver_earning_authoritative', true,
        'driver_earning_subsidy', 0
      );
  else
    -- Fail closed financially: never fall back to an arbitrary default earning.
    -- Keep the delivery operation available, but leave remuneration unresolved.
    new.driver_base_fee := null;
    new.driver_per_km_fee := null;
    new.driver_earning_amount := null;
    new.driver_earning_calculated_at := null;
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'driver_earning_source', 'missing_order_pricing_snapshot',
        'driver_earning_authoritative', false,
        'driver_earning_requires_review', true
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_driver_earning_from_order_snapshot
  on public.delivery_assignments;

create trigger trg_enforce_driver_earning_from_order_snapshot
before insert or update of
  order_id,
  driver_base_fee,
  driver_per_km_fee,
  driver_earning_amount,
  driver_earning_calculated_at,
  status
on public.delivery_assignments
for each row
execute function public.enforce_driver_earning_from_order_snapshot();

comment on function public.enforce_driver_earning_from_order_snapshot() is
'Authoritative financial guard: driver earning equals order_pricing_snapshot.delivery_fee. No implicit subsidy or default-policy fallback.';
