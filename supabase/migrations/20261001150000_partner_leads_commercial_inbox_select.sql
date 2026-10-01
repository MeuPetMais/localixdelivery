create policy "partner leads commercial unassigned inbox select"
on public.partner_leads
for select
to authenticated
using (
  assigned_to is null
  and restaurant_id is null
  and converted_at is null
  and status not in ('converted','lost','disqualified')
  and private.has_role((select auth.uid()), 'comercial'::app_role)
);
