// Event bus isolado do BRE. Não interfere com EventBus de pagamentos/orders.
import type { RuleEventName, RuleEventPayload } from "./types";

type Handler = (name: RuleEventName, payload: RuleEventPayload) => void | Promise<void>;

const handlers = new Set<Handler>();

export const RuleEventBus = {
  subscribe(h: Handler): () => void {
    handlers.add(h);
    return () => handlers.delete(h);
  },
  async publish(name: RuleEventName, payload: RuleEventPayload) {
    for (const h of handlers) {
      try {
        await h(name, payload);
      } catch (err) {
        console.error("[RuleEventBus] handler falhou", name, err);
      }
    }
  },
  _reset() {
    handlers.clear();
  },
};
