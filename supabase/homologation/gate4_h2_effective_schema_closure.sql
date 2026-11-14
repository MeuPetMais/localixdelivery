-- Gate 4 H2 real schema provenance: Staging effective pg_catalog, 2026-11-14.

-- EXCLUSIVELY for isolated project gvozcqyjhogmvebrwzap. No cron or outbound HTTP.

-- Do not deploy to production/shared staging.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TYPE public.stock_movement_type AS ENUM ('ENTRY','EXIT','RESERVE','RELEASE','LOSS','ADJUSTMENT','TRANSFER','PRODUCTION','SALE');

CREATE TABLE public.customers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "total_orders" integer DEFAULT 0 NOT NULL,
  "total_spent" numeric(12,2) DEFAULT 0 NOT NULL,
  "avg_ticket" numeric(12,2) DEFAULT 0 NOT NULL,
  "last_order_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customers FROM PUBLIC, anon, authenticated;

CREATE TABLE public.customer_notifications (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "order_id" uuid,
  "restaurant_id" uuid,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_notifications FROM PUBLIC, anon, authenticated;

CREATE TABLE public.loyalty_transactions (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "transaction_type" text NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "cashback" numeric(12,2) DEFAULT 0 NOT NULL,
  "reference_type" text,
  "reference_id" uuid,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "balance_before" integer,
  "balance_after" integer,
  "source" text
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.loyalty_transactions FROM PUBLIC, anon, authenticated;

CREATE TABLE public.customer_loyalty (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "level" text DEFAULT 'BRONZE'::text NOT NULL,
  "points_balance" integer DEFAULT 0 NOT NULL,
  "cashback_balance" numeric(12,2) DEFAULT 0 NOT NULL,
  "lifetime_points" integer DEFAULT 0 NOT NULL,
  "lifetime_cashback" numeric(12,2) DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'ACTIVE'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.customer_loyalty FROM PUBLIC, anon, authenticated;

CREATE TABLE public.platform_settings (
  "id" boolean DEFAULT true NOT NULL,
  "name" text DEFAULT 'Localix Delivery'::text NOT NULL,
  "logo_url" text,
  "banner_url" text,
  "primary_color" text DEFAULT '#f97316'::text,
  "contact_email" text,
  "contact_whatsapp" text,
  "domain" text,
  "commission_rate" numeric(6,4) DEFAULT 0.05 NOT NULL,
  "fixed_fee" numeric(10,2) DEFAULT 0.99 NOT NULL,
  "min_order" numeric(10,2) DEFAULT 0 NOT NULL,
  "delivery_fee_default" numeric(10,2) DEFAULT 0 NOT NULL,
  "tier_fees" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "city_fees" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "minimum_order" numeric(10,2) DEFAULT 20.00 NOT NULL,
  "platform_fee_until_30" numeric(10,2) DEFAULT 0.99 NOT NULL,
  "platform_fee_above_30" numeric(10,2) DEFAULT 1.49 NOT NULL,
  "default_gateway" text DEFAULT 'mercado_pago'::text NOT NULL,
  "gateway_enabled" jsonb DEFAULT '{"mercado_pago": true}'::jsonb NOT NULL,
  "currency" text DEFAULT 'BRL'::text NOT NULL,
  "support_timezone" text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
  "support_sla_settings" jsonb DEFAULT '{"timezone": "America/Sao_Paulo", "priorities": {"alta": {"resolution_minutes": 480, "first_response_minutes": 240}, "baixa": {"resolution_minutes": 4320, "first_response_minutes": 1440}, "media": {"resolution_minutes": 1440, "first_response_minutes": 720}, "urgente": {"resolution_minutes": 240, "first_response_minutes": 60}}, "near_due_threshold_minutes": 60, "pause_when_waiting_customer": true}'::jsonb NOT NULL,
  "localix_benefits_enabled" boolean DEFAULT false NOT NULL,
  "localix_rewards_enabled" boolean DEFAULT false NOT NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_settings FROM PUBLIC, anon, authenticated;

CREATE TABLE public.reward_order_event_queue (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "order_status" text NOT NULL,
  "status" text DEFAULT 'PENDING'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 10 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "last_error" text,
  "source_updated_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.reward_order_event_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reward_order_event_queue FROM PUBLIC, anon, authenticated;

CREATE TABLE public.stock_movements (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "ingredient_id" uuid NOT NULL,
  "location_id" uuid,
  "movement_type" stock_movement_type NOT NULL,
  "quantity" numeric(12,3) NOT NULL,
  "previous_stock" numeric(12,3) NOT NULL,
  "new_stock" numeric(12,3) NOT NULL,
  "reason" text,
  "reference_type" text,
  "reference_id" uuid,
  "performed_by" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stock_movements FROM PUBLIC, anon, authenticated;

CREATE TABLE public.ingredients (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "unit" text DEFAULT 'un'::text NOT NULL,
  "stock" numeric(12,3) DEFAULT 0 NOT NULL,
  "min_stock" numeric(12,3) DEFAULT 0 NOT NULL,
  "unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sku" text,
  "barcode" text,
  "active" boolean DEFAULT true NOT NULL,
  "reserved_stock" numeric(12,3) DEFAULT 0 NOT NULL,
  "supplier_id" uuid
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ingredients FROM PUBLIC, anon, authenticated;

CREATE TABLE public.recipe_items (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "ingredient_id" uuid NOT NULL,
  "quantity" numeric(12,3) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.recipe_items FROM PUBLIC, anon, authenticated;

CREATE TABLE public.builder_option_ingredients (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "builder_option_id" uuid NOT NULL,
  "ingredient_id" uuid NOT NULL,
  "quantity" numeric NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.builder_option_ingredients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.builder_option_ingredients FROM PUBLIC, anon, authenticated;

CREATE TABLE public.builder_options (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "name" text NOT NULL,
  "price_delta" numeric(10,2) DEFAULT 0 NOT NULL,
  "max_qty" integer DEFAULT 1 NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "menu_item_id" uuid
);

ALTER TABLE public.builder_options ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.builder_options FROM PUBLIC, anon, authenticated;

CREATE TABLE public.builder_groups (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "builder_id" uuid NOT NULL,
  "name" text NOT NULL,
  "min_select" integer DEFAULT 0 NOT NULL,
  "max_select" integer DEFAULT 1 NOT NULL,
  "is_required" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_type" text DEFAULT 'MANUAL'::text NOT NULL,
  "price_strategy" text DEFAULT 'SUM'::text NOT NULL
);

ALTER TABLE public.builder_groups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.builder_groups FROM PUBLIC, anon, authenticated;

CREATE TABLE public.builders (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "emoji" text,
  "description" text,
  "image_url" text,
  "base_price" numeric(10,2) DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.builders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.builders FROM PUBLIC, anon, authenticated;

CREATE TABLE public.menu_items (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "category_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "price" numeric(10,2) NOT NULL,
  "image_url" text,
  "is_available" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "promo_price" numeric(10,2),
  "prep_time_minutes" integer,
  "available_delivery" boolean DEFAULT true NOT NULL,
  "available_pickup" boolean DEFAULT true NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "is_bestseller" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "promo_starts_at" timestamp with time zone,
  "promo_ends_at" timestamp with time zone,
  "promo_campaign" text,
  "is_paused" boolean DEFAULT false NOT NULL,
  "recurrence_days" smallint[],
  "recurrence_start_time" time without time zone,
  "recurrence_end_time" time without time zone,
  "is_weekly_favorite" boolean DEFAULT false NOT NULL
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.menu_items FROM PUBLIC, anon, authenticated;

CREATE TABLE public.suppliers (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "phone" text,
  "email" text,
  "city" text,
  "logo_url" text,
  "description" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "restaurant_id" uuid,
  "contact_name" text,
  "document" text,
  "address" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "lead_time" integer,
  "minimum_order_value" numeric(14,2),
  "payment_terms" text,
  "delivery_days" text[],
  "rating" numeric(3,2),
  "preferred_supplier" boolean DEFAULT false NOT NULL
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.suppliers FROM PUBLIC, anon, authenticated;

CREATE TABLE public.menu_categories (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.menu_categories FROM PUBLIC, anon, authenticated;

CREATE TABLE public.inventory_locations (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "default_location" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inventory_locations FROM PUBLIC, anon, authenticated;

ALTER TABLE public.builder_groups ADD CONSTRAINT "builder_groups_pkey" PRIMARY KEY (id);

ALTER TABLE public.builder_option_ingredients ADD CONSTRAINT "builder_option_ingredients_pkey" PRIMARY KEY (id);

ALTER TABLE public.builder_options ADD CONSTRAINT "builder_options_pkey" PRIMARY KEY (id);

ALTER TABLE public.builders ADD CONSTRAINT "builders_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_notifications ADD CONSTRAINT "customer_notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public.customers ADD CONSTRAINT "customers_pkey" PRIMARY KEY (id);

ALTER TABLE public.ingredients ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY (id);

ALTER TABLE public.inventory_locations ADD CONSTRAINT "inventory_locations_pkey" PRIMARY KEY (id);

ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE public.menu_categories ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public.menu_items ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY (id);

ALTER TABLE public.platform_settings ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public.recipe_items ADD CONSTRAINT "recipe_items_pkey" PRIMARY KEY (id);

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_pkey" PRIMARY KEY (id);

ALTER TABLE public.stock_movements ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY (id);

ALTER TABLE public.suppliers ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY (id);

ALTER TABLE public.builder_option_ingredients ADD CONSTRAINT "builder_option_ingredients_builder_option_id_ingredient_id_key" UNIQUE (builder_option_id, ingredient_id);

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_customer_id_restaurant_id_key" UNIQUE (customer_id, restaurant_id);

ALTER TABLE public.customers ADD CONSTRAINT "customers_restaurant_id_phone_key" UNIQUE (restaurant_id, phone);

ALTER TABLE public.recipe_items ADD CONSTRAINT "recipe_items_menu_item_id_ingredient_id_key" UNIQUE (menu_item_id, ingredient_id);

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_order_id_event_type_key" UNIQUE (order_id, event_type);

ALTER TABLE public.builder_groups ADD CONSTRAINT "builder_groups_price_strategy_check" CHECK ((price_strategy = ANY (ARRAY['SUM'::text, 'MAX_MENU_ITEM'::text])));

ALTER TABLE public.builder_groups ADD CONSTRAINT "builder_groups_source_type_check" CHECK ((source_type = ANY (ARRAY['MANUAL'::text, 'MENU_ITEMS'::text])));

ALTER TABLE public.builder_option_ingredients ADD CONSTRAINT "builder_option_ingredients_quantity_check" CHECK ((quantity > (0)::numeric));

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_cashback_balance_check" CHECK ((cashback_balance >= (0)::numeric));

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_lifetime_cashback_check" CHECK ((lifetime_cashback >= (0)::numeric));

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_lifetime_points_check" CHECK ((lifetime_points >= 0));

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_points_balance_check" CHECK ((points_balance >= 0));

ALTER TABLE public.platform_settings ADD CONSTRAINT "platform_settings_id_check" CHECK ((id = true));

ALTER TABLE public.recipe_items ADD CONSTRAINT "recipe_items_quantity_check" CHECK ((quantity > (0)::numeric));

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_attempts_check" CHECK ((attempts >= 0));

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_event_type_check" CHECK ((event_type = ANY (ARRAY['ORDER_COMPLETED'::text, 'ORDER_REFUNDED'::text, 'ORDER_CHARGEBACK'::text, 'ORDER_CANCELLED'::text])));

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_max_attempts_check" CHECK ((max_attempts > 0));

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_status_check" CHECK ((status = ANY (ARRAY['PENDING'::text, 'PROCESSED'::text, 'FAILED'::text])));

ALTER TABLE public.builder_groups ADD CONSTRAINT "builder_groups_builder_id_fkey" FOREIGN KEY (builder_id) REFERENCES builders(id) ON DELETE CASCADE;

ALTER TABLE public.builder_option_ingredients ADD CONSTRAINT "builder_option_ingredients_builder_option_id_fkey" FOREIGN KEY (builder_option_id) REFERENCES builder_options(id) ON DELETE CASCADE;

ALTER TABLE public.builder_option_ingredients ADD CONSTRAINT "builder_option_ingredients_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.builder_options ADD CONSTRAINT "builder_options_group_id_fkey" FOREIGN KEY (group_id) REFERENCES builder_groups(id) ON DELETE CASCADE;

ALTER TABLE public.builder_options ADD CONSTRAINT "builder_options_menu_item_id_fkey" FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL;

ALTER TABLE public.builders ADD CONSTRAINT "builders_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.customer_loyalty ADD CONSTRAINT "customer_loyalty_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.customer_notifications ADD CONSTRAINT "customer_notifications_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.customer_notifications ADD CONSTRAINT "customer_notifications_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;

ALTER TABLE public.customers ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.ingredients ADD CONSTRAINT "ingredients_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.ingredients ADD CONSTRAINT "ingredients_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_locations ADD CONSTRAINT "inventory_locations_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.loyalty_transactions ADD CONSTRAINT "loyalty_transactions_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.menu_categories ADD CONSTRAINT "menu_categories_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.menu_items ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE SET NULL;

ALTER TABLE public.menu_items ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_items ADD CONSTRAINT "recipe_items_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.recipe_items ADD CONSTRAINT "recipe_items_menu_item_id_fkey" FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE;

ALTER TABLE public.reward_order_event_queue ADD CONSTRAINT "reward_order_event_queue_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE public.stock_movements ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE public.suppliers ADD CONSTRAINT "suppliers_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

CREATE INDEX idx_builder_groups_builder ON public.builder_groups USING btree (builder_id);

CREATE UNIQUE INDEX builder_groups_one_max_menu_item_per_builder_uidx ON public.builder_groups USING btree (builder_id) WHERE (price_strategy = 'MAX_MENU_ITEM'::text);

CREATE INDEX builder_option_ingredients_ingredient_idx ON public.builder_option_ingredients USING btree (ingredient_id);

CREATE INDEX builder_option_ingredients_option_idx ON public.builder_option_ingredients USING btree (builder_option_id);

CREATE INDEX builder_options_menu_item_id_idx ON public.builder_options USING btree (menu_item_id) WHERE (menu_item_id IS NOT NULL);

CREATE INDEX idx_builder_options_group ON public.builder_options USING btree (group_id);

CREATE UNIQUE INDEX builder_options_group_menu_item_uidx ON public.builder_options USING btree (group_id, menu_item_id) WHERE (menu_item_id IS NOT NULL);

CREATE INDEX idx_builders_restaurant ON public.builders USING btree (restaurant_id);

CREATE INDEX idx_customer_loyalty_customer ON public.customer_loyalty USING btree (customer_id);

CREATE INDEX idx_customer_loyalty_restaurant ON public.customer_loyalty USING btree (restaurant_id);

CREATE INDEX idx_customer_notifications_customer ON public.customer_notifications USING btree (customer_id, created_at DESC);

CREATE INDEX idx_customer_notifications_unread ON public.customer_notifications USING btree (customer_id) WHERE (read_at IS NULL);

CREATE UNIQUE INDEX customers_restaurant_normalized_phone_uidx ON public.customers USING btree (restaurant_id, regexp_replace(COALESCE(phone, ''::text), '\D'::text, ''::text, 'g'::text)) WHERE (regexp_replace(COALESCE(phone, ''::text), '\D'::text, ''::text, 'g'::text) <> ''::text);

CREATE INDEX ingredients_restaurant_idx ON public.ingredients USING btree (restaurant_id);

CREATE INDEX idx_loyalty_tx_customer ON public.loyalty_transactions USING btree (customer_id, created_at DESC);

CREATE INDEX idx_loyalty_tx_restaurant ON public.loyalty_transactions USING btree (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX uq_loyalty_tx_order_source ON public.loyalty_transactions USING btree (customer_id, reference_id, source) WHERE ((reference_type = 'order'::text) AND (reference_id IS NOT NULL));

CREATE INDEX idx_categories_restaurant ON public.menu_categories USING btree (restaurant_id);

CREATE INDEX idx_items_restaurant ON public.menu_items USING btree (restaurant_id);

CREATE INDEX idx_menu_items_weekly_favorite ON public.menu_items USING btree (restaurant_id) WHERE (is_weekly_favorite = true);

CREATE INDEX menu_items_promo_active_idx ON public.menu_items USING btree (restaurant_id) WHERE (promo_price IS NOT NULL);

CREATE INDEX recipe_items_ingredient_idx ON public.recipe_items USING btree (ingredient_id);

CREATE INDEX recipe_items_menu_idx ON public.recipe_items USING btree (menu_item_id);

CREATE INDEX reward_order_event_queue_order_idx ON public.reward_order_event_queue USING btree (order_id);

CREATE INDEX reward_order_event_queue_pending_idx ON public.reward_order_event_queue USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['PENDING'::text, 'FAILED'::text]));

CREATE INDEX stock_movements_ingredient_idx ON public.stock_movements USING btree (ingredient_id, created_at DESC);

CREATE UNIQUE INDEX stock_movements_order_consume_uidx ON public.stock_movements USING btree (reference_id, ingredient_id) WHERE ((reference_type = 'order'::text) AND (COALESCE((metadata ->> 'operation'::text), ''::text) = 'consume'::text));

CREATE UNIQUE INDEX stock_movements_order_reverse_uidx ON public.stock_movements USING btree (reference_id, ingredient_id) WHERE ((reference_type = 'order'::text) AND (COALESCE((metadata ->> 'operation'::text), ''::text) = 'reverse'::text));

-- Mandatory singleton settings row; absence causes legacy rewards trigger to treat NULL as enabled.
-- Mirrored settings from Staging baseline, benefits/rewards deliberately disabled.
INSERT INTO public.platform_settings
 (id, commission_rate, fixed_fee, platform_fee_until_30, platform_fee_above_30, localix_rewards_enabled, localix_benefits_enabled)
VALUES (true, 0.05, 0.99, 0.99, 1.49, false, false);

CREATE OR REPLACE FUNCTION private.apply_order_stock_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_result jsonb;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='aceito' then
    v_result:=private.consume_order_stock(new.id,auth.uid());
    if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'ORDER_STOCK_CONSUME_FAILED:%',v_result::text; end if;
  end if;
  if old.status='aceito' and new.status in ('cancelado','reembolsado') then
    v_result:=private.reverse_order_stock(new.id,auth.uid());
    if not coalesce((v_result->>'ok')::boolean,false) then raise exception 'ORDER_STOCK_REVERSE_FAILED:%',v_result::text; end if;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION private.consume_order_stock(_order_id uuid, _performed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_restaurant_id uuid; v_items jsonb; v_req record; v_previous numeric; v_new numeric; v_consumed_count integer:=0;
begin
  select restaurant_id,items into v_restaurant_id,v_items from public.orders where id=_order_id for update;
  if v_restaurant_id is null then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  if exists(select 1 from public.stock_movements sm where sm.reference_type='order' and sm.reference_id=_order_id and coalesce(sm.metadata->>'operation','')='consume') then return jsonb_build_object('ok',true,'already_processed',true,'consumed_ingredients',0); end if;
  if v_items is null or jsonb_typeof(v_items)<>'array' then return jsonb_build_object('ok',true,'consumed_ingredients',0); end if;
  for v_req in
    with normal_lines as (select (line->>'id')::uuid menu_item_id,coalesce(nullif(line->>'qty','')::numeric,0) item_qty from jsonb_array_elements(v_items) line where coalesce(line->>'kind','product')<>'builder' and coalesce(line->>'id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and coalesce(nullif(line->>'qty','')::numeric,0)>0),
    normal_req as (select ri.ingredient_id,sum(ri.quantity*nl.item_qty)::numeric required_qty from normal_lines nl join public.recipe_items ri on ri.menu_item_id=nl.menu_item_id group by ri.ingredient_id),
    builder_selected as (select (sel->>'option_id')::uuid option_id,coalesce(nullif(sel->>'quantity','')::numeric,1) selection_qty,coalesce(nullif(line->>'qty','')::numeric,0) item_qty from jsonb_array_elements(v_items) line cross join lateral jsonb_array_elements(coalesce(line->'selections','[]'::jsonb)) sel where line->>'kind'='builder' and coalesce(sel->>'option_id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and coalesce(nullif(line->>'qty','')::numeric,0)>0 and coalesce(nullif(sel->>'quantity','')::numeric,1)>0),
    builder_req as (select boi.ingredient_id,sum(boi.quantity*bs.selection_qty*bs.item_qty)::numeric required_qty from builder_selected bs join public.builder_option_ingredients boi on boi.builder_option_id=bs.option_id join public.builder_options bo on bo.id=boi.builder_option_id join public.builder_groups bg on bg.id=bo.group_id join public.builders b on b.id=bg.builder_id where b.restaurant_id=v_restaurant_id group by boi.ingredient_id),
    combined as (select ingredient_id,required_qty from normal_req union all select ingredient_id,required_qty from builder_req)
    select c.ingredient_id,ing.name ingredient_name,ing.unit ingredient_unit,sum(c.required_qty)::numeric required_qty from combined c join public.ingredients ing on ing.id=c.ingredient_id where ing.restaurant_id=v_restaurant_id group by c.ingredient_id,ing.name,ing.unit order by c.ingredient_id
  loop
    select stock into v_previous from public.ingredients where id=v_req.ingredient_id and restaurant_id=v_restaurant_id for update;
    if v_previous is null then return jsonb_build_object('ok',false,'reason','INGREDIENT_NOT_FOUND','ingredient_id',v_req.ingredient_id,'ingredient_name',v_req.ingredient_name); end if;
    if v_previous<v_req.required_qty then return jsonb_build_object('ok',false,'reason','INSUFFICIENT_STOCK','ingredient_id',v_req.ingredient_id,'ingredient_name',v_req.ingredient_name,'unit',v_req.ingredient_unit,'available',v_previous,'required',v_req.required_qty); end if;
  end loop;
  for v_req in
    with normal_lines as (select (line->>'id')::uuid menu_item_id,coalesce(nullif(line->>'qty','')::numeric,0) item_qty from jsonb_array_elements(v_items) line where coalesce(line->>'kind','product')<>'builder' and coalesce(line->>'id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and coalesce(nullif(line->>'qty','')::numeric,0)>0),
    normal_req as (select ri.ingredient_id,sum(ri.quantity*nl.item_qty)::numeric required_qty from normal_lines nl join public.recipe_items ri on ri.menu_item_id=nl.menu_item_id group by ri.ingredient_id),
    builder_selected as (select (sel->>'option_id')::uuid option_id,coalesce(nullif(sel->>'quantity','')::numeric,1) selection_qty,coalesce(nullif(line->>'qty','')::numeric,0) item_qty from jsonb_array_elements(v_items) line cross join lateral jsonb_array_elements(coalesce(line->'selections','[]'::jsonb)) sel where line->>'kind'='builder' and coalesce(sel->>'option_id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and coalesce(nullif(line->>'qty','')::numeric,0)>0 and coalesce(nullif(sel->>'quantity','')::numeric,1)>0),
    builder_req as (select boi.ingredient_id,sum(boi.quantity*bs.selection_qty*bs.item_qty)::numeric required_qty from builder_selected bs join public.builder_option_ingredients boi on boi.builder_option_id=bs.option_id join public.builder_options bo on bo.id=boi.builder_option_id join public.builder_groups bg on bg.id=bo.group_id join public.builders b on b.id=bg.builder_id where b.restaurant_id=v_restaurant_id group by boi.ingredient_id),
    combined as (select ingredient_id,required_qty from normal_req union all select ingredient_id,required_qty from builder_req)
    select c.ingredient_id,ing.name ingredient_name,ing.unit ingredient_unit,sum(c.required_qty)::numeric required_qty from combined c join public.ingredients ing on ing.id=c.ingredient_id where ing.restaurant_id=v_restaurant_id group by c.ingredient_id,ing.name,ing.unit order by c.ingredient_id
  loop
    select stock into v_previous from public.ingredients where id=v_req.ingredient_id and restaurant_id=v_restaurant_id for update;
    v_new:=v_previous-v_req.required_qty;
    update public.ingredients set stock=v_new where id=v_req.ingredient_id and restaurant_id=v_restaurant_id;
    insert into public.stock_movements(ingredient_id,movement_type,quantity,previous_stock,new_stock,reason,reference_type,reference_id,performed_by,metadata)
    values(v_req.ingredient_id,'SALE'::public.stock_movement_type,v_req.required_qty,v_previous,v_new,'Consumo automático por aceite de pedido','order',_order_id,_performed_by,jsonb_build_object('operation','consume','source','order_recipe_and_builder','ingredient_unit',v_req.ingredient_unit));
    v_consumed_count:=v_consumed_count+1;
  end loop;
  return jsonb_build_object('ok',true,'already_processed',false,'consumed_ingredients',v_consumed_count);
end; $function$
;

CREATE OR REPLACE FUNCTION private.rebuild_customer_order_metrics(_restaurant_id uuid, _phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_phone text := pg_catalog.regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  v_total_orders integer := 0;
  v_total_spent numeric(12,2) := 0;
  v_avg_ticket numeric(12,2) := 0;
  v_last_order_at timestamptz := null;
BEGIN
  IF _restaurant_id IS NULL OR v_phone = '' THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(_restaurant_id::text),
    pg_catalog.hashtext(v_phone)
  );

  SELECT
    count(*)::integer,
    coalesce(sum(coalesce(o.total, 0)), 0)::numeric(12,2),
    CASE
      WHEN count(*) > 0 THEN round((coalesce(sum(coalesce(o.total, 0)), 0) / count(*))::numeric, 2)::numeric(12,2)
      ELSE 0::numeric(12,2)
    END,
    max(o.created_at)
  INTO
    v_total_orders,
    v_total_spent,
    v_avg_ticket,
    v_last_order_at
  FROM public.orders o
  WHERE o.restaurant_id = _restaurant_id
    AND pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') = v_phone
    AND o.status IN ('entregue', 'concluido');

  UPDATE public.customers c
  SET total_orders = v_total_orders,
      total_spent = v_total_spent,
      avg_ticket = v_avg_ticket,
      last_order_at = v_last_order_at,
      updated_at = pg_catalog.now()
  WHERE c.restaurant_id = _restaurant_id
    AND pg_catalog.regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.reverse_order_stock(_order_id uuid, _performed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_row record; v_previous numeric; v_new numeric; v_reversed_count integer:=0;
begin
  perform 1 from public.orders where id=_order_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  for v_row in select sm.ingredient_id from public.stock_movements sm where sm.reference_type='order' and sm.reference_id=_order_id and coalesce(sm.metadata->>'operation','')='consume' order by sm.ingredient_id loop perform 1 from public.ingredients where id=v_row.ingredient_id for update; end loop;
  for v_row in select sm.id consume_movement_id,sm.ingredient_id,sm.quantity,sm.metadata from public.stock_movements sm where sm.reference_type='order' and sm.reference_id=_order_id and coalesce(sm.metadata->>'operation','')='consume' order by sm.ingredient_id loop
    if exists(select 1 from public.stock_movements rev where rev.reference_type='order' and rev.reference_id=_order_id and rev.ingredient_id=v_row.ingredient_id and coalesce(rev.metadata->>'operation','')='reverse') then continue; end if;
    select stock into v_previous from public.ingredients where id=v_row.ingredient_id for update;
    if v_previous is null then raise exception 'STOCK_REVERSAL_INGREDIENT_NOT_FOUND:%',v_row.ingredient_id; end if;
    v_new:=v_previous+v_row.quantity;
    update public.ingredients set stock=v_new where id=v_row.ingredient_id;
    insert into public.stock_movements(ingredient_id,movement_type,quantity,previous_stock,new_stock,reason,reference_type,reference_id,performed_by,metadata)
    values(v_row.ingredient_id,'RELEASE'::public.stock_movement_type,v_row.quantity,v_previous,v_new,'Reversão de consumo por cancelamento/reembolso do pedido','order',_order_id,_performed_by,jsonb_build_object('operation','reverse','source','stock_movement','consume_movement_id',v_row.consume_movement_id,'ingredient_unit',v_row.metadata->>'ingredient_unit'));
    v_reversed_count:=v_reversed_count+1;
  end loop;
  return jsonb_build_object('ok',true,'reversed_ingredients',v_reversed_count);
end; $function$
;

CREATE OR REPLACE FUNCTION private.upsert_customer_from_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_phone text := pg_catalog.regexp_replace(coalesce(NEW.customer_phone, ''), '\D', '', 'g');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF v_phone = '' OR NEW.customer_name IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (restaurant_id, name, phone)
  VALUES (NEW.restaurant_id, NEW.customer_name, v_phone)
  ON CONFLICT (
    restaurant_id,
    (pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'))
  )
  WHERE pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
  DO UPDATE
    SET name = EXCLUDED.name,
        updated_at = pg_catalog.now();

  PERFORM private.rebuild_customer_order_metrics(NEW.restaurant_id, v_phone);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.loyalty_apply(_customer_id uuid, _restaurant_id uuid, _tx_type text, _points integer, _source text, _reference_type text, _reference_id uuid, _description text, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_before int;
  v_after  int;
  v_tx_id  uuid;
BEGIN
  IF _points = 0 THEN RETURN NULL; END IF;

  -- Garante linha zerada; o crédito real ocorre no UPDATE abaixo.
  INSERT INTO public.customer_loyalty (customer_id, restaurant_id, points_balance, lifetime_points)
  VALUES (_customer_id, _restaurant_id, 0, 0)
  ON CONFLICT (customer_id, restaurant_id) DO NOTHING;

  SELECT points_balance INTO v_before
    FROM public.customer_loyalty
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id
   FOR UPDATE;

  v_after := v_before + _points;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points (have %, need %)', v_before, -_points
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.customer_loyalty
     SET points_balance  = v_after,
         lifetime_points = lifetime_points + GREATEST(_points, 0),
         updated_at = now()
   WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;

  IF _reference_type = 'order' AND _reference_id IS NOT NULL THEN
    INSERT INTO public.loyalty_transactions
      (customer_id, restaurant_id, transaction_type, points,
       source, reference_type, reference_id, description, metadata,
       balance_before, balance_after)
    VALUES
      (_customer_id, _restaurant_id, _tx_type, _points,
       _source, _reference_type, _reference_id, _description, COALESCE(_metadata,'{}'::jsonb),
       v_before, v_after)
    ON CONFLICT (customer_id, reference_id, source)
      WHERE reference_type = 'order' AND reference_id IS NOT NULL
      DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NULL THEN
      UPDATE public.customer_loyalty
         SET points_balance  = v_before,
             lifetime_points = lifetime_points - GREATEST(_points, 0),
             updated_at = now()
       WHERE customer_id = _customer_id AND restaurant_id = _restaurant_id;
    END IF;
  ELSE
    INSERT INTO public.loyalty_transactions
      (customer_id, restaurant_id, transaction_type, points,
       source, reference_type, reference_id, description, metadata,
       balance_before, balance_after)
    VALUES
      (_customer_id, _restaurant_id, _tx_type, _points,
       _source, _reference_type, _reference_id, _description, COALESCE(_metadata,'{}'::jsonb),
       v_before, v_after)
    RETURNING id INTO v_tx_id;
  END IF;

  RETURN v_tx_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.loyalty_rollback_reserve(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pts int; v_cust uuid; v_rest uuid;
BEGIN
  SELECT o.loyalty_points_reserved, cust.id, o.restaurant_id
    INTO v_pts, v_cust, v_rest
    FROM public.orders o
    LEFT JOIN public.customers cust
      ON cust.restaurant_id = o.restaurant_id
     AND regexp_replace(cust.phone,'\D','','g') = regexp_replace(coalesce(o.customer_phone,''),'\D','','g')
   WHERE o.id = _order_id;

  IF v_pts IS NULL OR v_pts <= 0 OR v_cust IS NULL THEN RETURN; END IF;

  -- Estorno via ADJUSTMENT (source distinto do reserve p/ não colidir)
  PERFORM public.loyalty_apply(
    v_cust, v_rest, 'ADJUSTMENT', v_pts,
    'rollback', 'order', _order_id, 'Devolução de reserva', '{}'::jsonb
  );

  UPDATE public.orders
     SET loyalty_points_reserved = 0, loyalty_points_consumed = 0
   WHERE id = _order_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_order_notify_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_title  TEXT;
  v_body   TEXT;
  v_type   TEXT;
  v_rest_name TEXT;
  v_method TEXT;
  v_offline BOOLEAN;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_status := NEW.status;
  v_method := lower(coalesce(NEW.payment_method, ''));
  v_offline := v_method IN (
    'cash','dinheiro','especie','espécie',
    'card_on_delivery','cartao na entrega','cartão na entrega',
    'meal_voucher','food_voucher','vr','va',
    'vale refeicao','vale refeição','vale alimentacao','vale alimentação'
  );

  SELECT name INTO v_rest_name FROM public.restaurants WHERE id = NEW.restaurant_id;

  IF v_status IN ('novo', 'aguardando_pagamento') THEN
    v_type := 'order_received';
    v_title := '🆕 Pedido recebido';
    v_body := 'Seu pedido foi recebido' || COALESCE(' pela ' || v_rest_name, '') || '.';
  ELSIF v_status = 'pago' THEN
    IF v_offline THEN
      v_type := 'order_received';
      v_title := '🧾 Pedido recebido';
      v_body := 'Seu pedido foi enviado ao restaurante. O pagamento será realizado na entrega.';
    ELSE
      v_type := 'order_paid';
      v_title := '💳 Pagamento aprovado';
      v_body := 'Recebemos seu pagamento. Aguardando confirmação do restaurante.';
    END IF;
  ELSIF v_status = 'aceito' THEN
    v_type := 'order_accepted';
    v_title := '✅ Pedido aceito';
    v_body := 'O restaurante aceitou seu pedido.';
  ELSIF v_status = 'em_preparo' THEN
    v_type := 'order_preparing';
    v_title := '👨‍🍳 Em preparo';
    v_body := 'Seu pedido já está sendo preparado.';
  ELSIF v_status = 'pronto' THEN
    v_type := 'order_ready';
    v_title := '📦 Pedido pronto';
    v_body := 'Seu pedido está pronto.';
  ELSIF v_status = 'saiu_para_entrega' THEN
    v_type := 'order_out';
    v_title := '🛵 Saiu para entrega';
    v_body := 'Seu pedido saiu para entrega.';
  ELSIF v_status IN ('entregue', 'concluido') THEN
    v_type := 'order_delivered';
    v_title := '✅ Pedido entregue';
    v_body := 'Aproveite sua refeição! Não esqueça de avaliar sua experiência.';
  ELSIF v_status IN ('cancelado', 'rejeitado', 'falha_pagamento') THEN
    v_type := 'order_canceled';
    v_title := '❌ Pedido cancelado';
    v_body := 'Seu pedido foi cancelado. Consulte o estabelecimento.';
  ELSIF v_status IN ('reembolsado', 'chargeback') THEN
    v_type := 'order_refunded';
    v_title := '↩️ Reembolso emitido';
    v_body := 'O valor do seu pedido foi devolvido.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_notifications
    (customer_id, order_id, restaurant_id, type, title, body, data)
  VALUES
    (NEW.customer_id, NEW.id, NEW.restaurant_id, v_type, v_title, v_body,
     jsonb_build_object('order_number', NEW.order_number, 'status', v_status, 'payment_method', NEW.payment_method));

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_loyalty_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_active   boolean;
  v_rate     numeric;
  v_min_ord  numeric;
  v_earn_on  text;
  v_earn_status text;
  v_cust_id  uuid;
  v_points   int;
  v_already  boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT loyalty_settings INTO v_settings FROM public.restaurants WHERE id = NEW.restaurant_id;
  v_active  := COALESCE((v_settings->>'active')::boolean, false);
  v_rate    := COALESCE((v_settings->>'points_per_real')::numeric, 1);
  v_min_ord := COALESCE((v_settings->>'min_order')::numeric, 0);
  v_earn_on := COALESCE(v_settings->>'earn_on', 'paid');
  v_earn_status := CASE v_earn_on WHEN 'delivered' THEN 'entregue' ELSE 'pago' END;

  SELECT id INTO v_cust_id
    FROM public.customers
   WHERE restaurant_id = NEW.restaurant_id
     AND regexp_replace(phone,'\D','','g') = regexp_replace(coalesce(NEW.customer_phone,''),'\D','','g')
   LIMIT 1;

  IF NEW.status IN ('cancelado', 'rejeitado', 'reembolsado', 'chargeback') THEN
    IF v_cust_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM public.loyalty_transactions
         WHERE reference_type='order' AND reference_id = NEW.id
           AND source IN ('order_paid','order_delivered')
      ) INTO v_already;
      IF v_already THEN
        PERFORM public.loyalty_apply(
          v_cust_id, NEW.restaurant_id, 'ADJUSTMENT',
          -GREATEST(floor(COALESCE(NEW.total,0) * v_rate)::int, 0),
          'cancel_reverse', 'order', NEW.id, 'Estorno por cancelamento', '{}'::jsonb
        );
      END IF;
      IF COALESCE(NEW.loyalty_points_reserved,0) > COALESCE(NEW.loyalty_points_consumed,0) THEN
        PERFORM public.loyalty_rollback_reserve(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF v_active AND NEW.status = v_earn_status
     AND COALESCE(NEW.total,0) >= v_min_ord
     AND v_cust_id IS NOT NULL THEN
    v_points := GREATEST(floor(COALESCE(NEW.total,0) * v_rate)::int, 0);
    IF v_points > 0 THEN
      PERFORM public.loyalty_apply(
        v_cust_id, NEW.restaurant_id, 'EARN', v_points,
        CASE v_earn_on WHEN 'delivered' THEN 'order_delivered' ELSE 'order_paid' END,
        'order', NEW.id, 'Pontos do pedido', '{}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_orders_snapshot_platform_fees()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_until_30 numeric;
  v_above_30 numeric;
  v_fee numeric;
BEGIN
  SELECT
    COALESCE(ps.platform_fee_until_30, 0.99),
    COALESCE(ps.platform_fee_above_30, 1.49)
  INTO v_until_30, v_above_30
  FROM public.platform_settings ps
  WHERE ps.id = true;

  v_until_30 := COALESCE(v_until_30, 0.99);
  v_above_30 := COALESCE(v_above_30, 1.49);

  IF COALESCE(NEW.total, 0) <= 30 THEN
    v_fee := v_until_30;
  ELSE
    v_fee := v_above_30;
  END IF;

  NEW.platform_fee := v_fee;
  NEW.fixed_fee := v_fee;
  NEW.commission_rate := 0;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_rewards_enqueue_order_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_enabled boolean := false;
  v_event_type text;
begin
  select coalesce(localix_rewards_enabled,false) into v_enabled
  from public.platform_settings where id=true limit 1;
  if not v_enabled then return new; end if;
  if new.customer_id is null then return new; end if;
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;

  v_event_type := case new.status
    when 'concluido' then 'ORDER_COMPLETED'
    when 'reembolsado' then 'ORDER_REFUNDED'
    when 'chargeback' then 'ORDER_CHARGEBACK'
    when 'cancelado' then 'ORDER_CANCELLED'
    else null end;
  if v_event_type is null then return new; end if;

  insert into public.reward_order_event_queue(order_id,event_type,order_status,source_updated_at,metadata)
  values(new.id,v_event_type,new.status,new.updated_at,jsonb_build_object('restaurant_id',new.restaurant_id,'customer_id',new.customer_id))
  on conflict(order_id,event_type) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_builder_option_menu_item_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_builder_restaurant_id uuid;
  v_menu_restaurant_id uuid;
  v_group_source_type text;
begin
  if new.menu_item_id is null then
    return new;
  end if;

  select b.restaurant_id, g.source_type
    into v_builder_restaurant_id, v_group_source_type
  from public.builder_groups g
  join public.builders b on b.id = g.builder_id
  where g.id = new.group_id;

  select mi.restaurant_id
    into v_menu_restaurant_id
  from public.menu_items mi
  where mi.id = new.menu_item_id;

  if v_builder_restaurant_id is null or v_menu_restaurant_id is null then
    raise exception 'builder_menu_item_invalid';
  end if;

  if v_builder_restaurant_id <> v_menu_restaurant_id then
    raise exception 'builder_menu_item_wrong_restaurant';
  end if;

  if v_group_source_type <> 'MENU_ITEMS' then
    raise exception 'builder_menu_item_requires_menu_source';
  end if;

  return new;
end;
$function$
;

CREATE TRIGGER trg_validate_builder_option_menu_item_scope BEFORE INSERT OR UPDATE OF group_id, menu_item_id ON public.builder_options FOR EACH ROW EXECUTE FUNCTION validate_builder_option_menu_item_scope();

CREATE TRIGGER tg_builders_updated_at BEFORE UPDATE ON public.builders FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

CREATE TRIGGER trg_customer_loyalty_updated BEFORE UPDATE ON public.customer_loyalty FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

CREATE TRIGGER tg_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

CREATE TRIGGER orders_snapshot_platform_fees BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_snapshot_platform_fees();

CREATE TRIGGER tg_orders_stock_status_transition BEFORE UPDATE OF status ON public.orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION private.apply_order_stock_status_transition();

CREATE TRIGGER trg_order_notify_customer_ins AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_order_notify_customer();

CREATE TRIGGER trg_order_notify_customer_upd AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_order_notify_customer();

CREATE TRIGGER trg_orders_loyalty_status AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_orders_loyalty_status();

CREATE TRIGGER trg_orders_upsert_customer AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.upsert_customer_from_order();

CREATE TRIGGER trg_rewards_enqueue_order_event AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION tg_rewards_enqueue_order_event();

CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

CREATE TRIGGER tg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

REVOKE ALL ON public.customers FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.customer_notifications FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.loyalty_transactions FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.customer_loyalty FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.platform_settings FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.reward_order_event_queue FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.stock_movements FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.ingredients FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.recipe_items FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.builder_option_ingredients FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.builder_options FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.builder_groups FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.builders FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.menu_items FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.suppliers FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.menu_categories FROM PUBLIC,anon,authenticated;

REVOKE ALL ON public.inventory_locations FROM PUBLIC,anon,authenticated;

-- H2 schema closure is intentionally service-role-only pending per-role policy integration.
-- Never expose SECURITY DEFINER or financial helper functions to PostgREST roles.
DO $revoke$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT n.nspname AS schema_name, p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname||'.'||p.proname) IN (
      'private.apply_order_stock_status_transition','private.upsert_customer_from_order',
      'public.tg_order_notify_customer','public.tg_orders_loyalty_status',
      'public.tg_orders_snapshot_platform_fees','public.tg_rewards_enqueue_order_event',
      'private.consume_order_stock','private.reverse_order_stock',
      'private.rebuild_customer_order_metrics','public.loyalty_apply',
      'public.loyalty_rollback_reserve','public.validate_builder_option_menu_item_scope'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   f.schema_name, f.function_name, f.identity_args);
  END LOOP;
END
$revoke$;
