-- Remove anon INSERT policy on orders; orders are now created exclusively via
-- the server function which validates coupon and computes discount server-side.
DROP POLICY IF EXISTS "Place order in an open restaurant" ON public.orders;