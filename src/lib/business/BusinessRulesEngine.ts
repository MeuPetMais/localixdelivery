// Facade principal do Business Rules Engine.
// Consumidores (Checkout, OrderOrchestrator, Split, PaymentService) devem
// consultar `BusinessRulesEngine.evaluate(...)` — nunca hardcodar regras.

import type {
  BusinessRuleCategory,
  BusinessRuleContext,
  BusinessRuleResult,
} from "./types";
import { BusinessRuleRegistry, globalRuleRegistry } from "./BusinessRuleRegistry";
import { BusinessRuleExecutor, type AggregatedResult } from "./BusinessRuleExecutor";
import { registerDefaultRules } from "./rules";

registerDefaultRules(globalRuleRegistry);

export interface EngineDecision {
  allowed: boolean;
  reason?: string;
  rule_code?: string;
  severity?: BusinessRuleResult["severity"];
  results: BusinessRuleResult[];
}

export class BusinessRulesEngine {
  readonly registry: BusinessRuleRegistry;
  readonly executor: BusinessRuleExecutor;

  constructor(registry: BusinessRuleRegistry = globalRuleRegistry) {
    this.registry = registry;
    this.executor = new BusinessRuleExecutor(registry);
  }

  async evaluate(
    category: BusinessRuleCategory,
    ctx: BusinessRuleContext,
  ): Promise<EngineDecision> {
    const r = await this.executor.runCategory(category, ctx);
    return toDecision(r);
  }

  async evaluateAll(ctx: BusinessRuleContext): Promise<EngineDecision> {
    const r = await this.executor.runAll(ctx);
    return toDecision(r);
  }
}

function toDecision(r: AggregatedResult): EngineDecision {
  if (r.allowed) return { allowed: true, results: r.results };
  return {
    allowed: false,
    reason: r.blockedBy?.reason,
    rule_code: r.blockedBy?.rule_code,
    severity: r.blockedBy?.severity,
    results: r.results,
  };
}

// Singleton conveniente.
export const businessRulesEngine = new BusinessRulesEngine();
