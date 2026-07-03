import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProductInsight, ProductRecommendation } from "./types";

export const listProductInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurant_id: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("product_insights" as any)
      .select("*")
      .eq("restaurant_id", data.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any;
  });

export const listProductRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { restaurant_id: string; type?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("product_recommendations" as any)
      .select("*")
      .eq("restaurant_id", data.restaurant_id)
      .order("score", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.type) q = q.eq("recommendation_type", data.type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any;
  });

export const persistIntelligenceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      restaurant_id: string;
      insights: ProductInsight[];
      recommendations: ProductRecommendation[];
      replace?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    if (data.replace) {
      await context.supabase.from("product_insights" as any).delete().eq("restaurant_id", data.restaurant_id);
      await context.supabase
        .from("product_recommendations" as any)
        .delete()
        .eq("restaurant_id", data.restaurant_id);
    }
    if (data.insights.length) {
      const { error } = await context.supabase
        .from("product_insights" as any)
        .insert(data.insights.map((i) => ({ ...i, restaurant_id: data.restaurant_id })) as any);
      if (error) throw new Error(error.message);
    }
    if (data.recommendations.length) {
      const { error } = await context.supabase
        .from("product_recommendations" as any)
        .insert(
          data.recommendations.map((r) => ({ ...r, restaurant_id: data.restaurant_id })) as any,
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true, insights: data.insights.length, recommendations: data.recommendations.length };
  });
