import type { AISkillDefinition, AISkillKey } from "./types";

const REGISTRY: Record<AISkillKey, AISkillDefinition> = {
  restaurant_assistant: {
    key: "restaurant_assistant", name: "Assistente do Restaurante",
    description: "Responde sobre operação, catálogo, clientes e finanças.",
    domains: ["customer", "product", "finance", "analytics"],
    default_prompt: "restaurant_v1", requires_permission: "ai.assistant.restaurant",
  },
  financial_assistant: {
    key: "financial_assistant", name: "Assistente Financeiro",
    description: "Insights financeiros: fluxo de caixa, receitas, custos.",
    domains: ["finance", "analytics"],
    default_prompt: "financial_v1", requires_permission: "ai.assistant.finance",
  },
  product_assistant: {
    key: "product_assistant", name: "Assistente de Produtos",
    description: "Sugestões de curadoria e performance de produtos.",
    domains: ["product", "analytics"],
    default_prompt: "product_v1", requires_permission: "ai.assistant.product",
  },
  inventory_assistant: {
    key: "inventory_assistant", name: "Assistente de Estoque",
    description: "Alerta rupturas e sugere reposição.",
    domains: ["inventory", "product"],
    default_prompt: "inventory_v1", requires_permission: "ai.assistant.inventory",
  },
  marketing_assistant: {
    key: "marketing_assistant", name: "Assistente de Marketing",
    description: "Recomenda campanhas, segmentos e automações.",
    domains: ["customer", "marketing", "analytics"],
    default_prompt: "marketing_v1", requires_permission: "ai.assistant.marketing",
  },
  operational_assistant: {
    key: "operational_assistant", name: "Assistente Operacional",
    description: "SLA de cozinha e entregas.",
    domains: ["delivery", "analytics"],
    default_prompt: "operational_v1", requires_permission: "ai.assistant.operations",
  },
  admin_assistant: {
    key: "admin_assistant", name: "Assistente Administrativo",
    description: "Uso restrito à administração da plataforma.",
    domains: ["analytics", "platform"],
    default_prompt: "admin_v1", requires_permission: "ai.assistant.admin",
  },
};

export const AISkillRegistry = {
  list(): AISkillDefinition[] { return Object.values(REGISTRY); },
  get(key: AISkillKey): AISkillDefinition {
    const d = REGISTRY[key];
    if (!d) throw new Error(`Unknown skill: ${key}`);
    return d;
  },
} as const;
