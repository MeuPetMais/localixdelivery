import type { AIProvider, AIProviderKey, AICompletionRequest, AICompletionResponse } from "./types";

const providers = new Map<AIProviderKey, AIProvider>();

/** Deterministic mock provider — never calls real APIs. */
const MockProvider: AIProvider = {
  key: "mock",
  supports() { return true; },
  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const started = Date.now();
    const promptText = req.messages.map((m) => m.content).join("\n");
    const tokens_in = Math.ceil(promptText.length / 4);
    const answer = `[mock:${req.model}] ${promptText.slice(-160)}`;
    const tokens_out = Math.ceil(answer.length / 4);
    return {
      provider: "mock",
      model: req.model,
      content: answer,
      tokens_in,
      tokens_out,
      latency_ms: Date.now() - started,
      cost_estimate: (tokens_in + tokens_out) * 0.000001,
      finish_reason: "stop",
    };
  },
};

export const AIProviderRegistry = {
  register(p: AIProvider) { providers.set(p.key, p); },
  get(key: AIProviderKey): AIProvider {
    return providers.get(key) ?? MockProvider;
  },
  list(): AIProviderKey[] { return [...providers.keys(), "mock"]; },
  reset() { providers.clear(); providers.set("mock", MockProvider); },
} as const;

// bootstrap
AIProviderRegistry.reset();
