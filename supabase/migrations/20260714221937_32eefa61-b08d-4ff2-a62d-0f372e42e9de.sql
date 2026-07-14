UPDATE public.orders SET payment_method = 'pix' WHERE payment_method ILIKE 'pix';
UPDATE public.orders SET payment_method = 'card_on_delivery' WHERE payment_method ILIKE 'cart%o na entrega' OR payment_method ILIKE 'cartao na entrega';
UPDATE public.orders SET payment_method = 'credit_card' WHERE payment_method IN ('credit','debit','debit_card');
UPDATE public.orders SET payment_method = 'cash' WHERE payment_method ILIKE 'dinheiro' OR payment_method ILIKE 'esp%cie';
UPDATE public.orders SET payment_method = 'meal_voucher' WHERE payment_method ILIKE 'vale%' OR payment_method IN ('vr','va','food_voucher');