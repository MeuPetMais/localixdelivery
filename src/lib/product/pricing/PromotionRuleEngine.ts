// Avalia se uma promoção é elegível dado o contexto do pedido.
// Regras puras — sem IO.
import type { Promotion, PromotionRule, PricingContext } from "./types";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function evalRule(rule: PromotionRule, ctx: PricingContext, subtotal: number, quantity: number): boolean {
  const v = rule.value ?? {};
  const now = ctx.now ?? new Date();
  switch (rule.rule_type) {
    case "time_window": {
      const start = (v.start as string) ?? "00:00";
      const end = (v.end as string) ?? "23:59";
      const cur = now.getHours() * 60 + now.getMinutes();
      const s = toMinutes(start);
      const e = toMinutes(end);
      return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e;
    }
    case "weekday": {
      const days = (v.days as number[]) ?? [];
      return days.length === 0 || days.includes(now.getDay());
    }
    case "channel": {
      const allowed = (v.channels as string[]) ?? [];
      if (allowed.length === 0) return true;
      return !!ctx.channel && (allowed.includes(ctx.channel) || allowed.includes("all"));
    }
    case "payment_method": {
      const methods = (v.methods as string[]) ?? [];
      return methods.length === 0 || (!!ctx.payment_method && methods.includes(ctx.payment_method));
    }
    case "category": {
      const ids = (v.ids as string[]) ?? [];
      return ids.length === 0 || ctx.lines.some((l) => l.category_id && ids.includes(l.category_id));
    }
    case "product": {
      const ids = (v.ids as string[]) ?? [];
      return ids.length === 0 || ctx.lines.some((l) => ids.includes(l.product_id));
    }
    case "customer": {
      const ids = (v.ids as string[]) ?? [];
      return ids.length === 0 || (!!ctx.customer_id && ids.includes(ctx.customer_id));
    }
    case "first_purchase":
      return !!ctx.is_first_purchase;
    case "min_subtotal":
      return subtotal >= Number(v.amount ?? 0);
    case "min_quantity":
      return quantity >= Number(v.quantity ?? 0);
    default:
      return true;
  }
}

export const PromotionRuleEngine = {
  isEligible(
    promotion: Promotion,
    ctx: PricingContext,
  ): { eligible: boolean; reason?: string } {
    const now = ctx.now ?? new Date();
    if (promotion.status !== "ACTIVE") return { eligible: false, reason: `status:${promotion.status}` };
    if (promotion.start_date && now < new Date(promotion.start_date))
      return { eligible: false, reason: "not_started" };
    if (promotion.end_date && now > new Date(promotion.end_date))
      return { eligible: false, reason: "expired" };
    if (promotion.channel && promotion.channel !== "all" && ctx.channel && promotion.channel !== ctx.channel)
      return { eligible: false, reason: "channel_mismatch" };

    if (promotion.code) {
      if (!ctx.coupon_code || ctx.coupon_code.toUpperCase() !== promotion.code.toUpperCase())
        return { eligible: false, reason: "coupon_missing" };
    }

    const subtotal = ctx.subtotal ?? ctx.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const quantity = ctx.lines.reduce((s, l) => s + l.quantity, 0);
    for (const r of promotion.rules ?? []) {
      if (!evalRule(r, ctx, subtotal, quantity)) {
        return { eligible: false, reason: `rule:${r.rule_type}` };
      }
    }
    return { eligible: true };
  },
};
