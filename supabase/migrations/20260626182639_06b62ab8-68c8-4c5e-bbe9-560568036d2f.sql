
DROP POLICY IF EXISTS "Customers can review delivered orders" ON public.reviews;

CREATE POLICY "Customers can review delivered orders"
  ON public.reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.restaurant_id = reviews.restaurant_id
        AND o.status = 'entregue'
    )
  );
