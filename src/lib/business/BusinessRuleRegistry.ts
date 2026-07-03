// Registry central — permite adicionar/remover regras sem alterar código existente.
import type { BusinessRule, BusinessRuleCategory } from "./types";

export class BusinessRuleRegistry {
  private rules = new Map<string, BusinessRule>();

  register(rule: BusinessRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Regra duplicada: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
  }

  unregister(id: string): void {
    this.rules.delete(id);
  }

  get(id: string): BusinessRule | undefined {
    return this.rules.get(id);
  }

  all(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  byCategory(category: BusinessRuleCategory): BusinessRule[] {
    return this.all()
      .filter((r) => r.category === category && r.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  setEnabled(id: string, enabled: boolean): void {
    const r = this.rules.get(id);
    if (r) r.enabled = enabled;
  }

  clear(): void {
    this.rules.clear();
  }
}

// Instância global padrão. Consumidores podem criar instâncias próprias em testes.
export const globalRuleRegistry = new BusinessRuleRegistry();
