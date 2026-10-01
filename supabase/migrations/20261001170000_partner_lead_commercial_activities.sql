create table public.partner_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.partner_leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('note','contact','demo','follow_up')),
  note text not null check (length(btrim(note)) between 1 and 2000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);

create index partner_lead_activities_lead_created_idx
  on public.partner_lead_activities (lead_id, created_at desc);

alter table public.partner_lead_activities enable row level security;

grant select, insert on public.partner_lead_activities to authenticated;

create policy "partner lead activities admin select"
on public.partner_lead_activities
for select to authenticated
using (private.has_role((select auth.uid()), 'admin'::app_role));

create policy "partner lead activities admin insert"
on public.partner_lead_activities
for insert to authenticated
with check (private.has_role((select auth.uid()), 'admin'::app_role));

create policy "partner lead activities commercial assigned select"
on public.partner_lead_activities
for select to authenticated
using (
  exists (
    select 1 from public.partner_leads l
    where l.id = lead_id
      and l.assigned_to = (select auth.uid())
      and private.has_role((select auth.uid()), 'comercial'::app_role)
  )
);

create policy "partner lead activities commercial own insert"
on public.partner_lead_activities
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.partner_leads l
    where l.id = lead_id
      and l.assigned_to = (select auth.uid())
      and l.status not in ('converted','lost','disqualified')
      and private.has_role((select auth.uid()), 'comercial'::app_role)
  )
);
