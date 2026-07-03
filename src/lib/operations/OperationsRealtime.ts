// OperationsRealtime — bridge do EventBus para atualizações incrementais no
// Centro de Operações. Assina eventos de OrderEventBus (state transitions)
// e permite listeners locais aplicarem patches sem refresh.

import { OrderEventBus } from "@/lib/orders/domain-events";

export type OperationsRealtimeListener = (evt: { orderId: string; state: string; at: string }) => void;

export const OperationsRealtime = {
  subscribe(listener: OperationsRealtimeListener): () => void {
    const off = OrderEventBus.subscribe((name, payload) => {
      const p = payload as unknown as Record<string, unknown>;
      const orderId = (p.orderId ?? p.order_id) as string | undefined;
      const state = (p.to ?? p.state ?? name) as string;
      const at = (p.at as string | undefined) ?? new Date().toISOString();
      if (orderId) listener({ orderId, state, at });
    });
    return off;
  },
};
