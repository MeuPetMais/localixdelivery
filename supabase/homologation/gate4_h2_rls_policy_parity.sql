-- H2 parity: RLS policies for isolated sandbox, sourced from staging effective pg_policies 2026-11-14.

-- Do not deploy to production or staging. No changes to financial formulas or events.

ALTER TABLE public.restaurants ADD COLUMN builders_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.is_builders_enabled(_restaurant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT builders_enabled FROM public.restaurants WHERE id = _restaurant_id AND active = true), false);
$function$
;

REVOKE ALL ON FUNCTION private.is_builders_enabled(uuid) FROM PUBLIC,anon,authenticated;

GRANT USAGE ON SCHEMA private TO anon,authenticated;

GRANT EXECUTE ON FUNCTION private.is_builders_enabled(uuid) TO anon,authenticated;

CREATE POLICY "Owners manage groups" ON public."builder_groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (builders b
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((b.id = builder_groups.builder_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (builders b
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((b.id = builder_groups.builder_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Public can view groups" ON public."builder_groups" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM builders b
  WHERE ((b.id = builder_groups.builder_id) AND (b.is_active = true) AND private.is_builders_enabled(b.restaurant_id)))));

CREATE POLICY "builder_option_ingredients_owner_delete" ON public."builder_option_ingredients" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (((builder_options bo
     JOIN builder_groups bg ON ((bg.id = bo.group_id)))
     JOIN builders b ON ((b.id = bg.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((bo.id = builder_option_ingredients.builder_option_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "builder_option_ingredients_owner_insert" ON public."builder_option_ingredients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ((((builder_options bo
     JOIN builder_groups bg ON ((bg.id = bo.group_id)))
     JOIN builders b ON ((b.id = bg.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
     JOIN ingredients i ON ((i.id = builder_option_ingredients.ingredient_id)))
  WHERE ((bo.id = builder_option_ingredients.builder_option_id) AND (i.restaurant_id = b.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "builder_option_ingredients_owner_select" ON public."builder_option_ingredients" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (((builder_options bo
     JOIN builder_groups bg ON ((bg.id = bo.group_id)))
     JOIN builders b ON ((b.id = bg.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((bo.id = builder_option_ingredients.builder_option_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "builder_option_ingredients_owner_update" ON public."builder_option_ingredients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (((builder_options bo
     JOIN builder_groups bg ON ((bg.id = bo.group_id)))
     JOIN builders b ON ((b.id = bg.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((bo.id = builder_option_ingredients.builder_option_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((((builder_options bo
     JOIN builder_groups bg ON ((bg.id = bo.group_id)))
     JOIN builders b ON ((b.id = bg.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
     JOIN ingredients i ON ((i.id = builder_option_ingredients.ingredient_id)))
  WHERE ((bo.id = builder_option_ingredients.builder_option_id) AND (i.restaurant_id = b.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners manage options" ON public."builder_options" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((builder_groups g
     JOIN builders b ON ((b.id = g.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((g.id = builder_options.group_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((builder_groups g
     JOIN builders b ON ((b.id = g.builder_id)))
     JOIN restaurants r ON ((r.id = b.restaurant_id)))
  WHERE ((g.id = builder_options.group_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Public can view options" ON public."builder_options" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (builder_groups g
     JOIN builders b ON ((b.id = g.builder_id)))
  WHERE ((g.id = builder_options.group_id) AND (b.is_active = true) AND private.is_builders_enabled(b.restaurant_id)))));

CREATE POLICY "Owners manage builders" ON public."builders" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = builders.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = builders.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Public can view active builders" ON public."builders" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((is_active = true) AND private.is_builders_enabled(restaurant_id)));

CREATE POLICY "Customer views own loyalty" ON public."customer_loyalty" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((customer_id = auth.uid()));

CREATE POLICY "Restaurant owner views loyalty" ON public."customer_loyalty" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = auth.uid()))));

CREATE POLICY "customers read own notifications" ON public."customer_notifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((customer_id = auth.uid()));

CREATE POLICY "customers update own notifications" ON public."customer_notifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((customer_id = auth.uid())) WITH CHECK ((customer_id = auth.uid()));

CREATE POLICY "Owners can delete own customers" ON public."customers" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = customers.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners can update own customers" ON public."customers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = customers.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = customers.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners can view own customers" ON public."customers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = customers.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners manage their ingredients" ON public."ingredients" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = ingredients.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = ingredients.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners manage inventory locations" ON public."inventory_locations" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = inventory_locations.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = inventory_locations.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Customer views own loyalty tx" ON public."loyalty_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((customer_id = auth.uid()));

CREATE POLICY "Owner views restaurant loyalty tx" ON public."loyalty_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = auth.uid()))));

CREATE POLICY "Owners manage categories" ON public."menu_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_categories.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_categories.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Public can view categories with active items" ON public."menu_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM menu_items mi
  WHERE ((mi.category_id = menu_categories.id) AND (mi.is_active = true) AND (COALESCE(mi.is_paused, false) = false) AND (COALESCE(mi.is_available, true) = true)))));

CREATE POLICY "Owners manage items" ON public."menu_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_items.restaurant_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM restaurants r
  WHERE ((r.id = menu_items.restaurant_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Public can view active items" ON public."menu_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((is_active = true) AND (COALESCE(is_paused, false) = false) AND (COALESCE(is_available, true) = true)));

CREATE POLICY "admins read platform_settings" ON public."platform_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update platform_settings" ON public."platform_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage their recipes" ON public."recipe_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = recipe_items.menu_item_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (menu_items mi
     JOIN restaurants r ON ((r.id = mi.restaurant_id)))
  WHERE ((mi.id = recipe_items.menu_item_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Owners manage stock movements" ON public."stock_movements" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (ingredients i
     JOIN restaurants r ON ((r.id = i.restaurant_id)))
  WHERE ((i.id = stock_movements.ingredient_id) AND (r.owner_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (ingredients i
     JOIN restaurants r ON ((r.id = i.restaurant_id)))
  WHERE ((i.id = stock_movements.ingredient_id) AND (r.owner_id = auth.uid())))));

CREATE POLICY "Suppliers readable by authenticated" ON public."suppliers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((active = true));

GRANT SELECT, INSERT, UPDATE, DELETE ON public."builder_groups" TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."builder_option_ingredients" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."builder_options" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."builders" TO authenticated;

GRANT SELECT ON public."customer_loyalty" TO authenticated;

GRANT SELECT, UPDATE ON public."customer_notifications" TO authenticated;

GRANT DELETE, UPDATE, SELECT ON public."customers" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."ingredients" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."inventory_locations" TO authenticated;

GRANT SELECT ON public."loyalty_transactions" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."menu_categories" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."menu_items" TO authenticated;

GRANT SELECT, UPDATE ON public."platform_settings" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."recipe_items" TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."stock_movements" TO authenticated;

GRANT SELECT ON public."suppliers" TO authenticated;

GRANT SELECT ON public."builder_groups" TO anon;

GRANT SELECT ON public."builder_options" TO anon;

GRANT SELECT ON public."builders" TO anon;

GRANT SELECT ON public."menu_categories" TO anon;

GRANT SELECT ON public."menu_items" TO anon;