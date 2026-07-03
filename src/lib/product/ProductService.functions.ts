import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ProductValidator } from "./ProductValidator";
import { ProductLifecycle } from "./ProductLifecycle";
import { ProductEventBus } from "./ProductEventBus";
import type { ProductLifecycleStatus, ProductRecord } from "./types";

/**
 * ProductService — server functions.
 * Reuses the existing `menu_items` table (source of truth) and adds:
 *   - product_versions (immutable audit trail)
 *   - product_audit    (who did what)
 *
 * Does NOT touch Inventory / Recipe / Cost / Pricing / Checkout / Orders.
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

async function nextVersionNumber(supabase: any, productId: string): Promise<number> {
  const { data, error } = await supabase
    .from("product_versions")
    .select("version")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.version ?? 0) + 1;
}

async function writeAudit(supabase: any, params: {
  productId: string; restaurantId: string; actorId: string; action: string; payload?: Record<string, unknown>;
}) {
  await supabase.from("product_audit").insert({
    product_id: params.productId,
    restaurant_id: params.restaurantId,
    actor_id: params.actorId,
    action: params.action,
    payload: params.payload ?? {},
  });
}

async function writeVersion(supabase: any, params: {
  productId: string; restaurantId: string; status: ProductLifecycleStatus; actorId: string; changes: Record<string, unknown>;
}) {
  const version = await nextVersionNumber(supabase, params.productId);
  await supabase.from("product_versions").insert({
    product_id: params.productId,
    restaurant_id: params.restaurantId,
    version,
    status: params.status,
    changes_json: params.changes,
    created_by: params.actorId,
  });
  return version;
}

// ---------- Create ----------
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    restaurantId: string;
    name: string;
    price: number;
    categoryId?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const validation = ProductValidator.validate({ name: data.name, price: data.price });
    if (!validation.ok) throw new Error(validation.issues.map((i) => i.message).join("; "));

    const { data: row, error } = await context.supabase
      .from("menu_items")
      .insert({
        restaurant_id: data.restaurantId,
        name: data.name,
        price: data.price,
        category_id: data.categoryId ?? null,
        description: data.description ?? null,
        image_url: data.imageUrl ?? null,
        is_active: true,
        is_available: true,
        is_paused: true, // DRAFT
      })
      .select("*")
      .single();
    if (error) throw error;

    const status: ProductLifecycleStatus = "DRAFT";
    await writeVersion(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, status, actorId: context.userId,
      changes: { created: true, snapshot: row },
    });
    await writeAudit(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, actorId: context.userId, action: "product.created",
    });
    await ProductEventBus.publish({
      type: "ProductCreated", productId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return row as ProductRecord;
  });

// ---------- Update ----------
export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; restaurantId: string; patch: Partial<ProductRecord> }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const validation = ProductValidator.validate(data.patch);
    if (!validation.ok) throw new Error(validation.issues.map((i) => i.message).join("; "));

    const { data: row, error } = await context.supabase
      .from("menu_items")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("restaurant_id", data.restaurantId)
      .select("*")
      .single();
    if (error) throw error;

    const status = ProductLifecycle.fromRecord(row);
    await writeVersion(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, status, actorId: context.userId, changes: data.patch as Record<string, unknown>,
    });
    await writeAudit(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, actorId: context.userId, action: "product.updated",
      payload: { fields: Object.keys(data.patch) },
    });
    await ProductEventBus.publish({
      type: "ProductUpdated", productId: row.id, restaurantId: data.restaurantId, changes: data.patch as Record<string, unknown>, at: new Date().toISOString(),
    });
    return row as ProductRecord;
  });

// ---------- Transition (publish / pause / archive / discontinue) ----------
export const transitionProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; restaurantId: string; to: ProductLifecycleStatus }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);

    const { data: current, error: e1 } = await context.supabase
      .from("menu_items").select("*").eq("id", data.id).eq("restaurant_id", data.restaurantId).single();
    if (e1) throw e1;
    const from = ProductLifecycle.fromRecord(current);
    ProductLifecycle.assertTransition(from, data.to);

    const flags = ProductLifecycle.toFlags(data.to);
    const { data: row, error } = await context.supabase
      .from("menu_items").update({ ...flags, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("restaurant_id", data.restaurantId).select("*").single();
    if (error) throw error;

    await writeVersion(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, status: data.to, actorId: context.userId,
      changes: { transition: { from, to: data.to } },
    });
    await writeAudit(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, actorId: context.userId,
      action: `product.transition.${data.to.toLowerCase()}`,
      payload: { from, to: data.to },
    });
    await ProductEventBus.publish({
      type: "LifecycleChanged", productId: row.id, restaurantId: data.restaurantId, from, to: data.to, at: new Date().toISOString(),
    });
    if (data.to === "PUBLISHED") await ProductEventBus.publish({ type: "ProductPublished", productId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    if (data.to === "ARCHIVED") await ProductEventBus.publish({ type: "ProductArchived", productId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    if (data.to === "DISCONTINUED") await ProductEventBus.publish({ type: "ProductDiscontinued", productId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString() });
    return row as ProductRecord;
  });

// ---------- Duplicate ----------
export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; restaurantId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: src, error: e1 } = await context.supabase
      .from("menu_items").select("*").eq("id", data.id).eq("restaurant_id", data.restaurantId).single();
    if (e1) throw e1;
    const { id: _drop, created_at: _c, updated_at: _u, ...rest } = src;
    const { data: row, error } = await context.supabase
      .from("menu_items")
      .insert({ ...rest, name: `${src.name} (cópia)`, is_paused: true })
      .select("*").single();
    if (error) throw error;

    await writeVersion(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, status: "DRAFT", actorId: context.userId,
      changes: { duplicatedFrom: src.id, snapshot: row },
    });
    await writeAudit(context.supabase, {
      productId: row.id, restaurantId: data.restaurantId, actorId: context.userId, action: "product.duplicated",
      payload: { source: src.id },
    });
    await ProductEventBus.publish({
      type: "ProductCreated", productId: row.id, restaurantId: data.restaurantId, at: new Date().toISOString(),
    });
    return row as ProductRecord;
  });

// ---------- Registry / read side ----------
export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string; status?: ProductLifecycleStatus; categoryId?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    let q = context.supabase.from("menu_items").select("*").eq("restaurant_id", data.restaurantId);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows, error } = await q.order("position").order("created_at");
    if (error) throw error;
    const list = (rows ?? []) as ProductRecord[];
    if (!data.status) return list;
    return list.filter((p) => ProductLifecycle.fromRecord(p) === data.status);
  });

export const listProductVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.extend({ productId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("product_versions").select("*")
      .eq("product_id", data.productId)
      .order("version", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listProductAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.extend({ productId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("product_audit").select("*")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return rows ?? [];
  });

export const getProductHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(OwnerScope.parse)
  .handler(async ({ data, context }) => {
    await assertOwner(context, data.restaurantId);
    const { data: rows, error } = await context.supabase
      .from("menu_items")
      .select("id,name,is_active,is_paused,is_available,image_url,category_id")
      .eq("restaurant_id", data.restaurantId);
    if (error) throw error;
    const list = (rows ?? []) as Array<Pick<ProductRecord, "id" | "name" | "is_active" | "is_paused" | "is_available" | "image_url" | "category_id">>;
    return {
      total: list.length,
      published: list.filter((p) => p.is_active && !p.is_paused).length,
      paused: list.filter((p) => p.is_active && p.is_paused).length,
      archived: list.filter((p) => !p.is_active).length,
      withoutImage: list.filter((p) => !p.image_url).length,
      unavailable: list.filter((p) => !p.is_available).length,
      withoutCategory: list.filter((p) => !p.category_id).length,
    };
  });
