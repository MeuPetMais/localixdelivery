/* eslint-disable @typescript-eslint/no-explicit-any */
export type IntelligenceEventName =
  | "InsightGenerated"
  | "RecommendationCreated"
  | "ProductHealthUpdated"
  | "CrossSellSuggested"
  | "UpsellSuggested";

export interface IntelligenceEvent {
  name: IntelligenceEventName;
  restaurant_id: string;
  at: string;
  payload?: Record<string, any>;
}

type Listener = (e: IntelligenceEvent) => void | Promise<void>;
const listeners = new Set<Listener>();

export const IntelligenceEventBus = {
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  async publish(e: IntelligenceEvent) {
    for (const l of listeners) {
      try { await l(e); } catch (err) { console.error("[IntelligenceEventBus]", e.name, err); }
    }
  },
  _reset() { listeners.clear(); },
};
