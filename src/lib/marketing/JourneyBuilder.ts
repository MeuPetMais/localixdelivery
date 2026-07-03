import type { Journey, JourneyStep } from "./types";
import { MarketingEventBus } from "./MarketingEventBus";

const store = new Map<string, Journey>();
let seq = 0;

export const JourneyBuilder = {
  create(input: Omit<Journey, "id" | "created_at">): Journey {
    if (!input.steps[input.entry]) throw new Error("entry step missing in steps map");
    const j: Journey = { ...input, id: `jrn_${++seq}`, created_at: new Date().toISOString() };
    store.set(j.id, j);
    return j;
  },
  get(id: string): Journey | null { return store.get(id) ?? null; },
  list(restaurantId: string): Journey[] {
    return [...store.values()].filter((j) => j.restaurant_id === restaurantId);
  },
  validate(j: Journey): string[] {
    const errs: string[] = [];
    if (!j.steps[j.entry]) errs.push("entry step not found");
    for (const [key, step] of Object.entries(j.steps)) {
      for (const n of step.next ?? []) if (!j.steps[n]) errs.push(`step ${key} references missing ${n}`);
    }
    return errs;
  },
  async start(journeyId: string, customerId: string): Promise<JourneyStep | null> {
    const j = store.get(journeyId);
    if (!j || !j.active) return null;
    await MarketingEventBus.publish({
      type: "JourneyStarted", journeyId, customerId, at: new Date().toISOString(),
    });
    return j.steps[j.entry] ?? null;
  },
  clear(): void { store.clear(); seq = 0; },
} as const;
