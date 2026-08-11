-- Template manual para criar o restaurante piloto Mercado Pago em staging.
-- Execute somente no banco de staging. Nao execute em producao.
-- Substitua os placeholders antes de rodar:
--   <OWNER_AUTH_USER_ID>
--   <SERVICE_FEE_PAYER> -- customer ou restaurant

DO $$
DECLARE
  v_owner_id uuid := '<OWNER_AUTH_USER_ID>';
  v_restaurant_id uuid;
  v_category_id uuid;
BEGIN
  IF current_setting('app.environment', true) IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'Set app.environment=staging before running Mercado Pago staging seed';
  END IF;

  INSERT INTO public.restaurants (
    owner_id,
    name,
    slug,
    description,
    whatsapp_phone,
    delivery_fee,
    min_order,
    is_open
  )
  VALUES (
    v_owner_id,
    'Localix MP Staging Pilot',
    'localix-mp-staging-pilot',
    'Restaurante de teste exclusivo para validacao Mercado Pago staging.',
    '11999999999',
    5.00,
    0.00,
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    whatsapp_phone = EXCLUDED.whatsapp_phone,
    delivery_fee = EXCLUDED.delivery_fee,
    min_order = EXCLUDED.min_order,
    is_open = EXCLUDED.is_open,
    updated_at = now()
  RETURNING id INTO v_restaurant_id;

  INSERT INTO public.tenant_payment_settings (
    restaurant_id,
    accept_pix,
    accept_credit,
    accept_cash,
    accept_voucher,
    default_gateway,
    delivery_fee,
    minimum_order,
    payment_timeout_minutes,
    service_fee_payer
  )
  VALUES (
    v_restaurant_id,
    true,
    true,
    false,
    false,
    'mercado_pago',
    5.00,
    0.00,
    30,
    '<SERVICE_FEE_PAYER>'
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    accept_pix = EXCLUDED.accept_pix,
    accept_credit = EXCLUDED.accept_credit,
    accept_cash = EXCLUDED.accept_cash,
    accept_voucher = EXCLUDED.accept_voucher,
    default_gateway = EXCLUDED.default_gateway,
    delivery_fee = EXCLUDED.delivery_fee,
    minimum_order = EXCLUDED.minimum_order,
    payment_timeout_minutes = EXCLUDED.payment_timeout_minutes,
    service_fee_payer = EXCLUDED.service_fee_payer,
    updated_at = now();

  INSERT INTO public.menu_categories (restaurant_id, name, position)
  VALUES (v_restaurant_id, 'Teste Mercado Pago', 1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_category_id;

  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id
    FROM public.menu_categories
    WHERE restaurant_id = v_restaurant_id
      AND name = 'Teste Mercado Pago'
    LIMIT 1;
  END IF;

  INSERT INTO public.menu_items (
    restaurant_id,
    category_id,
    name,
    description,
    price,
    is_available,
    position
  )
  VALUES (
    v_restaurant_id,
    v_category_id,
    'Produto MP Teste',
    'Item barato para validacao financeira controlada.',
    3.50,
    true,
    1
  )
  ON CONFLICT DO NOTHING;
END $$;
