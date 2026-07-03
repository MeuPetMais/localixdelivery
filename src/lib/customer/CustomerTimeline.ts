import { supabase } from "@/integrations/supabase/client";
import { CustomerEventBus } from "./CustomerEventBus";
import type { CustomerTimelineEvent, CustomerTimelineEventType } from "./types";

const T = () => (supabase as any).from("customer_timeline");

export type RecordTimelineInput = {
  customer_id: string;
  restaurant_id?: string | null;
  event_type: CustomerTimelineEventType;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export const CustomerTimeline = {
  async record(input: RecordTimelineInput): Promise<CustomerTimelineEvent | null> {
    const payload = { metadata: {}, ...input };
    const { data, error } = await T().insert(payload).select().maybeSingle();
    if (error) throw error;
    if (data) {
      await CustomerEventBus.publish({
        type: "TimelineEventCreated",
        customerId: input.customer_id,
        eventType: input.event_type,
        at: new Date().toISOString(),
      });
    }
    return (data ?? null) as CustomerTimelineEvent | null;
  },

  async list(customerId: string, opts?: { limit?: number; type?: CustomerTimelineEventType }): Promise<CustomerTimelineEvent[]> {
    let q = T().select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    if (opts?.type) q = q.eq("event_type", opts.type);
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CustomerTimelineEvent[];
  },
} as const;
