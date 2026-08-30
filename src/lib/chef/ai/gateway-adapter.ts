import type {
  ChefRankingProfile,
  ChefRecommendationIntent,
  ChefRecommendationResult,
} from "../types";
import type {
  ChefIntentParser,
  ChefIntentParseResult,
  ChefResponsePresenter,
} from "../orchestrator/orchestrate-chef-message";

export const CHEF_AI_MODEL_CANDIDATES = {
  primary: "openai/gpt-5.6-luna",
  challenger: "google/gemini-3.5-flash-lite",
} as const;

export type ChefAiOperation = "intent_parse" | "conversation_response";

export type ChefAiUsage = {
  operation: ChefAiOperation;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

type GatewayFetch = typeof fetch;

type GatewayAdapterOptions = {
  model?: string;
  fetchImpl?: GatewayFetch;
  apiKey?: string;
  onUsage?: (usage: ChefAiUsage) => void | Promise<void>;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

const RANKING_PROFILES = new Set<ChefRankingProfile>([
  "DEFAULT",
  "BUDGET",
  "PROMOTION",
  "CATEGORY_SPECIFIC",
  "MATCH_PREFERENCES",
]);

const INTENT_JSON_SCHEMA = {
  name: "chef_intent",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: { type: ["string", "null"] },
      budgetMax: { type: ["number", "null"], minimum: 0 },
      desiredTerms: { type: "array", items: { type: "string" }, maxItems: 8 },
      excludedTerms: { type: "array", items: { type: "string" }, maxItems: 8 },
      promotionPreferred: { type: "boolean" },
      peopleCount: { type: ["integer", "null"], minimum: 1, maximum: 50 },
      rankingProfile: {
        type: ["string", "null"],
        enum: [
          "DEFAULT",
          "BUDGET",
          "PROMOTION",
          "CATEGORY_SPECIFIC",
          "MATCH_PREFERENCES",
          null,
        ],
      },
      needsClarification: { type: "boolean" },
      clarificationQuestion: { type: ["string", "null"], maxLength: 180 },
    },
    required: [
      "category",
      "budgetMax",
      "desiredTerms",
      "excludedTerms",
      "promotionPreferred",
      "peopleCount",
      "rankingProfile",
      "needsClarification",
      "clarificationQuestion",
    ],
  },
} as const;

function resolveGatewayToken(explicit?: string): string {
  const token = explicit ?? process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("CHEF_AI_GATEWAY_AUTH_MISSING");
  return token;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function toIntentResult(value: unknown): ChefIntentParseResult {
  if (!value || typeof value !== "object") throw new Error("CHEF_AI_INVALID_INTENT");
  const data = value as Record<string, unknown>;

  const rankingProfile =
    typeof data.rankingProfile === "string" &&
    RANKING_PROFILES.has(data.rankingProfile as ChefRankingProfile)
      ? (data.rankingProfile as ChefRankingProfile)
      : undefined;

  const intent: ChefRecommendationIntent = {
    category: typeof data.category === "string" ? data.category.trim() || null : null,
    budgetMax: typeof data.budgetMax === "number" && data.budgetMax >= 0 ? data.budgetMax : null,
    desiredTerms: normalizeStringList(data.desiredTerms),
    excludedTerms: normalizeStringList(data.excludedTerms),
    promotionPreferred: data.promotionPreferred === true,
    peopleCount:
      typeof data.peopleCount === "number" && Number.isInteger(data.peopleCount) && data.peopleCount > 0
        ? data.peopleCount
        : null,
  };

  return {
    intent,
    ...(rankingProfile ? { rankingProfile } : {}),
    needsClarification: data.needsClarification === true,
    clarificationQuestion:
      typeof data.clarificationQuestion === "string"
        ? data.clarificationQuestion.trim().slice(0, 180) || null
        : null,
  };
}

async function gatewayChat(
  operation: ChefAiOperation,
  messages: Array<{ role: "system" | "user"; content: string }>,
  options: GatewayAdapterOptions & { responseFormat?: unknown; maxTokens: number },
): Promise<string> {
  const startedAt = Date.now();
  const model = options.model ?? CHEF_AI_MODEL_CANDIDATES.primary;
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolveGatewayToken(options.apiKey)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    }),
  });

  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new Error(`CHEF_AI_GATEWAY_${retryable ? "RETRYABLE" : "FAILED"}_${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("CHEF_AI_EMPTY_RESPONSE");

  await options.onUsage?.({
    operation,
    model,
    inputTokens: payload.usage?.prompt_tokens ?? null,
    outputTokens: payload.usage?.completion_tokens ?? null,
    latencyMs,
  });

  return content;
}

export function createGatewayIntentParser(options: GatewayAdapterOptions = {}): ChefIntentParser {
  return {
    async parse({ message, locale = "pt-BR" }) {
      const content = await gatewayChat(
        "intent_parse",
        [
          {
            role: "system",
            content: [
              "Você é o parser de intenção do Chef Localix.",
              "Extraia somente preferências explícitas ou claramente expressas na mensagem.",
              "Nunca invente produto, preço, promoção, ingrediente, disponibilidade ou regra comercial.",
              "Você não conhece o restaurante e não recebe restaurantId.",
              "Use needsClarification apenas quando faltar informação indispensável para uma recomendação útil.",
              "Faça no máximo uma pergunta curta de esclarecimento.",
              `Locale: ${locale}.`,
            ].join(" "),
          },
          { role: "user", content: message.slice(0, 1200) },
        ],
        {
          ...options,
          maxTokens: 300,
          responseFormat: { type: "json_schema", json_schema: INTENT_JSON_SCHEMA },
        },
      );

      return toIntentResult(JSON.parse(content));
    },
  };
}

function safeRecommendationPayload(recommendation: ChefRecommendationResult) {
  return {
    confidence: recommendation.confidence,
    fallbackReason: recommendation.fallbackReason ?? null,
    recommendations: recommendation.recommendations.slice(0, 3).map((item) => ({
      rank: item.rank,
      effectivePrice: item.effectivePrice,
      promotionActive: item.promotionActive,
      reasonCodes: item.reasonCodes,
      matchedTerms: item.matchedTerms,
    })),
  };
}

export function createGatewayResponsePresenter(options: GatewayAdapterOptions = {}): ChefResponsePresenter {
  return {
    async present({ message, intent, recommendation, locale = "pt-BR" }) {
      return gatewayChat(
        "conversation_response",
        [
          {
            role: "system",
            content: [
              "Você é o Chef Localix, um assistente curto, amigável e útil.",
              "A seleção dos produtos já foi feita por um motor determinístico; você não pode trocar, criar ou reordenar produtos.",
              "Não invente nomes de produtos, preços, ingredientes, promoções, avaliações, porções ou disponibilidade.",
              "Os cards da interface mostrarão os dados completos dos produtos.",
              "Responda em no máximo 2 frases e, quando houver opções, convide o cliente a ver os cards.",
              "Se não houver resultado, seja transparente e não prometa algo fora das restrições.",
              `Locale: ${locale}.`,
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              customerMessage: message.slice(0, 1200),
              intent,
              engineResult: safeRecommendationPayload(recommendation),
            }),
          },
        ],
        { ...options, maxTokens: 120 },
      );
    },
  };
}
