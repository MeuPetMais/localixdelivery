-- RW-1.2 — Automatic clawback must return the cycle to IN_PROGRESS.
-- Credits already reserved/redeemed remain REVIEW_REQUIRED + CLAWBACK_PENDING.

create or replace function public.rewards_reverse_order(_order_id uuid, _reason text default 'ORDER_REVERSED', _metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_event public.reward_progress_events%rowtype;
  v_progress public.customer_reward_progress%rowtype;
  v_credit public.customer_benefit_credits%rowtype;
  v_rev jsonb;
  v_count int:=0;
  v_pending int:=0;
begin
  select * into v_order from public.orders where id=_order_id for share;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('reembolsado','chargeback','cancelado') then raise exception 'ORDER_NOT_REVERSIBLE'; end if;

  for v_event in
    select * from public.reward_progress_events e
    where e.order_id=_order_id and e.event_type='ORDER_QUALIFIED'
    order by occurred_at,id for share
  loop
    if exists(
      select 1 from public.reward_progress_events
      where idempotency_key='reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed'
    ) then continue; end if;

    select * into v_progress from public.customer_reward_progress where id=v_event.progress_id for update;

    if v_progress.status='REWARDED' and v_progress.reward_credit_id is not null then
      select * into v_credit from public.customer_benefit_credits where id=v_progress.reward_credit_id for update;
      begin
        v_rev:=public.benefits_revoke_unspent_grant(
          v_credit.id,'REWARD_ORDER_REVERSAL',_order_id::text,
          'reward:'||v_event.program_id::text||':order:'||_order_id::text||':credit-revoke',
          _reason,_metadata
        );

        update public.customer_reward_progress
        set qualified_orders=greatest(0,qualified_orders-1),
            status='IN_PROGRESS',
            goal_reached_at=null,
            reward_granted_at=null,
            reward_credit_id=null,
            updated_at=now()
        where id=v_progress.id;

        insert into public.reward_progress_events(
          program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata
        ) values(
          v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'REWARD_REVERSED',
          'reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',
          jsonb_build_object('benefit_credit_id',v_credit.id)||coalesce(_metadata,'{}')
        );
        v_count:=v_count+1;
      exception when others then
        if sqlerrm='CREDIT_ALREADY_IN_USE' or sqlerrm='NO_UNSPENT_CREDIT' then
          update public.customer_reward_progress
          set qualified_orders=greatest(0,qualified_orders-1),status='REVIEW_REQUIRED',updated_at=now()
          where id=v_progress.id;

          insert into public.reward_progress_events(
            program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata
          ) values(
            v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'CLAWBACK_PENDING',
            'reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',
            jsonb_build_object('benefit_credit_id',v_credit.id,'reason',sqlerrm)||coalesce(_metadata,'{}')
          );
          v_pending:=v_pending+1;
        else
          raise;
        end if;
      end;
    else
      update public.customer_reward_progress
      set qualified_orders=greatest(0,qualified_orders-1),
          status=case when status='GOAL_REACHED' then 'REVIEW_REQUIRED' else status end,
          updated_at=now()
      where id=v_progress.id;

      insert into public.reward_progress_events(
        program_id,progress_id,customer_id,order_id,cycle,event_type,idempotency_key,metadata
      ) values(
        v_event.program_id,v_progress.id,v_event.customer_id,_order_id,v_event.cycle,'ORDER_REVERSED',
        'reward:'||v_event.program_id::text||':order:'||_order_id::text||':reversed',coalesce(_metadata,'{}')
      );
      v_count:=v_count+1;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'order_id',_order_id,'reversed',v_count,'clawback_pending',v_pending);
end;
$$;

revoke all on function public.rewards_reverse_order(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.rewards_reverse_order(uuid,text,jsonb) to service_role;