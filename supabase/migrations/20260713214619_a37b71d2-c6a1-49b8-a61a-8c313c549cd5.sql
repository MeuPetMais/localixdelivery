
WITH candidates AS (
  SELECT o.id AS order_id, u.id AS user_id,
         row_number() OVER (PARTITION BY o.id ORDER BY u.created_at) AS rn
    FROM public.orders o
    JOIN auth.users u
      ON o.customer_phone IS NOT NULL
     AND regexp_replace(o.customer_phone,'\D','','g') <> ''
     AND regexp_replace(coalesce(u.phone,''),'\D','','g') = regexp_replace(o.customer_phone,'\D','','g')
   WHERE o.customer_id IS NULL
)
UPDATE public.orders o
   SET customer_id = c.user_id
  FROM candidates c
 WHERE c.order_id = o.id AND c.rn = 1;
