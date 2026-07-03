import type { LoyaltyLevelName } from "./types";

export type LoyaltyDomainEvent =
  | { type: "PointsEarned"; customerId: string; restaurantId: string; points: number; orderId?: string; at: string }
  | { type: "PointsRedeemed"; customerId: string; restaurantId: string; points: number; at: string }
  | { type: "PointsExpired"; customerId: string; restaurantId: string; points: number; at: string }
  | { type: "CashbackEarned"; customerId: string; restaurantId: string; amount: number; orderId?: string; at: string }
  | { type: "CashbackRedeemed"; customerId: string; restaurantId: string; amount: number; at: string }
  | { type: "LevelChanged"; customerId: string; restaurantId: string; from: LoyaltyLevelName; to: LoyaltyLevelName; at: string }
  | { type: "RewardUnlocked"; customerId: string; restaurantId: string; rewardKey: string; at: string };

export type LoyaltyEventListener = (event: LoyaltyDomainEvent) => void | Promise<void>;

class Bus {
  private readonly listeners = new Set<LoyaltyEventListener>();
  subscribe(l: LoyaltyEventListener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  async publish(event: LoyaltyDomainEvent) {
    await Promise.all(Array.from(this.listeners).map((l) => {
      try { return Promise.resolve(l(event)); } catch { return Promise.resolve(); }
    }));
  }
  clear() { this.listeners.clear(); }
}

export const LoyaltyEventBus = new Bus();
