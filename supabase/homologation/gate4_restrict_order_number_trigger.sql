-- Gate4 isolated homologation: trigger function must not be a public RPC.
REVOKE EXECUTE ON FUNCTION public.assign_order_number() FROM PUBLIC,anon,authenticated;
