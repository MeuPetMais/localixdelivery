// QueueService — Fila Operacional de Motoboys (RC5.2.a.1).
// Cada restaurante possui sua própria fila FIFO. Substitui o conceito
// de "Aceitar Entrega". Mutações são executadas por funções SECURITY
// DEFINER no banco (queue_enqueue, queue_dequeue, queue_return,
// queue_remove, queue_next_driver). Este serviço é o único ponto de
// acesso do frontend/backend TS à fila.

export type QueueStatus = "AGUARDANDO" | "EM_ENTREGA" | "RETORNANDO" | "INATIVO";

export interface QueueEntry {
  id: string;
  restaurant_id: string;
  driver_id: string;
  position: number;
  status: QueueStatus;
  entered_at: string;
  left_at: string | null;
}

export interface QueueRpc {
  enqueue: (restaurantId: string, driverId: string) => Promise<string>;
  dequeue: (restaurantId: string, driverId: string) => Promise<boolean>;
  returnToQueue: (restaurantId: string, driverId: string) => Promise<string>;
  remove: (restaurantId: string, driverId: string) => Promise<boolean>;
  nextDriver: (restaurantId: string) => Promise<{
    queue_id: string; driver_id: string; queue_position: number;
  } | null>;
  list: (restaurantId: string) => Promise<QueueEntry[]>;
}

export function createQueueService(rpc: QueueRpc) {
  return {
    enqueue: (restaurantId: string, driverId: string) => rpc.enqueue(restaurantId, driverId),
    dequeue: (restaurantId: string, driverId: string) => rpc.dequeue(restaurantId, driverId),
    reenter: (restaurantId: string, driverId: string) => rpc.returnToQueue(restaurantId, driverId),
    remove: (restaurantId: string, driverId: string) => rpc.remove(restaurantId, driverId),
    nextDriver: (restaurantId: string) => rpc.nextDriver(restaurantId),
    list: (restaurantId: string) => rpc.list(restaurantId),
    async driverPosition(restaurantId: string, driverId: string): Promise<number | null> {
      const entries = await rpc.list(restaurantId);
      const found = entries.find(
        (e) => e.driver_id === driverId && e.status === "AGUARDANDO",
      );
      return found?.position ?? null;
    },
    async queueLength(restaurantId: string): Promise<number> {
      const entries = await rpc.list(restaurantId);
      return entries.filter((e) => e.status === "AGUARDANDO").length;
    },
  };
}

export type QueueService = ReturnType<typeof createQueueService>;
