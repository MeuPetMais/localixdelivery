import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CatalogValidator } from "./CatalogValidator";
import { CatalogEventBus } from "./CatalogEventBus";
import type { CatalogChannel, CatalogMenu, CatalogMenuCategory, CatalogMenuProduct, CatalogMenuStatus } from "./types";

/**
 * CatalogService — server functions for the Catalog Engine.
 * Orchestrates catalog_menus / catalog_menu_categories / catalog_menu_products.
 * Reuses existing menu_categories and menu_items — never mutates them.
 */

const OwnerScope = z.object({ restaurantId: z.string().uuid() });

async function assertOwner(context: { supabase: any; userId: string }, restaurantId: string) {
  const { data, error } = await context.supabase
    .from("restaurants")
    .select("id, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.owner_id !== context.userId) throw new Error("Forbidden: restaurant scope");
}

async function logEvent(supabase: any, params: {
  restaurantId: string; menuId?: string | null; type: string; payload?: Record<string, unknown>; actorId: string;
}) {
  await supabase.from("catalog_events").insert({
    restaurant_id: params.restaurantId,
    menu_id: params.menuId ?? null,
    event_type: params.type,
    payload: params.payload ?? {},
    actor_id: params.actorId,
  });
}

// ---------- Menus ----------
export const listMenus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; channel?: CatalogChannel; status?: CatalogMenuStatus }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    let q = context.supabase.from("catalog_menus").select("*").eq("restaurant_id", data.restaurantId);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("display_order").order("created_at");
    if (error) throw error;
    return (rows ?? []) as CatalogMenu[];
  });

export const createMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    restaurantId: string;
    name: string;
    channel: CatalogChannel;
    description?: string | null;
    is_default?: boolean;
    display_order?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const v = CatalogValidator.validateMenu({ name: data.name, channel: data.channel });
    if (!v.ok) throw new Error(v.issues.map((i) => i.message).join("; "));

    const { data: row, error } = await context.supabase
      .from("catalog_menus")
      .insert({
        restaurant_id: data.restaurantId,
        name: data.name,
        channel: data.channel,
        description: data.description ?? null,
        is_default: data.is_default ?? false,
        display_order: data.display_order ?? 0,
        status: "draft",
      })
      .select("*").single();
    if (error) throw error;

    await logEvent(context.supabase, {
      restaurantId: data.restaurantId, menuId: row.id, type: "MenuCreated", actorId: context.userId,
    });
    await CatalogEventBus.publish({ type: "MenuCreated", menuId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    return row as CatalogMenu;
  });

export const updateMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; restaurantId: string; patch: Partial<CatalogMenu> }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const v = CatalogValidator.validateMenu(data.patch);
    if (!v.ok) throw new Error(v.issues.map((i) => i.message).join("; "));
    const { data: row, error } = await context.supabase
      .from("catalog_menus")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("restaurant_id", data.restaurantId)
      .select("*").single();
    if (error) throw error;
    await logEvent(context.supabase, {
      restaurantId: data.restaurantId, menuId: row.id, type: "CatalogUpdated",
      payload: { fields: Object.keys(data.patch) }, actorId: context.userId,
    });
    await CatalogEventBus.publish({
      type: "CatalogUpdated", restaurantId: data.restaurantId, menuId: row.id,
      changes: data.patch as Record<string, unknown>, at: new Date().toISOString(),
    });
    return row as CatalogMenu;
  });

