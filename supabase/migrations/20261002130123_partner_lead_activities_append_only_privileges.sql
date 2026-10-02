-- Keep partner lead commercial history append-only for authenticated users.
-- This mirrors the controlled Production correction applied after PR #57.

revoke update, delete, truncate, references, trigger
on public.partner_lead_activities
from authenticated;

revoke all
on public.partner_lead_activities
from anon;

grant select, insert
on public.partner_lead_activities
to authenticated;
