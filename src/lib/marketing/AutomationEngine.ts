import type { Automation, AutomationInput, AutomationTrigger, MarketingDomainEvent } from "./types";
import { MarketingEventBus } from "./MarketingEventBus";
import { MarketingAudit } from "./MarketingAudit";

const store = new Map<string, Automation>();
let seq = 0;

export const AutomationEngine = {
  create(input: AutomationInput): Automation {
    const a: Automation = {
      id: `auto_${++seq}`,
      restaurant_id: input.restaurant_id,
      name: input.name,
      trigger: input.trigger,
      channels: input.channels,
      template_id: input.template_id,
      delay_minutes: input.delay_minutes,
      active: input.active ?? true,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    };
    store.set(a.id, a);
    MarketingAudit.record({
      restaurant_id: a.restaurant_id, action: "automation.create",
      target_type: "automation", target_id: a.id, metadata: { trigger: a.trigger },
    });
    return a;
  },

  toggle(id: string, active: boolean): Automation {
    const a = store.get(id);
    if (!a) throw new Error("Automation not found");
    a.active = active;
    MarketingAudit.record({
      restaurant_id: a.restaurant_id, action: active ? "automation.enable" : "automation.disable",
      target_type: "automation", target_id: id, metadata: {},
    });
    return a;
  },

  list(restaurantId: string, trigger?: AutomationTrigger): Automation[] {
    return [...store.values()].filter((a) =>
      a.restaurant_id === restaurantId && (!trigger || a.trigger === trigger));
  },

  async fire(restaurantId: string, trigger: AutomationTrigger, customerId: string): Promise<Automation[]> {
    const matching = AutomationEngine.list(restaurantId, trigger).filter((a) => a.active);
    for (const a of matching) {
      const event: MarketingDomainEvent = {
        type: "AutomationTriggered", automationId: a.id, trigger, customerId, at: new Date().toISOString(),
      };
      await MarketingEventBus.publish(event);
    }
    return matching;
  },

  clear(): void { store.clear(); seq = 0; },
} as const;