export const setMenuStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; restaurantId: string; to: CatalogMenuStatus }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: current, error: e1 } = await context.supabase
      .from("catalog_menus").select("*").eq("id", data.id).eq("restaurant_id", data.restaurantId).single();
    if (e1) throw e1;
    CatalogValidator.assertTransition(current.status as CatalogMenuStatus, data.to);
    const { data: row, error } = await context.supabase
      .from("catalog_menus").update({ status: data.to, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("restaurant_id", data.restaurantId).select("*").single();
    if (error) throw error;
    await logEvent(context.supabase, {
      restaurantId: data.restaurantId, menuId: row.id, type: "MenuStatusChanged",
      payload: { from: current.status, to: data.to }, actorId: context.userId,
    });
    await CatalogEventBus.publish({
      type: "MenuStatusChanged", menuId: row.id, restaurantId: data.restaurantId,
      from: current.status as CatalogMenuStatus, to: data.to, at: new Date().toISOString(),
    });
    if (data.to === "published")
      await CatalogEventBus.publish({ type: "MenuPublished", menuId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    if (data.to === "archived")
      await CatalogEventBus.publish({ type: "MenuArchived", menuId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    return row as CatalogMenu;
  });

// ---------- Categories inside menu ----------
export const attachCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; menuId: string; categoryId: string; display_order?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: row, error } = await context.supabase
      .from("catalog_menu_categories")
      .insert({
        menu_id: data.menuId,
        category_id: data.categoryId,
        restaurant_id: data.restaurantId,
        display_order: data.display_order ?? 0,
      })
      .select("*").single();
    if (error) throw error;
    await CatalogEventBus.publish({
      type: "CategoryCreated", menuId: data.menuId, categoryId: data.categoryId,
      restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return row as CatalogMenuCategory;
  });

export const detachCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; menuId: string; categoryId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { error } = await context.supabase
      .from("catalog_menu_categories").delete()
      .eq("restaurant_id", data.restaurantId)
      .eq("menu_id", data.menuId).eq("category_id", data.categoryId);
    if (error) throw error;
    await CatalogEventBus.publish({
      type: "CategoryRemoved", menuId: data.menuId, categoryId: data.categoryId,
      restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return { ok: true };
  });

// ---------- Products inside menu ----------
export const attachProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; menuId: string; productId: string; display_order?: number; is_featured?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: row, error } = await context.supabase
      .from("catalog_menu_products")
      .insert({
        menu_id: data.menuId,
        product_id: data.productId,
        restaurant_id: data.restaurantId,
        display_order: data.display_order ?? 0,
        is_featured: data.is_featured ?? false,
      })
      .select("*").single();
    if (error) throw error;
    await CatalogEventBus.publish({
      type: "ProductAttached", menuId: data.menuId, productId: data.productId,
      restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return row as CatalogMenuProduct;
  });

export const detachProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; menuId: string; productId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { error } = await context.supabase
      .from("catalog_menu_products").delete()
      .eq("restaurant_id", data.restaurantId)
      .eq("menu_id", data.menuId).eq("product_id", data.productId);
    if (error) throw error;
    await CatalogEventBus.publish({
      type: "ProductDetached", menuId: data.menuId, productId: data.productId,
      restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const featureProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; menuId: string; productId: string; is_featured: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: row, error } = await context.supabase
      .from("catalog_menu_products")
      .update({ is_featured: data.is_featured, updated_at: new Date().toISOString() })
      .eq("restaurant_id", data.restaurantId)
      .eq("menu_id", data.menuId).eq("product_id", data.productId)
      .select("*").single();
    if (error) throw error;
    if (data.is_featured) {
      await CatalogEventBus.publish({
        type: "ProductFeatured", menuId: data.menuId, productId: data.productId,
        restaurantId: data.restaurantId, at: new Date().toISOString(),
      });
    }
    return row as CatalogMenuProduct;
  });

// ---------- Read side ----------
export const listMenuCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.extend({ menuId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("catalog_menu_categories").select("*").eq("menu_id", data.menuId)
      .order("display_order");
    if (error) throw error;
    return (rows ?? []) as CatalogMenuCategory[];
  });

export const listMenuProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.extend({ menuId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("catalog_menu_products").select("*").eq("menu_id", data.menuId)
      .order("display_order");
    if (error) throw error;
    return (rows ?? []) as CatalogMenuProduct[];
  });

export const getCatalogHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const [menus, cats, prods] = await Promise.all([
      context.supabase.from("catalog_menus").select("id,status,channel").eq("restaurant_id", data.restaurantId),
      context.supabase.from("catalog_menu_categories").select("id,is_visible").eq("restaurant_id", data.restaurantId),
      context.supabase.from("catalog_menu_products").select("id,is_featured,is_visible").eq("restaurant_id", data.restaurantId),
    ]);
    const m = (menus.data ?? []) as Array<{ status: string; channel: string }>;
    const c = (cats.data ?? []) as Array<{ is_visible: boolean }>;
    const p = (prods.data ?? []) as Array<{ is_featured: boolean; is_visible: boolean }>;
    return {
      menus: {
        total: m.length,
        published: m.filter((x) => x.status === "published").length,
        draft: m.filter((x) => x.status === "draft").length,
        archived: m.filter((x) => x.status === "archived").length,
        byChannel: m.reduce<Record<string, number>>((acc, x) => { acc[x.channel] = (acc[x.channel] ?? 0) + 1; return acc; }, {}),
      },
      categoriesInMenus: { total: c.length, hidden: c.filter((x) => !x.is_visible).length },
      productsInMenus: {
        total: p.length,
        featured: p.filter((x) => x.is_featured).length,
        hidden: p.filter((x) => !x.is_visible).length,
      },
    };
  });
