// OperationsRealtime — bridge do EventBus para atualizações incrementais no
// Centro de Operações. Assina eventos de OrderEventBus (state transitions)
// e permite listeners locais aplicarem patches sem refresh.

import { OrderEventBus } from "@/lib/orders/domain-events";

export type OperationsRealtimeListener = (evt: { orderId: string; state: string; at: string }) => void;

export const OperationsRealtime = {
  subscribe(listener: OperationsRealtimeListener): () => void {
    const off = OrderEventBus.subscribeAll((name, payload: any) => {
      const orderId = payload?.orderId ?? payload?.order_id;
      const state = payload?.to ?? payload?.state ?? name;
      const at = payload?.at ?? new Date().toISOString();
      if (orderId) listener({ orderId, state, at });
    });
    return off;
  },
};
