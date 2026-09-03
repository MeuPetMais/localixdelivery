-- RB-1 Localix Benefits transactional RPCs

create or replace function public.benefits_reserve(_customer_id uuid,_requested_amount numeric,_order_subtotal numeric,_idempotency_key text,_order_id uuid default null,_checkout_reference text default null,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_enabled boolean; v_existing_amount numeric(12,2); v_existing_customer uuid; v_remaining numeric(12,2); v_take numeric(12,2); v_credit record; v_before numeric(12,2); v_after numeric(12,2); v_reserved numeric(12,2):=0;
begin
  select coalesce(localix_benefits_enabled,false) into v_enabled from public.platform_settings where id=true limit 1;
  if coalesce(v_enabled,false) is not true then raise exception 'BENEFITS_DISABLED'; end if;
  if _requested_amount is null or _requested_amount<=0 then raise exception 'INVALID_RESERVE_AMOUNT'; end if;
  if _order_subtotal is null or _order_subtotal<0 then raise exception 'INVALID_ORDER_SUBTOTAL'; end if;
  if _order_id is null and nullif(trim(_checkout_reference),'') is null then raise exception 'RESERVATION_REFERENCE_REQUIRED'; end if;
  if nullif(trim(_idempotency_key),'') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  select sum(amount),(array_agg(customer_id order by reserved_at))[1] into v_existing_amount,v_existing_customer from public.benefit_reservations where idempotency_key=_idempotency_key;
  if v_existing_amount is not null then
    if v_existing_customer<>_customer_id or v_existing_amount<>_requested_amount then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'reserved_amount',v_existing_amount,'idempotency_key',_idempotency_key);
  end if;
  v_remaining:=round(_requested_amount::numeric,2);
  for v_credit in
    select c.id,c.campaign_id,c.available_amount,c.reserved_amount,c.expires_at,bc.min_order_amount
    from public.customer_benefit_credits c join public.benefit_campaigns bc on bc.id=c.campaign_id
    where c.customer_id=_customer_id and c.available_amount>0 and c.expires_at>now() and c.status in ('AVAILABLE','PARTIALLY_USED')
      and bc.status='ACTIVE' and now()>=bc.starts_at and now()<bc.ends_at and _order_subtotal>=bc.min_order_amount
    order by c.expires_at asc,c.granted_at asc for update of c
  loop
    exit when v_remaining<=0; v_take:=least(v_remaining,v_credit.available_amount); v_before:=v_credit.available_amount; v_after:=v_before-v_take;
    update public.customer_benefit_credits set available_amount=available_amount-v_take,reserved_amount=reserved_amount+v_take,status='PARTIALLY_USED',updated_at=now() where id=v_credit.id;
    insert into public.benefit_reservations(credit_id,campaign_id,customer_id,order_id,checkout_reference,amount,idempotency_key,metadata)
    values(v_credit.id,v_credit.campaign_id,_customer_id,_order_id,_checkout_reference,v_take,_idempotency_key,coalesce(_metadata,'{}'::jsonb));
    insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,metadata)
    values(v_credit.id,v_credit.campaign_id,_customer_id,'RESERVE',v_take,v_before,v_after,case when _order_id is not null then 'ORDER' else 'CHECKOUT' end,coalesce(_order_id::text,_checkout_reference),_idempotency_key||':reserve:'||v_credit.id::text,coalesce(_metadata,'{}'::jsonb));
    v_remaining:=v_remaining-v_take; v_reserved:=v_reserved+v_take;
  end loop;
  if v_remaining>0 then raise exception 'INSUFFICIENT_BALANCE'; end if;
  return jsonb_build_object('ok',true,'replayed',false,'reserved_amount',v_reserved,'idempotency_key',_idempotency_key);
end; $$;

