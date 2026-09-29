-- Commercial acquisition: allow authenticated callers to resolve the private capture RPC.
-- Required because public.create_partner_lead_manual is SECURITY INVOKER and delegates
-- authorization/write semantics to private.create_partner_lead_manual (SECURITY DEFINER).
-- Keep anonymous callers blocked from the private schema and from both RPCs.

grant usage on schema private to authenticated;
revoke usage on schema private from anon;

revoke all on function private.create_partner_lead_manual(
  text,text,text,text,text,text,integer,text[],text,boolean,
  text,text,text,text,text,text,text,text,text,text,text,text
) from public, anon;

grant execute on function private.create_partner_lead_manual(
  text,text,text,text,text,text,integer,text[],text,boolean,
  text,text,text,text,text,text,text,text,text,text,text,text
) to authenticated;
