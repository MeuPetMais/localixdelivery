
DO $$
DECLARE
  v_user_id uuid;
  v_restaurant_id uuid;
  v_cat_pizza uuid;
  v_cat_burger uuid;
  v_cat_bebida uuid;
  v_cat_combo uuid;
  v_item_marg uuid;
  v_item_calab uuid;
  v_item_burger uuid;
  v_item_xsalada uuid;
  v_item_coke uuid;
  v_item_combo uuid;
  v_builder_id uuid;
  v_grp_size uuid;
  v_grp_flavor uuid;
  v_grp_extra uuid;
  v_cust1 uuid;
  v_cust2 uuid;
  v_cust3 uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@localix.app';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, created_at, updated_at, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', 'demo@localix.app',
      crypt('Demo@2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Localix Demo","owner_name":"Localix Demo","store_name":"Localix Demo","is_demo":true}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'demo@localix.app', 'email_verified', true),
      'email', v_user_id::text, now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('Demo@2026', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  SELECT id INTO v_restaurant_id FROM public.restaurants WHERE slug = 'demo';

  IF v_restaurant_id IS NULL THEN
    v_restaurant_id := gen_random_uuid();
    INSERT INTO public.restaurants (
      id, owner_id, name, slug, description, whatsapp_phone, owner_name,
      delivery_fee, min_order, is_open, active, primary_color, delivery_time,
      category, city, state, neighborhood, address, address_number,
      avg_delivery_minutes, avg_pickup_minutes, builders_enabled,
      payment_methods, opening_hours, email
    ) VALUES (
      v_restaurant_id, v_user_id, 'Localix Demo', 'demo',
      'Conta de demonstração — pedidos não são enviados ao WhatsApp.',
      '+5500000000000', 'Localix Demo',
      6.90, 20.00, true, true, 'orange', '30-45 min',
      'Variado', 'São Paulo', 'SP', 'Centro', 'Av. Demonstração', '100',
      40, 15, true,
      '{"pix": true, "cash": true, "credit": true, "debit": true}'::jsonb,
      '{"mon":{"open":"11:00","close":"23:00"},"tue":{"open":"11:00","close":"23:00"},"wed":{"open":"11:00","close":"23:00"},"thu":{"open":"11:00","close":"23:00"},"fri":{"open":"11:00","close":"00:00"},"sat":{"open":"11:00","close":"00:00"},"sun":{"open":"11:00","close":"23:00"}}'::jsonb,
      'demo@localix.app'
    );
  ELSE
    UPDATE public.restaurants
       SET owner_id = v_user_id, is_open = true, active = true,
           builders_enabled = true, updated_at = now()
     WHERE id = v_restaurant_id;
  END IF;

  DELETE FROM public.reviews WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.orders WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.customers WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.coupons WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.builders WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.menu_items WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.menu_categories WHERE restaurant_id = v_restaurant_id;

  v_cat_pizza := gen_random_uuid();
  v_cat_burger := gen_random_uuid();
  v_cat_bebida := gen_random_uuid();
  v_cat_combo := gen_random_uuid();
  INSERT INTO public.menu_categories (id, restaurant_id, name, position) VALUES
    (v_cat_pizza,  v_restaurant_id, 'Pizzas',   1),
    (v_cat_burger, v_restaurant_id, 'Burgers',  2),
    (v_cat_combo,  v_restaurant_id, 'Combos',   3),
    (v_cat_bebida, v_restaurant_id, 'Bebidas',  4);

  v_item_marg    := gen_random_uuid();
  v_item_calab   := gen_random_uuid();
  v_item_burger  := gen_random_uuid();
  v_item_xsalada := gen_random_uuid();
  v_item_coke    := gen_random_uuid();
  v_item_combo   := gen_random_uuid();

  INSERT INTO public.menu_items
    (id, restaurant_id, category_id, name, description, price, promo_price,
     promo_starts_at, promo_ends_at, promo_campaign,
     is_featured, is_bestseller, is_available, position)
  VALUES
    (v_item_marg,    v_restaurant_id, v_cat_pizza,  'Pizza Margherita',  'Molho, muçarela e manjericão fresco.', 49.90, 39.90,
       now() - interval '1 day', now() + interval '14 days', 'Promo da Semana', true, true, true, 1),
    (v_item_calab,   v_restaurant_id, v_cat_pizza,  'Pizza Calabresa',   'Calabresa, cebola e azeitona.',        52.90, NULL, NULL, NULL, NULL, false, true, true, 2),
    (v_item_burger,  v_restaurant_id, v_cat_burger, 'Localix Burger',    'Smash duplo, cheddar e bacon.',        34.90, 29.90,
       now() - interval '1 day', now() + interval '7 days', 'Happy Hour', true, false, true, 1),
    (v_item_xsalada, v_restaurant_id, v_cat_burger, 'X-Salada',          'Burger artesanal com salada fresca.',  26.90, NULL, NULL, NULL, NULL, false, false, true, 2),
    (v_item_coke,    v_restaurant_id, v_cat_bebida, 'Coca-Cola 350ml',   'Lata gelada.',                          7.00, NULL, NULL, NULL, NULL, false, false, true, 1),
    (v_item_combo,   v_restaurant_id, v_cat_combo,  'Combo Família',     '2 pizzas grandes + refri 2L.',         89.90, 79.90,
       now() - interval '1 day', now() + interval '30 days', 'Combo da Casa', true, true, true, 1);

  v_builder_id := gen_random_uuid();
  INSERT INTO public.builders (id, restaurant_id, name, emoji, description, base_price, is_active, position)
  VALUES (v_builder_id, v_restaurant_id, 'Monte sua Pizza', '🍕', 'Escolha tamanho, sabores e adicionais.', 35.00, true, 1);

  v_grp_size   := gen_random_uuid();
  v_grp_flavor := gen_random_uuid();
  v_grp_extra  := gen_random_uuid();
  INSERT INTO public.builder_groups (id, builder_id, name, min_select, max_select, is_required, position) VALUES
    (v_grp_size,   v_builder_id, 'Tamanho',    1, 1, true,  1),
    (v_grp_flavor, v_builder_id, 'Sabores',    1, 2, true,  2),
    (v_grp_extra,  v_builder_id, 'Adicionais', 0, 4, false, 3);

  INSERT INTO public.builder_options (group_id, name, price_delta, max_qty, position) VALUES
    (v_grp_size,   'Média',     0,    1, 1),
    (v_grp_size,   'Grande',    10,   1, 2),
    (v_grp_size,   'Família',   20,   1, 3),
    (v_grp_flavor, 'Margherita', 0,   1, 1),
    (v_grp_flavor, 'Calabresa',  0,   1, 2),
    (v_grp_flavor, 'Quatro Queijos', 5, 1, 3),
    (v_grp_flavor, 'Portuguesa', 3,   1, 4),
    (v_grp_extra,  'Borda recheada', 8, 1, 1),
    (v_grp_extra,  'Bacon extra',    5, 2, 2),
    (v_grp_extra,  'Catupiry',       4, 2, 3);

  INSERT INTO public.coupons (restaurant_id, code, discount_percent, valid_until, is_active) VALUES
    (v_restaurant_id, 'BEMVINDO10', 10, (now() + interval '90 days')::date, true),
    (v_restaurant_id, 'LOCALIX20',  20, (now() + interval '30 days')::date, true),
    (v_restaurant_id, 'DEMOFREE',   15, (now() + interval '180 days')::date, true);

  v_cust1 := gen_random_uuid();
  v_cust2 := gen_random_uuid();
  v_cust3 := gen_random_uuid();
  INSERT INTO public.customers (id, restaurant_id, name, phone, email, total_orders, total_spent, avg_ticket, last_order_at) VALUES
    (v_cust1, v_restaurant_id, 'Cliente Demo Ana',    '+5511900000001', 'ana@demo.local',    8, 412.00, 51.50, now() - interval '2 day'),
    (v_cust2, v_restaurant_id, 'Cliente Demo Bruno',  '+5511900000002', 'bruno@demo.local',  5, 210.00, 42.00, now() - interval '5 day'),
    (v_cust3, v_restaurant_id, 'Cliente Demo Carla',  '+5511900000003', 'carla@demo.local',  3, 138.00, 46.00, now() - interval '12 day');

  INSERT INTO public.customer_points (customer_id, balance, total_earned) VALUES
    (v_cust1, 412, 800),
    (v_cust2, 210, 350),
    (v_cust3, 138, 138)
  ON CONFLICT (customer_id) DO UPDATE SET balance = EXCLUDED.balance, total_earned = EXCLUDED.total_earned;

  INSERT INTO public.orders (restaurant_id, customer_name, customer_phone, address, payment_method, items, total, status, created_at)
  VALUES
    (v_restaurant_id, 'Cliente Demo Ana',   '+5511900000001', 'Rua Demo, 10', 'pix',
      jsonb_build_array(
        jsonb_build_object('id', v_item_marg::text, 'name','Pizza Margherita','qty',1,'price',39.90),
        jsonb_build_object('id', v_item_coke::text, 'name','Coca-Cola 350ml','qty',2,'price',7.00)
      ),
      53.90, 'entregue', now() - interval '2 day'),
    (v_restaurant_id, 'Cliente Demo Bruno', '+5511900000002', 'Av. Teste, 200', 'credit',
      jsonb_build_array(jsonb_build_object('id', v_item_burger::text,'name','Localix Burger','qty',2,'price',29.90)),
      59.80, 'entregue', now() - interval '5 day'),
    (v_restaurant_id, 'Cliente Demo Carla', '+5511900000003', 'Rua Sample, 55', 'pix',
      jsonb_build_array(jsonb_build_object('id', v_item_combo::text,'name','Combo Família','qty',1,'price',79.90)),
      79.90, 'entregue', now() - interval '8 day'),
    (v_restaurant_id, 'Cliente Demo Ana',   '+5511900000001', 'Rua Demo, 10', 'pix',
      jsonb_build_array(jsonb_build_object('id', v_item_calab::text,'name','Pizza Calabresa','qty',1,'price',52.90)),
      52.90, 'em_preparo', now() - interval '20 minutes'),
    (v_restaurant_id, 'Cliente Demo Bruno', '+5511900000002', 'Av. Teste, 200', 'cash',
      jsonb_build_array(jsonb_build_object('id', v_item_xsalada::text,'name','X-Salada','qty',1,'price',26.90)),
      26.90, 'saiu_para_entrega', now() - interval '40 minutes'),
    (v_restaurant_id, 'Cliente Demo Carla', '+5511900000003', 'Rua Sample, 55', 'pix',
      jsonb_build_array(jsonb_build_object('id', v_item_marg::text,'name','Pizza Margherita','qty',1,'price',39.90)),
      39.90, 'novo', now() - interval '5 minutes');

  INSERT INTO public.reviews (restaurant_id, order_id, customer_name, rating, comment, created_at)
  SELECT v_restaurant_id, o.id, o.customer_name,
         (ARRAY[5,5,4,5,4,5])[((row_number() OVER (ORDER BY o.created_at))::int)],
         (ARRAY[
           'Pizza incrível, chegou quentinha!',
           'Atendimento nota 10.',
           'Burger maravilhoso, voltarei sempre.',
           'Combo família vale muito a pena.',
           'Entrega rápida, recomendo.',
           'Excelente experiência.'
         ])[((row_number() OVER (ORDER BY o.created_at))::int)],
         o.created_at + interval '1 hour'
    FROM public.orders o
   WHERE o.restaurant_id = v_restaurant_id AND o.status = 'entregue';
END $$;