create or replace function public.benefits_release(_idempotency_key text,_reason text default null,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_res record; v_count integer:=0; v_amount numeric(12,2):=0; v_any boolean:=false; v_credit public.customer_benefit_credits%rowtype; v_before numeric(12,2); v_after numeric(12,2);
begin
  for v_res in select * from public.benefit_reservations where idempotency_key=_idempotency_key order by reserved_at for update loop
    v_any:=true;
    if v_res.status='REDEEMED' then raise exception 'RESERVATION_ALREADY_REDEEMED'; end if;
    if v_res.status in ('RELEASED','EXPIRED') then v_amount:=v_amount+v_res.amount; continue; end if;
    select * into v_credit from public.customer_benefit_credits where id=v_res.credit_id for update; v_before:=v_credit.available_amount;
    if v_credit.expires_at<=now() then
      update public.customer_benefit_credits set reserved_amount=reserved_amount-v_res.amount,expired_amount=expired_amount+v_res.amount,status=case when available_amount=0 and reserved_amount-v_res.amount=0 and redeemed_amount=0 then 'EXPIRED' else 'PARTIALLY_USED' end,updated_at=now() where id=v_credit.id;
      update public.benefit_reservations set status='EXPIRED',released_at=now() where id=v_res.id;
      insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason,metadata)
      values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'EXPIRE',v_res.amount,v_before,v_before,'RESERVATION',v_res.id::text,_idempotency_key||':expire:'||v_res.id::text,_reason,coalesce(_metadata,'{}'::jsonb));
    else
      v_after:=v_before+v_res.amount;
      update public.customer_benefit_credits set reserved_amount=reserved_amount-v_res.amount,available_amount=available_amount+v_res.amount,status='AVAILABLE',updated_at=now() where id=v_credit.id;
      update public.benefit_reservations set status='RELEASED',released_at=now() where id=v_res.id;
      insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason,metadata)
      values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'RELEASE',v_res.amount,v_before,v_after,'RESERVATION',v_res.id::text,_idempotency_key||':release:'||v_res.id::text,_reason,coalesce(_metadata,'{}'::jsonb));
    end if;
    v_count:=v_count+1; v_amount:=v_amount+v_res.amount;
  end loop;
  if not v_any then raise exception 'RESERVATION_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true,'processed',v_count,'amount',v_amount,'idempotency_key',_idempotency_key);
end; $$;

create or replace function public.benefits_redeem(_idempotency_key text,_reason text default null,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_res record; v_count integer:=0; v_amount numeric(12,2):=0; v_any boolean:=false; v_credit public.customer_benefit_credits%rowtype;
begin
  for v_res in select * from public.benefit_reservations where idempotency_key=_idempotency_key order by reserved_at for update loop
    v_any:=true;
    if v_res.status='REDEEMED' then v_amount:=v_amount+v_res.amount; continue; end if;
    if v_res.status in ('RELEASED','EXPIRED') then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
    select * into v_credit from public.customer_benefit_credits where id=v_res.credit_id for update;
    update public.customer_benefit_credits set reserved_amount=reserved_amount-v_res.amount,redeemed_amount=redeemed_amount+v_res.amount,status=case when available_amount=0 and reserved_amount-v_res.amount=0 then 'USED' else 'PARTIALLY_USED' end,updated_at=now() where id=v_credit.id;
    update public.benefit_reservations set status='REDEEMED',redeemed_at=now() where id=v_res.id;
    insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason,metadata)
    values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'REDEEM',v_res.amount,v_credit.available_amount,v_credit.available_amount,'RESERVATION',v_res.id::text,_idempotency_key||':redeem:'||v_res.id::text,_reason,coalesce(_metadata,'{}'::jsonb));
    update public.benefit_campaigns set budget_redeemed=budget_redeemed+v_res.amount,updated_at=now() where id=v_credit.campaign_id;
    v_count:=v_count+1; v_amount:=v_amount+v_res.amount;
  end loop;
  if not v_any then raise exception 'RESERVATION_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true,'processed',v_count,'amount',v_amount,'idempotency_key',_idempotency_key);
end; $$;

create or replace function public.benefits_reverse(_credit_id uuid,_amount numeric,_reference_type text,_reference_id text,_idempotency_key text,_reason text default null,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_credit public.customer_benefit_credits%rowtype; v_existing public.benefit_credit_ledger%rowtype; v_before numeric(12,2); v_after numeric(12,2);
begin
  if _amount is null or _amount<=0 then raise exception 'INVALID_REVERSE_AMOUNT'; end if;
  if nullif(trim(_idempotency_key),'') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  select * into v_existing from public.benefit_credit_ledger where idempotency_key=_idempotency_key;
  if found then
    if v_existing.credit_id<>_credit_id or v_existing.amount<>round(_amount::numeric,2) or v_existing.transaction_type<>'REVERSE' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'replayed',true,'credit_id',_credit_id,'amount',v_existing.amount);
  end if;
  select * into v_credit from public.customer_benefit_credits where id=_credit_id for update; if not found then raise exception 'CREDIT_NOT_FOUND'; end if;
  if round(_amount::numeric,2)>v_credit.redeemed_amount then raise exception 'REVERSE_EXCEEDS_REDEEMED'; end if;
  v_before:=v_credit.available_amount;
  if v_credit.expires_at>now() then
    v_after:=v_before+round(_amount::numeric,2);
    update public.customer_benefit_credits set redeemed_amount=redeemed_amount-round(_amount::numeric,2),reversed_amount=reversed_amount+round(_amount::numeric,2),available_amount=available_amount+round(_amount::numeric,2),status='AVAILABLE',updated_at=now() where id=_credit_id;
  else
    v_after:=v_before;
    update public.customer_benefit_credits set redeemed_amount=redeemed_amount-round(_amount::numeric,2),reversed_amount=reversed_amount+round(_amount::numeric,2),expired_amount=expired_amount+round(_amount::numeric,2),status=case when available_amount=0 and reserved_amount=0 and redeemed_amount-round(_amount::numeric,2)=0 then 'EXPIRED' else 'PARTIALLY_USED' end,updated_at=now() where id=_credit_id;
  end if;
  insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason,metadata)
  values(_credit_id,v_credit.campaign_id,v_credit.customer_id,'REVERSE',round(_amount::numeric,2),v_before,v_after,_reference_type,_reference_id,_idempotency_key,_reason,coalesce(_metadata,'{}'::jsonb));
  update public.benefit_campaigns set budget_redeemed=greatest(0,budget_redeemed-round(_amount::numeric,2)),updated_at=now() where id=v_credit.campaign_id;
  return jsonb_build_object('ok',true,'replayed',false,'credit_id',_credit_id,'amount',round(_amount::numeric,2),'available',v_after);
