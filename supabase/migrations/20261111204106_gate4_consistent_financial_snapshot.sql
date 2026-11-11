-- REVIEW ONLY: not applied to any hosted database by this audit.
-- One SQL statement / MVCC snapshot; scalar JSON is not a PostgREST rowset.
-- SECURITY INVOKER preserves the existing owner/admin SELECT policies.
CREATE FUNCTION public.get_restaurant_financial_snapshot(_restaurant_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
 WITH scoped AS MATERIALIZED (
   SELECT l.* FROM public.financial_ledger l
   WHERE l.restaurant_id = _restaurant_id AND auth.uid() IS NOT NULL
   ORDER BY l.created_at DESC, l.id DESC
   LIMIT 50001
 ), collected AS (
   SELECT count(*) AS row_count,
          jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) AS entries
   FROM scoped s
 )
 SELECT jsonb_build_object(
   'version',1,'restaurant_id',_restaurant_id,'snapshot_at',statement_timestamp(),
   'row_count',row_count,'complete',row_count <= 50000,
   'entries',CASE WHEN row_count <= 50000 THEN coalesce(entries,'[]'::jsonb) ELSE '[]'::jsonb END
 ) FROM collected;
$$;
REVOKE ALL ON FUNCTION public.get_restaurant_financial_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_financial_snapshot(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_restaurant_financial_snapshot(uuid) IS
 'Read-only RLS-scoped snapshot; rejects partial aggregation through explicit completeness metadata. Not a bank balance.';
