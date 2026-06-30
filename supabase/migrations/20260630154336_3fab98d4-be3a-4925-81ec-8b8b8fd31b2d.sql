
CREATE OR REPLACE FUNCTION public.seed_demo_marketplace()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sup_emb uuid;
  v_sup_ing uuid;
  v_sup_eq  uuid;
BEGIN
  SELECT id INTO v_sup_emb FROM public.suppliers WHERE name = 'EmbalaSP Distribuidora';
  IF v_sup_emb IS NULL THEN
    INSERT INTO public.suppliers (name, category, phone, email, city, description, active)
    VALUES ('EmbalaSP Distribuidora','Embalagens','+5511933334444','contato@embalasp.demo','São Paulo','Embalagens para delivery — pizzas, burgers e sacolas.',true)
    RETURNING id INTO v_sup_emb;
  END IF;

  SELECT id INTO v_sup_ing FROM public.suppliers WHERE name = 'IngredientesPRO';
  IF v_sup_ing IS NULL THEN
    INSERT INTO public.suppliers (name, category, phone, email, city, description, active)
    VALUES ('IngredientesPRO','Ingredientes','+5511955556666','vendas@ingredientespro.demo','Campinas','Queijos, embutidos e carnes para food service.',true)
    RETURNING id INTO v_sup_ing;
  END IF;

  SELECT id INTO v_sup_eq FROM public.suppliers WHERE name = 'CozinhaTech Equipamentos';
  IF v_sup_eq IS NULL THEN
    INSERT INTO public.suppliers (name, category, phone, email, city, description, active)
    VALUES ('CozinhaTech Equipamentos','Equipamentos','+5511977778888','comercial@cozinhatech.demo','São Paulo','Fornos, chapas e periféricos para operação.',true)
    RETURNING id INTO v_sup_eq;
  END IF;

  -- Embalagens
  INSERT INTO public.supplier_products (supplier_id, name, category, price, unit, image_url)
  SELECT v_sup_emb, x.name, 'Embalagens', x.price, x.unit, x.img
  FROM (VALUES
    ('Caixa para Pizza 35cm (c/100)',        139.90,'cx','https://images.unsplash.com/photo-1593504049359-74330189a345?w=600&auto=format'),
    ('Caixa para Hambúrguer Kraft (c/100)',   79.90,'cx','https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=600&auto=format'),
    ('Sacola Kraft Delivery (c/250)',         89.00,'pct','https://images.unsplash.com/photo-1572441710534-d6a7c7d1a26b?w=600&auto=format'),
    ('Papel Antigordura (c/500)',             49.90,'pct','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format')
  ) AS x(name, price, unit, img)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.supplier_id = v_sup_emb AND sp.name = x.name
  );

  -- Ingredientes
  INSERT INTO public.supplier_products (supplier_id, name, category, price, unit, image_url)
  SELECT v_sup_ing, x.name, 'Ingredientes', x.price, x.unit, x.img
  FROM (VALUES
    ('Muçarela Fatiada 4kg',                   189.90,'kg','https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&auto=format'),
    ('Calabresa Defumada 2kg',                  79.90,'kg','https://images.unsplash.com/photo-1601001435957-74f0958a93c8?w=600&auto=format'),
    ('Molho de Tomate Pronto 4kg',              42.90,'kg','https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&auto=format'),
    ('Hambúrguer Artesanal 150g (c/30)',       129.90,'cx','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format')
  ) AS x(name, price, unit, img)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.supplier_id = v_sup_ing AND sp.name = x.name
  );

  -- Equipamentos
  INSERT INTO public.supplier_products (supplier_id, name, category, price, unit, image_url)
  SELECT v_sup_eq, x.name, 'Equipamentos', x.price, x.unit, x.img
  FROM (VALUES
    ('Forno Industrial Pizza 8 sabores',      4290.00,'un','https://images.unsplash.com/photo-1574966740793-9d4c43e0a86b?w=600&auto=format'),
    ('Chapa para Hambúrguer 80cm',             1890.00,'un','https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format'),
    ('Impressora Térmica 80mm',                 489.00,'un','https://images.unsplash.com/photo-1556740772-1a741367b93e?w=600&auto=format'),
    ('Leitor QR Code USB',                      219.00,'un','https://images.unsplash.com/photo-1556742400-b5b7c5121f6f?w=600&auto=format')
  ) AS x(name, price, unit, img)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.supplier_id = v_sup_eq AND sp.name = x.name
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.reset_demo_environment()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_restaurant_id uuid;
  v_cat_pizza uuid; v_cat_burger uuid; v_cat_bebida uuid; v_cat_combo uuid;
  v_item_marg uuid; v_item_calab uuid; v_item_burger uuid;
  v_item_xsalada uuid; v_item_coke uuid; v_item_combo uuid;
  v_builder_id uuid; v_grp_size uuid; v_grp_flavor uuid; v_grp_extra uuid;
  v_cust1 uuid; v_cust2 uuid; v_cust3 uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@localix.app';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found';
  END IF;

  SELECT id INTO v_restaurant_id FROM public.restaurants WHERE slug = 'demo';
  IF v_restaurant_id IS NULL THEN
    v_restaurant_id := gen_random_uuid();
    INSERT INTO public.restaurants (
      id, owner_id, name, slug, description, whatsapp_phone, owner_name,
      delivery_fee, min_order, is_open, active, primary_color, delivery_time,
      category, city, state, neighborhood, address, address_number,
      avg_delivery_minutes, avg_pickup_minutes, builders_enabled,
      payment_methods, email
    ) VALUES (
      v_restaurant_id, v_user_id, 'Localix Demo', 'demo',
      'Conta de demonstração — pedidos não são enviados ao WhatsApp.',
      '+5500000000000', 'Localix Demo',
      6.90, 20.00, true, true, 'orange', '30-45 min',
      'Variado', 'São Paulo', 'SP', 'Centro', 'Av. Demonstração', '100',
      40, 15, true,
      '{"pix": true, "cash": true, "credit": true, "debit": true}'::jsonb,
      'demo@localix.app'
    );
  ELSE
    UPDATE public.restaurants
      SET owner_id = v_user_id, is_open = true, active = true,
          builders_enabled = true, updated_at = now()
    WHERE id = v_restaurant_id;
  END IF;

  DELETE FROM public.reviews WHERE restaurant_id = v_restaurant_id;
  DELETE FROM public.orders  WHERE restaurant_id = v_restaurant_id;
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
    (v_cat_pizza, v_restaurant_id, 'Pizzas', 1),
    (v_cat_burger, v_restaurant_id, 'Burgers', 2),
    (v_cat_combo, v_restaurant_id, 'Combos', 3),
    (v_cat_bebida, v_restaurant_id, 'Bebidas', 4);

  v_item_marg := gen_random_uuid(); v_item_calab := gen_random_uuid();
  v_item_burger := gen_random_uuid(); v_item_xsalada := gen_random_uuid();
  v_item_coke := gen_random_uuid(); v_item_combo := gen_random_uuid();

  INSERT INTO public.menu_items
    (id, restaurant_id, category_id, name, description, price, promo_price,
     promo_starts_at, promo_ends_at, promo_campaign,
     is_featured, is_bestseller, is_available, position)
  VALUES
    (v_item_marg, v_restaurant_id, v_cat_pizza, 'Pizza Margherita','Molho, muçarela e manjericão fresco.', 49.90, 39.90,
       now() - interval '1 day', now() + interval '14 days', 'Promo da Semana', true, true, true, 1),
    (v_item_calab, v_restaurant_id, v_cat_pizza, 'Pizza Calabresa','Calabresa, cebola e azeitona.', 52.90, NULL,NULL,NULL,NULL,false,true,true,2),
    (v_item_burger, v_restaurant_id, v_cat_burger,'Localix Burger','Smash duplo, cheddar e bacon.',34.90,29.90,
       now() - interval '1 day', now() + interval '7 days', 'Happy Hour', true, false, true, 1),
    (v_item_xsalada,v_restaurant_id, v_cat_burger,'X-Salada','Burger artesanal com salada fresca.',26.90,NULL,NULL,NULL,NULL,false,false,true,2),
    (v_item_coke,   v_restaurant_id, v_cat_bebida,'Coca-Cola 350ml','Lata gelada.',7.00,NULL,NULL,NULL,NULL,false,false,true,1),
    (v_item_combo,  v_restaurant_id, v_cat_combo, 'Combo Família','2 pizzas grandes + refri 2L.',89.90,79.90,
       now() - interval '1 day', now() + interval '30 days', 'Combo da Casa', true, true, true, 1);

  v_builder_id := gen_random_uuid();
  INSERT INTO public.builders (id, restaurant_id, name, emoji, description, base_price, is_active, position)
  VALUES (v_builder_id, v_restaurant_id, 'Monte sua Pizza','🍕','Escolha tamanho, sabores e adicionais.',35.00,true,1);

  v_grp_size := gen_random_uuid(); v_grp_flavor := gen_random_uuid(); v_grp_extra := gen_random_uuid();
  INSERT INTO public.builder_groups (id, builder_id, name, min_select, max_select, is_required, position) VALUES
    (v_grp_size,   v_builder_id, 'Tamanho',    1, 1, true,  1),
    (v_grp_flavor, v_builder_id, 'Sabores',    1, 2, true,  2),
    (v_grp_extra,  v_builder_id, 'Adicionais', 0, 4, false, 3);

  INSERT INTO public.builder_options (group_id, name, price_delta, max_qty, position) VALUES
    (v_grp_size, 'Média', 0, 1, 1),
    (v_grp_size, 'Grande', 10, 1, 2),
    (v_grp_size, 'Família', 20, 1, 3),
    (v_grp_flavor, 'Margherita', 0, 1, 1),
    (v_grp_flavor, 'Calabresa', 0, 1, 2),
    (v_grp_flavor, 'Quatro Queijos', 5, 1, 3),
    (v_grp_flavor, 'Portuguesa', 3, 1, 4),
    (v_grp_extra, 'Borda recheada', 8, 1, 1),
    (v_grp_extra, 'Bacon extra', 5, 2, 2),
    (v_grp_extra, 'Catupiry', 4, 2, 3);

  INSERT INTO public.coupons (restaurant_id, code, discount_percent, valid_until, is_active) VALUES
    (v_restaurant_id, 'BEMVINDO10', 10, (now() + interval '90 days')::date, true),
    (v_restaurant_id, 'LOCALIX20',  20, (now() + interval '30 days')::date, true),
    (v_restaurant_id, 'DEMOFREE',   15, (now() + interval '180 days')::date, true);

  v_cust1 := gen_random_uuid(); v_cust2 := gen_random_uuid(); v_cust3 := gen_random_uuid();
  INSERT INTO public.customers (id, restaurant_id, name, phone, email, total_orders, total_spent, avg_ticket, last_order_at) VALUES
    (v_cust1, v_restaurant_id, 'Cliente Demo Ana',   '+5511900000001','ana@demo.local',   8, 412.00, 51.50, now() - interval '2 day'),
    (v_cust2, v_restaurant_id, 'Cliente Demo Bruno', '+5511900000002','bruno@demo.local', 5, 210.00, 42.00, now() - interval '5 day'),
    (v_cust3, v_restaurant_id, 'Cliente Demo Carla', '+5511900000003','carla@demo.local', 3, 138.00, 46.00, now() - interval '12 day');

  INSERT INTO public.customer_points (customer_id, balance, total_earned) VALUES
    (v_cust1, 412, 800),
    (v_cust2, 210, 350),
    (v_cust3, 138, 138)
  ON CONFLICT (customer_id) DO UPDATE SET balance = EXCLUDED.balance, total_earned = EXCLUDED.total_earned;

  INSERT INTO public.orders (restaurant_id, customer_name, customer_phone, address, payment_method, items, total, status, created_at) VALUES
    (v_restaurant_id, 'Cliente Demo Ana',   '+5511900000001','Rua Demo, 10','pix',
      jsonb_build_array(
        jsonb_build_object('id',v_item_marg::text,'name','Pizza Margherita','qty',1,'price',39.90),
        jsonb_build_object('id',v_item_coke::text,'name','Coca-Cola 350ml','qty',2,'price',7.00)
      ), 53.90, 'entregue', now() - interval '2 day'),
    (v_restaurant_id, 'Cliente Demo Bruno', '+5511900000002','Av. Teste, 200','credit',
      jsonb_build_array(jsonb_build_object('id',v_item_burger::text,'name','Localix Burger','qty',2,'price',29.90)),
      59.80, 'entregue', now() - interval '5 day'),
    (v_restaurant_id, 'Cliente Demo Carla', '+5511900000003','Rua Sample, 55','pix',
      jsonb_build_array(jsonb_build_object('id',v_item_combo::text,'name','Combo Família','qty',1,'price',79.90)),
      79.90, 'entregue', now() - interval '8 day'),
    (v_restaurant_id, 'Cliente Demo Ana',   '+5511900000001','Rua Demo, 10','pix',
      jsonb_build_array(jsonb_build_object('id',v_item_calab::text,'name','Pizza Calabresa','qty',1,'price',52.90)),
      52.90, 'em_preparo', now() - interval '20 minutes'),
    (v_restaurant_id, 'Cliente Demo Bruno', '+5511900000002','Av. Teste, 200','cash',
      jsonb_build_array(jsonb_build_object('id',v_item_xsalada::text,'name','X-Salada','qty',1,'price',26.90)),
      26.90, 'saiu_para_entrega', now() - interval '40 minutes'),
    (v_restaurant_id, 'Cliente Demo Carla', '+5511900000003','Rua Sample, 55','pix',
      jsonb_build_array(jsonb_build_object('id',v_item_marg::text,'name','Pizza Margherita','qty',1,'price',39.90)),
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

  PERFORM public.seed_demo_marketplace();

  RETURN jsonb_build_object('ok', true, 'restaurant_id', v_restaurant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_marketplace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_environment() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_demo_marketplace() TO service_role;
