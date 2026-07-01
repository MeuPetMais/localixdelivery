
DROP POLICY IF EXISTS "Customers can review their delivered orders" ON public.reviews;

CREATE POLICY "Customers can review their delivered orders"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id
      AND o.restaurant_id = reviews.restaurant_id
      AND o.status = 'entregue'
      AND o.customer_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.reviews r2 WHERE r2.order_id = reviews.order_id
  )
);
