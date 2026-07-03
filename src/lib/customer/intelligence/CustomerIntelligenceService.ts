import { supabase } from "@/integrations/supabase/client";
import { CustomerAnalyticsService } from "./CustomerAnalyticsService";
import { CustomerScoreService } from "./CustomerScoreService";
import { CustomerSegmentationService } from "./CustomerSegmentationService";
import { CustomerRecommendationService } from "./CustomerRecommendationService";
import { IntelligenceEventBus } from "./IntelligenceEventBus";
import type {
  CustomerAnalytics,
  CustomerInsightRecord,
  CustomerInsightType,
  CustomerInsightSeverity,
  CustomerRecommendation,
  CustomerScore,
  CustomerSegment,
  CustomerSegmentRecord,
} from "./types";

const SEG = () => (supabase as any).from("customer_segments");
const INS = () => (supabase as any).from("customer_insights");
const LOY = () => (supabase as any).from("customer_loyalty");

/**
 * CustomerIntelligenceService — facade orchestrating analytics, scoring,
 * segmentation, insights and recommendations. Never duplicates calc logic;
 * delegates to pure services above.
 */
export const CustomerIntelligenceService = {
  analytics: CustomerAnalyticsService,
  score: CustomerScoreService,
  segmentation: CustomerSegmentationService,
  recommendations: CustomerRecommendationService,

  /** Full snapshot for a single customer × restaurant. */
  async snapshot(customerId: string, restaurantId: string): Promise<{
    analytics: CustomerAnalytics;
    score: CustomerScore;
    segment: CustomerSegment;
    tags: CustomerSegment[];
    recommendations: CustomerRecommendation[];
  }> {
    const analytics = await CustomerAnalyticsService.forCustomer(customerId, restaurantId);
    const { data: loy } = await LOY()
      .select("balance,total_earned,current_level_id")
      .eq("customer_id", customerId).eq("restaurant_id", restaurantId).maybeSingle();
    const score = CustomerScoreService.compute(analytics, {
      loyaltyPoints: Number(loy?.balance ?? 0),
      loyaltyLevelRank: loy?.current_level_id ? 2 : 0,
    });
    const seg = CustomerSegmentationService.resolve(analytics, score);
    const recs = CustomerRecommendationService.recommend(analytics, score, seg.primary);
    return { analytics, score, segment: seg.primary, tags: seg.tags, recommendations: recs };
  },

  /** Persist segment + emit event. */
  async persistSegment(input: {
    restaurantId: string; customerId: string; segment: CustomerSegment;
    score: number; reason?: string; metadata?: Record<string, unknown>;
  }): Promise<CustomerSegmentRecord> {
    const row = {
      restaurant_id: input.restaurantId,
      customer_id: input.customerId,
      segment: input.segment,
      score: input.score,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
      generated_at: new Date().toISOString(),
    };
    const { data, error } = await SEG()
      .upsert(row, { onConflict: "restaurant_id,customer_id" })
      .select().maybeSingle();
    if (error) throw error;
    await IntelligenceEventBus.publish({
      type: "CustomerSegmentUpdated",
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      segment: input.segment,
      at: new Date().toISOString(),
    });
    return data as CustomerSegmentRecord;
  },

  /** Persist insight + emit event. */
  async createInsight(input: {
    restaurantId: string; customerId: string; type: CustomerInsightType;
    severity?: CustomerInsightSeverity; title: string; description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CustomerInsightRecord> {
    const { data, error } = await INS().insert({
      restaurant_id: input.restaurantId,
      customer_id: input.customerId,
      insight_type: input.type,
      severity: input.severity ?? "info",
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    }).select().maybeSingle();
    if (error) throw error;
    const insight = data as CustomerInsightRecord;
    await IntelligenceEventBus.publish({
      type: "CustomerInsightGenerated", insight, at: new Date().toISOString(),
    });
    return insight;
  },

  /** Generate rule-based insights from a snapshot without persisting. */
  buildInsights(
    restaurantId: string,
    customerId: string,
    analytics: CustomerAnalytics,
    score: CustomerScore,
    segment: CustomerSegment,
  ): Array<Omit<CustomerInsightRecord, "id" | "generated_at" | "acknowledged_at">> {
    const out: Array<Omit<CustomerInsightRecord, "id" | "generated_at" | "acknowledged_at">> = [];
    const base = { restaurant_id: restaurantId, customer_id: customerId, metadata: {} as Record<string, unknown> };

    if (analytics.total_orders === 0) {
      out.push({ ...base, insight_type: "NO_PURCHASE", severity: "info",
        title: "Cliente ainda não comprou", description: "Cadastrado mas sem pedidos." });
    }
    if (segment === "VIP" && analytics.days_since_last_order > 30) {
      out.push({ ...base, insight_type: "VIP_INACTIVE", severity: "critical",
        title: "Cliente VIP inativo",
        description: `Sem comprar há ${analytics.days_since_last_order} dias.` });
    }
    if (segment === "AT_RISK") {
      out.push({ ...base, insight_type: "AT_RISK", severity: "warning",
        title: "Cliente em risco",
        description: `Frequência caiu; última compra há ${analytics.days_since_last_order} dias.` });
    }
    if (score.breakdown.frequency < 30 && analytics.total_orders >= 3) {
      out.push({ ...base, insight_type: "FREQUENCY_DROP", severity: "warning",
        title: "Queda de frequência",
        description: "Frequência mensal abaixo do esperado." });
    }
    if (analytics.favorite_categories[0]) {
      const c = analytics.favorite_categories[0];
      out.push({
        ...base, insight_type: "FAVORITE_CATEGORY", severity: "info",
        title: `Categoria favorita: ${c.name ?? c.category_id}`,
        description: `${c.qty} itens dessa categoria.`,
        metadata: { category_id: c.category_id, qty: c.qty },
      });
    }
    return out;
  },

  /** Aggregate dashboard for a restaurant. */
  async restaurantOverview(restaurantId: string): Promise<{
    total: number;
    by_segment: Record<CustomerSegment, number>;
    avg_score: number;
    high_risk: number;
  }> {
    const { data, error } = await SEG()
      .select("segment,score")
      .eq("restaurant_id", restaurantId);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ segment: CustomerSegment; score: number }>;
    const by_segment = {
      NEW: 0, ACTIVE: 0, LOYAL: 0, VIP: 0, AT_RISK: 0, INACTIVE: 0, HIGH_VALUE: 0, LOW_VALUE: 0,
    } as Record<CustomerSegment, number>;
    let sum = 0; let high = 0;
    for (const r of rows) {
      if (r.segment in by_segment) by_segment[r.segment]++;
      sum += Number(r.score ?? 0);
      if (r.segment === "AT_RISK" || r.segment === "INACTIVE") high++;
    }
    return {
      total: rows.length,
      by_segment,
      avg_score: rows.length ? Math.round(sum / rows.length) : 0,
      high_risk: high,
    };
  },
} as const;
