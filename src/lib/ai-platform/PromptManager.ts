import type { AIPromptTemplate, AISkillKey } from "./types";

const BUILTIN: AIPromptTemplate[] = [
  { id: "restaurant_v1", skill: "restaurant_assistant", version: 1, active: true,
    system: "Você é o assistente do restaurante {{restaurant_name}}. Idioma: {{locale}}.",
    user: "Contexto:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["restaurant_name", "locale", "context", "question"], created_at: new Date().toISOString() },
  { id: "financial_v1", skill: "financial_assistant", version: 1, active: true,
    system: "Você é um assistente financeiro. Analise KPIs e apresente insights acionáveis.",
    user: "KPIs:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
  { id: "product_v1", skill: "product_assistant", version: 1, active: true,
    system: "Você é especialista em catálogo e produtos.",
    user: "Produtos:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
  { id: "inventory_v1", skill: "inventory_assistant", version: 1, active: true,
    system: "Você é assistente de estoque. Alerta rupturas e sugere reposição.",
    user: "Estoque:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
  { id: "marketing_v1", skill: "marketing_assistant", version: 1, active: true,
    system: "Você é assistente de marketing e engajamento de clientes.",
    user: "Contexto:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
  { id: "operational_v1", skill: "operational_assistant", version: 1, active: true,
    system: "Você é assistente operacional (cozinha, entregas, SLA).",
    user: "Operação:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
  { id: "admin_v1", skill: "admin_assistant", version: 1, active: true,
    system: "Você é assistente administrativo da plataforma Localix.",
    user: "Contexto:\n{{context}}\n\nPergunta: {{question}}",
    variables: ["context", "question"], created_at: new Date().toISOString() },
];

const store = new Map<string, AIPromptTemplate>(BUILTIN.map((t) => [t.id, t]));
const history: AIPromptTemplate[] = [];
let seq = 0;

function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  });
}

export const PromptManager = {
  list(skill?: AISkillKey): AIPromptTemplate[] {
    const rows = [...store.values()];
    return skill ? rows.filter((t) => t.skill === skill) : rows;
  },
  active(skill: AISkillKey): AIPromptTemplate | null {
    return [...store.values()].filter((t) => t.skill === skill && t.active)
      .sort((a, b) => b.version - a.version)[0] ?? null;
  },
  get(id: string): AIPromptTemplate | null { return store.get(id) ?? null; },

  register(input: Omit<AIPromptTemplate, "id" | "version" | "created_at" | "active"> & { active?: boolean }): AIPromptTemplate {
    const prev = [...store.values()].filter((t) => t.skill === input.skill);
    const version = prev.length ? Math.max(...prev.map((t) => t.version)) + 1 : 1;
    if (input.active !== false) {
      for (const p of prev) if (p.active) store.set(p.id, { ...p, active: false });
    }
    const tpl: AIPromptTemplate = {
      ...input,
      id: `tpl_${++seq}_${input.skill}`,
      version,
      active: input.active !== false,
      created_at: new Date().toISOString(),
    };
    store.set(tpl.id, tpl);
    history.push(Object.freeze({ ...tpl }) as AIPromptTemplate);
    return tpl;
  },

  render(template: AIPromptTemplate, vars: Record<string, unknown>): { system: string; user: string } {
    const missing = template.variables.filter((v) => !(v in vars));
    if (missing.length) throw new Error(`Missing template variables: ${missing.join(", ")}`);
    return { system: renderTemplate(template.system, vars), user: renderTemplate(template.user, vars) };
  },

  history(): AIPromptTemplate[] { return [...history]; },
  clear() {
    store.clear();
    for (const t of BUILTIN) store.set(t.id, t);
    history.length = 0; seq = 0;
  },
} as const;
