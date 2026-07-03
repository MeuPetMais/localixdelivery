// Executor — roda regras por categoria ou globais, com cache e logging opcional.
import type {
  BusinessRule,
  BusinessRuleCategory,
  BusinessRuleContext,
  BusinessRuleResult,
} from "./types";
import { BusinessRuleRegistry } from "./BusinessRuleRegistry";
import { RuleEventBus } from "./events";

export interface ExecuteOptions {
  stopOnCritical?: boolean; // default true
  logger?: (payload: {
    rule_code: string;
    result: BusinessRuleResult;
    execution_time_ms: number;
    ctx: BusinessRuleContext;
  }) => void | Promise<void>;
}

export interface AggregatedResult {
  allowed: boolean;
  results: BusinessRuleResult[];
  blockedBy?: BusinessRuleResult;
}

// Cache simples em memória (TTL curto) para reduzir custo em avaliações repetidas.
const cache = new Map<string, { at: number; result: BusinessRuleResult }>();
const CACHE_TTL_MS = 2000;

function cacheKey(rule: BusinessRule, ctx: BusinessRuleContext): string {
  return `${rule.id}::${JSON.stringify(ctx)}`;
}

export class BusinessRuleExecutor {
  constructor(private registry: BusinessRuleRegistry) {}

  async runRules(
    rules: BusinessRule[],
    ctx: BusinessRuleContext,
    opts: ExecuteOptions = {},
  ): Promise<AggregatedResult> {
    const stopOnCritical = opts.stopOnCritical ?? true;
    const results: BusinessRuleResult[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const key = cacheKey(rule, ctx);
      const cached = cache.get(key);
      let result: BusinessRuleResult;
      let elapsed = 0;
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        result = cached.result;
      } else {
        const started = Date.now();
        try {
          result = await rule.evaluate(ctx);
        } catch (err) {
          result = {
            allowed: false,
            rule_code: rule.id,
            severity: "critical",
            reason: `Erro ao avaliar regra: ${(err as Error).message}`,
          };
        }
        elapsed = Date.now() - started;
        cache.set(key, { at: Date.now(), result });
      }

      results.push(result);

      await RuleEventBus.publish("RuleExecuted", {
        rule_code: rule.id,
        category: rule.category,
        result,
        execution_time_ms: elapsed,
        occurred_at: new Date().toISOString(),
        context_ref: {
          order_id: ctx.order?.id ?? null,
          customer_id: ctx.customer?.id ?? null,
          restaurant_id: ctx.restaurant?.id ?? null,
        },
      });
      await RuleEventBus.publish(result.allowed ? "RulePassed" : "RuleRejected", {
        rule_code: rule.id,
        category: rule.category,
        result,
        execution_time_ms: elapsed,
        occurred_at: new Date().toISOString(),
        context_ref: {
          order_id: ctx.order?.id ?? null,
          customer_id: ctx.customer?.id ?? null,
          restaurant_id: ctx.restaurant?.id ?? null,
        },
      });

      if (opts.logger) {
        try {
          await opts.logger({ rule_code: rule.id, result, execution_time_ms: elapsed, ctx });
        } catch (err) {
          console.error("[BRE] logger falhou", err);
        }
      }

      if (!result.allowed) {
        if (result.severity === "critical" && stopOnCritical) {
          return { allowed: false, results, blockedBy: result };
        }
        return { allowed: false, results, blockedBy: result };
      }
    }

    return { allowed: true, results };
  }

  runCategory(
    category: BusinessRuleCategory,
    ctx: BusinessRuleContext,
    opts?: ExecuteOptions,
  ): Promise<AggregatedResult> {
    return this.runRules(this.registry.byCategory(category), ctx, opts);
  }

  runAll(ctx: BusinessRuleContext, opts?: ExecuteOptions): Promise<AggregatedResult> {
    const all = this.registry.all().filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
    return this.runRules(all, ctx, opts);
  }

  clearCache() {
    cache.clear();
  }
}
