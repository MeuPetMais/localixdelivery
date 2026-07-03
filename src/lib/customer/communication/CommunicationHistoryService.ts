import { supabase } from "@/integrations/supabase/client";
import { CommunicationEventBus } from "./CommunicationEventBus";
import type {
  CommunicationChannel,
  CommunicationHistoryEntry,
  CommunicationHistoryFilter,
} from "./types";

const T = () => (supabase as any).from("customer_communication_history");

export const CommunicationHistoryService = {
  async log(entry: CommunicationHistoryEntry): Promise<CommunicationHistoryEntry> {
    const row = {
      customer_id: entry.customer_id,
      channel: entry.channel,
      event_type: entry.event_type,
      status: entry.status ?? "logged",
      reference_id: entry.reference_id ?? null,
      metadata_json: entry.metadata_json ?? {},
    };
    const { data, error } = await T().insert(row).select().maybeSingle();
    if (error) throw error;
    await CommunicationEventBus.publish({
      type: "CommunicationLogged",
      customerId: entry.customer_id,
      channel: entry.channel,
      event_type: entry.event_type,
      at: new Date().toISOString(),
    });
    return (data ?? row) as CommunicationHistoryEntry;
  },

  async list(customerId: string, filter: CommunicationHistoryFilter = {}): Promise<CommunicationHistoryEntry[]> {
    let q = T().select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    if (filter.channel) q = q.eq("channel", filter.channel);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.event_type) q = q.eq("event_type", filter.event_type);
    if (filter.from) q = q.gte("created_at", filter.from);
    if (filter.to) q = q.lte("created_at", filter.to);
    const limit = Math.min(filter.limit ?? 50, 500);
    const offset = filter.offset ?? 0;
    q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CommunicationHistoryEntry[];
  },

  async summaryByChannel(customerId: string): Promise<Record<CommunicationChannel, number>> {
    const rows = await CommunicationHistoryService.list(customerId, { limit: 500 });
    const out: Record<string, number> = { EMAIL: 0, PUSH: 0, SMS: 0, WHATSAPP: 0, IN_APP: 0 };
    for (const r of rows) out[r.channel] = (out[r.channel] ?? 0) + 1;
    return out as Record<CommunicationChannel, number>;
  },
} as const;
