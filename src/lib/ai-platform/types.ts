// AI Orchestration Platform — types

export type AISkillKey =
  | "restaurant_assistant"
  | "financial_assistant"
  | "product_assistant"
  | "inventory_assistant"
  | "marketing_assistant"
  | "operational_assistant"
  | "admin_assistant";

export type AIProviderKey = "openai" | "gemini" | "claude" | "mock";

export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AICompletionRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface AICompletionResponse {
  provider: AIProviderKey;
  model: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_estimate: number;
  finish_reason?: string;
}

export interface AIProvider {
  key: AIProviderKey;
  supports(model: string): boolean;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

export interface AISkillDefinition {
  key: AISkillKey;
  name: string;
  description: string;
  domains: string[];              // domains the skill may read from
  default_prompt: string;         // template id
  requires_permission: string;    // permission key
}

export interface AISkillContext {
  restaurant_id: string;
  actor_id?: string;
  skill: AISkillKey;
  question?: string;
  domain_snapshot: Record<string, unknown>;
  locale?: string;
  metadata?: Record<string, unknown>;
}

export interface AISkillResult {
  skill: AISkillKey;
  answer: string;
  recommendations: string[];
  used_domains: string[];
  provider: AIProviderKey;
  model: string;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_estimate: number;
}

export interface AIPromptTemplate {
  id: string;
  skill: AISkillKey;
  version: number;
  system: string;
  user: string;                   // may contain {{variables}}
  variables: string[];
  active: boolean;
  created_at: string;
}

export interface AISettings {
  restaurant_id: string;
  enabled: boolean;
  default_model: string;
  default_provider: AIProviderKey;
  language: string;
  enabled_skills: AISkillKey[];
  monthly_request_limit: number;
  monthly_token_limit: number;
}

export interface AIUsageEntry {
  id: string;
  restaurant_id: string;
  skill: AISkillKey;
  provider: AIProviderKey;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_estimate: number;
  latency_ms: number;
  at: string;
}

export interface AIAuditEntry {
  id: string;
  restaurant_id: string;
  actor_id?: string;
  skill: AISkillKey;
  prompt_id?: string;
  prompt_hash: string;
  response_hash: string;
  metadata: Record<string, unknown>;
  at: string;
}

export type AIDomainEvent =
  | { type: "AISkillInvoked"; restaurantId: string; skill: AISkillKey; at: string }
  | { type: "AISkillCompleted"; restaurantId: string; skill: AISkillKey; latency_ms: number; at: string }
  | { type: "AISkillDenied"; restaurantId: string; skill: AISkillKey; reason: string; at: string }
  | { type: "AILimitExceeded"; restaurantId: string; kind: "requests" | "tokens"; at: string };

export interface AIForecastRequest {
  restaurant_id: string;
  kind: "sales" | "demand" | "inventory" | "financial";
  horizon_days: number;
  history: Array<{ date: string; value: number }>;
}

export interface AIForecastResult {
  kind: AIForecastRequest["kind"];
  horizon_days: number;
  points: Array<{ date: string; value: number; lower: number; upper: number }>;
  trend: "up" | "down" | "flat";
  confidence: number; // 0..1
}
