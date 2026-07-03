import type { DeliveryProvider } from "./DeliveryProvider";
import type { DeliveryProviderId } from "../types";
import { RestaurantDeliveryProvider } from "./RestaurantDeliveryProvider";
import { LocalixDeliveryProvider } from "./LocalixDeliveryProvider";
import { ExternalDeliveryProvider } from "./ExternalDeliveryProvider";

const registry = new Map<DeliveryProviderId, DeliveryProvider>([
  ["RESTAURANT", new RestaurantDeliveryProvider()],
  ["LOCALIX", new LocalixDeliveryProvider()],
  ["EXTERNAL", new ExternalDeliveryProvider()],
]);

export function getDeliveryProvider(id: DeliveryProviderId): DeliveryProvider {
  const p = registry.get(id);
  if (!p) throw new Error(`Unknown delivery provider: ${id}`);
  return p;
}

export function registerDeliveryProvider(provider: DeliveryProvider) {
  registry.set(provider.id, provider);
}

export { RestaurantDeliveryProvider, LocalixDeliveryProvider, ExternalDeliveryProvider };
export type { DeliveryProvider } from "./DeliveryProvider";
