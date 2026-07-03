import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProductOption, ProductOptionGroup } from "./types";

export const listConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: groups, error: gErr } = await supabase
      .from("product_option_groups")
      .select("*")
      .eq("product_id", data.product_id)
      .order("display_order");
    if (gErr) throw gErr;
    const groupIds = ((groups ?? []) as Array<{ id: string }>).map((g) => g.id);
    let options: unknown[] = [];
    if (groupIds.length) {
      const { data: opts, error: oErr } = await supabase
        .from("product_options")
        .select("*")
        .in("group_id", groupIds)
        .order("display_order");
      if (oErr) throw oErr;
      options = opts ?? [];
    }
    return {
      groups: (groups ?? []) as unknown as ProductOptionGroup[],
      options: options as unknown as ProductOption[],
    } as { groups: ProductOptionGroup[]; options: ProductOption[] };
  });

export const upsertGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: Partial<ProductOptionGroup> & { product_id: string; name: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("product_option_groups")
      .upsert(data as never)
      .select()
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const upsertOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: Partial<ProductOption> & { group_id: string; name: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("product_options")
      .upsert(data as never)
      .select()
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_option_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_options")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