end; $$;

create or replace function public.benefits_release_expired()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_res record; v_credit public.customer_benefit_credits%rowtype; v_count integer:=0; v_before numeric(12,2);
begin
  for v_res in select * from public.benefit_reservations where status='ACTIVE' and expires_at<=now() order by expires_at for update skip locked loop
    select * into v_credit from public.customer_benefit_credits where id=v_res.credit_id for update; v_before:=v_credit.available_amount;
    if v_credit.expires_at<=now() then
      update public.customer_benefit_credits set reserved_amount=reserved_amount-v_res.amount,expired_amount=expired_amount+v_res.amount,status=case when available_amount=0 and reserved_amount-v_res.amount=0 and redeemed_amount=0 then 'EXPIRED' else 'PARTIALLY_USED' end,updated_at=now() where id=v_credit.id;
      insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason)
      values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'EXPIRE',v_res.amount,v_before,v_before,'RESERVATION',v_res.id::text,'expire:reservation:'||v_res.id::text,'reservation_ttl_and_credit_expired') on conflict(idempotency_key) do nothing;
      update public.benefit_reservations set status='EXPIRED',released_at=now() where id=v_res.id;
    else
      update public.customer_benefit_credits set reserved_amount=reserved_amount-v_res.amount,available_amount=available_amount+v_res.amount,status='AVAILABLE',updated_at=now() where id=v_credit.id;
      insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason)
      values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'RELEASE',v_res.amount,v_before,v_before+v_res.amount,'RESERVATION',v_res.id::text,'release:expired-reservation:'||v_res.id::text,'reservation_ttl_expired') on conflict(idempotency_key) do nothing;
      update public.benefit_reservations set status='EXPIRED',released_at=now() where id=v_res.id;
    end if; v_count:=v_count+1;
  end loop;
  for v_credit in select * from public.customer_benefit_credits where expires_at<=now() and available_amount>0 order by expires_at for update skip locked loop
    v_before:=v_credit.available_amount;
    update public.customer_benefit_credits set expired_amount=expired_amount+available_amount,available_amount=0,status=case when reserved_amount=0 and redeemed_amount=0 then 'EXPIRED' else 'PARTIALLY_USED' end,updated_at=now() where id=v_credit.id;
    insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason)
    values(v_credit.id,v_credit.campaign_id,v_credit.customer_id,'EXPIRE',v_before,v_before,0,'CREDIT',v_credit.id::text,'expire:credit:'||v_credit.id::text,'credit_expired') on conflict(idempotency_key) do nothing;
    v_count:=v_count+1;
  end loop; return v_count;
end; $$;

revoke all on function public.benefits_reserve(uuid,numeric,numeric,text,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.benefits_release(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.benefits_redeem(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.benefits_reverse(uuid,numeric,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.benefits_release_expired() from public,anon,authenticated;
grant execute on function public.benefits_reserve(uuid,numeric,numeric,text,uuid,text,jsonb) to service_role;
grant execute on function public.benefits_release(text,text,jsonb) to service_role;
grant execute on function public.benefits_redeem(text,text,jsonb) to service_role;
grant execute on function public.benefits_reverse(uuid,numeric,text,text,text,text,jsonb) to service_role;
grant execute on function public.benefits_release_expired() to service_role;
