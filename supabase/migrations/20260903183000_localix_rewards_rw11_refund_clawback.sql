-- RW-1.1 — Refund/chargeback clawback for Localix Rewards
alter table public.customer_benefit_credits add column if not exists revoked_amount numeric(12,2) not null default 0 check (revoked_amount >= 0);
alter table public.customer_benefit_credits drop constraint if exists customer_benefit_credit_conservation_ck;
alter table public.customer_benefit_credits add constraint customer_benefit_credit_conservation_ck check (granted_amount = available_amount + reserved_amount + redeemed_amount + expired_amount + revoked_amount);

alter table public.reward_progress_events drop constraint if exists reward_progress_events_event_type_check;
alter table public.reward_progress_events add constraint reward_progress_events_event_type_check check (event_type = any(array['ORDER_QUALIFIED','ORDER_REVERSED','GOAL_REACHED','REWARD_GRANTED','REWARD_REVERSED','CLAWBACK_PENDING']));

create or replace function public.benefits_revoke_unspent_grant(_credit_id uuid,_reference_type text,_reference_id text,_idempotency_key text,_reason text default null,_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_credit public.customer_benefit_credits%rowtype; v_existing public.benefit_credit_ledger%rowtype;
begin
 if nullif(trim(_idempotency_key),'') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
 select * into v_existing from public.benefit_credit_ledger where idempotency_key=_idempotency_key;
 if found then return jsonb_build_object('ok',true,'replayed',true,'credit_id',_credit_id,'amount',v_existing.amount); end if;
 select * into v_credit from public.customer_benefit_credits where id=_credit_id for update;
 if not found then raise exception 'CREDIT_NOT_FOUND'; end if;
 if v_credit.reserved_amount > 0 or v_credit.redeemed_amount > 0 then raise exception 'CREDIT_ALREADY_IN_USE'; end if;
 if v_credit.available_amount <= 0 then raise exception 'NO_UNSPENT_CREDIT'; end if;
 update public.customer_benefit_credits set revoked_amount=revoked_amount+available_amount,available_amount=0,status='REVERSED',updated_at=now() where id=_credit_id;
 insert into public.benefit_credit_ledger(credit_id,campaign_id,customer_id,transaction_type,amount,balance_before,balance_after,reference_type,reference_id,idempotency_key,reason,metadata)
 values(_credit_id,v_credit.campaign_id,v_credit.customer_id,'REVERSE',v_credit.available_amount,v_credit.available_amount,0,_reference_type,_reference_id,_idempotency_key,_reason,coalesce(_metadata,'{}'::jsonb));
 update public.benefit_campaigns set budget_committed=greatest(0,budget_committed-v_credit.available_amount),updated_at=now() where id=v_credit.campaign_id;
 return jsonb_build_object('ok',true,'replayed',false,'credit_id',_credit_id,'amount',v_credit.available_amount);
end $$;
revoke all on function public.benefits_revoke_unspent_grant(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.benefits_revoke_unspent_grant(uuid,text,text,text,text,jsonb) to service_role;

create or replace function public.rewards_reverse_order(_order_id uuid,_reason text default 'ORDER_REVERSED',_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders%rowtype; v_event public.reward_progress_events%rowtype; v_progress public.customer_reward_progress%rowtype; v_credit public.customer_benefit_credits%rowtype; v_rev jsonb; v_count int:=0; v_pending int:=0;
begin
 select * into v_order from public.orders where id=_order_id for share;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.status not in ('reembolsado','chargeback','cancelado') then raise exception 'ORDER_NOT_REVERSIBLE'; end if;
 for v_event in select * from public.reward_progress_events e where e.order_id=_order_id and e.event_type='ORDER_QUALIFIED' order by occurred_at,id for share loop
   if exists(select 1 from public.reward_progress_events where idempotency_key='reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed') then continue; end if;
   select * into v_progress from public.customer_reward_progress where id=v_event.progress_id for update;
   if v_progress.status='REWARDED' and v_progress.reward_credit_id is not null then
     select * into v_credit from public.customer_benefit_credits where id=v_progress.reward_credit_id for update;
     begin
       v_rev:=public.benefits_revoke_unspent_grant(v_credit.id,'REWARD_ORDER_REVERSAL',_order_id::text,'reward:'||v_event.program_id::text||':order:'||_order_id::text||':credit-revoke',_reason,_metadata);
       update public.customer_reward_progress set qualified_orders=greatest(0,qualified_orders-1),status='REVIEW_REQUIRED',updated_at=now() where id=v_progress.id;
       insert into public.reward_progress_events(program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata) values(v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'REWARD_REVERSED','reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',jsonb_build_object('benefit_credit_id',v_credit.id)||coalesce(_metadata,'{}'));
       v_count:=v_count+1;
     exception when others then
       if sqlerrm='CREDIT_ALREADY_IN_USE' or sqlerrm='NO_UNSPENT_CREDIT' then
         update public.customer_reward_progress set qualified_orders=greatest(0,qualified_orders-1),status='REVIEW_REQUIRED',updated_at=now() where id=v_progress.id;
         insert into public.reward_progress_events(program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata) values(v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'CLAWBACK_PENDING','reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',jsonb_build_object('benefit_credit_id',v_credit.id,'reason',sqlerrm)||coalesce(_metadata,'{}'));
         v_pending:=v_pending+1;
       else raise; end if;
     end;
   else
     update public.customer_reward_progress set qualified_orders=greatest(0,qualified_orders-1),status=case when status='GOAL_REACHED' then 'REVIEW_REQUIRED' else status end,updated_at=now() where id=v_progress.id;
     insert into public.reward_progress_events(program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata) values(v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'ORDER_REVERSED','reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',coalesce(_metadata,'{}'));
     v_count:=v_count+1;
   end if;
 end loop;
 return jsonb_build_object('ok',true,'order_id',_order_id,'reversed',v_count,'clawback_pending',v_pending);
end $$;
revoke all on function public.rewards_reverse_order(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rewards_reverse_order(uuid,text,jsonb) to service_role;
