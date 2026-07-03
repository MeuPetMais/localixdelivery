// EventBus in-process para o domínio de promoções.
export type PromotionEventName =
  | "PromotionCreated"
  | "PromotionActivated"
  | "PromotionPaused"
  | "PromotionExpired"
  | "PromotionArchived"
  | "CouponUsed"
  | "PriceChanged"
  | "PromotionMarginAlert";

export interface PromotionEvent {
  name: PromotionEventName;
  restaurant_id: string;
  promotion_id?: string;
  at: string;
  payload?: Record<string, any>;
}

type Listener = (e: PromotionEvent) => void | Promise<void>;
const listeners = new Set<Listener>();

export const PromotionEventBus = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async publish(e: PromotionEvent) {
    for (const l of listeners) {
      try {
        await l(e);
      } catch (err) {
        console.error("[PromotionEventBus] listener error", e.name, err);
      }
    }
  },
  _reset() {
    listeners.clear();
  },
};
