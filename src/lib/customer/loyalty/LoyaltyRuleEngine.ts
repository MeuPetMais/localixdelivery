import type { LoyaltyAccrual, LoyaltyContext, LoyaltyRule } from "./types";

/**
 * LoyaltyRuleEngine — pure. Evaluates configurable rules and computes
 * points/cashback for a given order context. Does NOT persist anything.
 */
export const LoyaltyRuleEngine = {
  isEligible(rule: LoyaltyRule, ctx: LoyaltyContext): boolean {
    if (!rule.active) return false;
    const now = ctx.today ?? new Date();
    if (rule.starts_at && new Date(rule.starts_at) > now) return false;
    if (rule.ends_at && new Date(rule.ends_at) < now) return false;
    if (rule.min_order != null && ctx.order_total < rule.min_order) return false;
    if (rule.max_order != null && ctx.order_total > rule.max_order) return false;
    return true;
  },

  computeRule(rule: LoyaltyRule, ctx: LoyaltyContext): { points: number; cashback: number } {
    if (!LoyaltyRuleEngine.isEligible(rule, ctx)) return { points: 0, cashback: 0 };
    const cfg = rule.config ?? {};
    const n = (v: unknown, def = 0) => (typeof v === "number" ? v : def);

    switch (rule.rule_type) {
      case "POINTS_PER_ORDER":
        return { points: n(cfg.points), cashback: 0 };

      case "POINTS_PER_AMOUNT": {
        const per = n(cfg.per_amount, 1) || 1;
        const points = n(cfg.points, 1);
        return { points: Math.floor(ctx.order_total / per) * points, cashback: 0 };
      }

      case "POINTS_PER_CATEGORY": {
        const catId = cfg.category_id as string | undefined;
        const points = n(cfg.points);
        const total = (ctx.items ?? [])
          .filter((i) => i.category_id === catId)
          .reduce((s, i) => s + i.qty, 0);
        return { points: total * points, cashback: 0 };
      }

      case "POINTS_PER_PRODUCT": {
        const pid = cfg.product_id as string | undefined;
        const points = n(cfg.points);
        const qty = (ctx.items ?? []).filter((i) => i.product_id === pid).reduce((s, i) => s + i.qty, 0);
        return { points: qty * points, cashback: 0 };
      }

      case "CASHBACK_PERCENT": {
        const pct = n(cfg.percent);
        const cap = cfg.max_cashback != null ? n(cfg.max_cashback) : Infinity;
        const raw = Math.max(0, (ctx.order_total * pct) / 100);
        return { points: 0, cashback: Math.min(raw, cap) };
      }

      case "FIRST_PURCHASE_BONUS":
        return ctx.is_first_purchase
          ? { points: n(cfg.points), cashback: n(cfg.cashback) }
          : { points: 0, cashback: 0 };

      case "BIRTHDAY_BONUS": {
        if (!ctx.customer_birthday) return { points: 0, cashback: 0 };
        const b = new Date(ctx.customer_birthday);
        const t = ctx.today ?? new Date();
        return b.getUTCMonth() === t.getUTCMonth() && b.getUTCDate() === t.getUTCDate()
          ? { points: n(cfg.points), cashback: n(cfg.cashback) }
          : { points: 0, cashback: 0 };
      }

      case "SPECIAL_DATE": {
        const date = cfg.date as string | undefined;
        if (!date) return { points: 0, cashback: 0 };
        const t = ctx.today ?? new Date();
        const target = new Date(date);
        return target.toDateString() === t.toDateString()
          ? { points: n(cfg.points), cashback: n(cfg.cashback) }
          : { points: 0, cashback: 0 };
      }

      default:
        return { points: 0, cashback: 0 };
    }
  },

  compute(rules: LoyaltyRule[], ctx: LoyaltyContext): LoyaltyAccrual {
    const applied: LoyaltyAccrual["applied_rules"] = [];
    let points = 0;
    let cashback = 0;
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    for (const rule of sorted) {
      const r = LoyaltyRuleEngine.computeRule(rule, ctx);
      if (r.points > 0 || r.cashback > 0) {
        points += r.points;
        cashback += r.cashback;
        applied.push({ rule_id: rule.id, rule_type: rule.rule_type, points: r.points, cashback: r.cashback });
      }
    }
    return { points, cashback: Math.round(cashback * 100) / 100, applied_rules: applied };
  },
} as const;
