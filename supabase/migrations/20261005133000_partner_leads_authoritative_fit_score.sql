create or replace function private.apply_partner_lead_fit_score()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_score integer := 0;
begin
  v_score :=
    case
      when new.estimated_monthly_orders is null or new.estimated_monthly_orders < 150 then 0
      when new.estimated_monthly_orders < 250 then 5
      when new.estimated_monthly_orders < 350 then 10
      when new.estimated_monthly_orders < 450 then 15
      when new.estimated_monthly_orders < 600 then 20
      else 25
    end
    + case when new.is_decision_maker is true then 15 else 0 end
    + case when new.has_own_customer_base is true then 15 else 0 end
    + case when new.has_recurring_customers is true then 15 else 0 end
    + case when new.interested_in_own_channel is true then 10 else 0 end
    + case when new.has_structured_operation is true then 10 else 0 end
    + case when new.has_active_marketing is true then 5 else 0 end
    + case when new.committed_to_promotion is true then 5 else 0 end;

  new.fit_score := v_score;
  new.lead_class :=
    case
      when v_score >= 70 then 'A'
      when v_score >= 50 then 'B'
      else 'C'
    end;

  return new;
end;
$function$;

drop trigger if exists trg_partner_leads_apply_fit_score on public.partner_leads;

create trigger trg_partner_leads_apply_fit_score
before insert or update on public.partner_leads
for each row
execute function private.apply_partner_lead_fit_score();

-- Backfill all existing leads so persisted score/class immediately obey the new authority.
update public.partner_leads
set fit_score = fit_score;
