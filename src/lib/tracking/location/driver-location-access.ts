export type LocationActor =
  | { type: "driver"; userId: string }
  | { type: "restaurant"; userId: string; restaurantIds: string[] }
  | { type: "customer"; userId: string; orderIds: string[] }
  | { type: "admin" };

export interface LocationSubject {
  driverOwnerId: string | null;
  restaurantId: string;
  orderId?: string | null;
  trackingStatus?: string | null;
}

const CUSTOMER_ACTIVE_STATES = new Set(["ATRIBUIDO", "COLETANDO", "EM_ROTA", "PROXIMO_AO_DESTINO"]);

export function canReadDriverOperationalLocation(actor: LocationActor, subject: LocationSubject): boolean {
  if (actor.type === "admin") return true;
  if (actor.type === "driver") return subject.driverOwnerId === actor.userId;
  if (actor.type === "restaurant") return actor.restaurantIds.includes(subject.restaurantId);
  return false;
}

export function canReadCustomerDeliveryLocation(actor: LocationActor, subject: LocationSubject): boolean {
  if (actor.type === "admin") return true;
  if (actor.type !== "customer") return canReadDriverOperationalLocation(actor, subject);
  return !!subject.orderId &&
    actor.orderIds.includes(subject.orderId) &&
    CUSTOMER_ACTIVE_STATES.has(String(subject.trackingStatus ?? ""));
}
