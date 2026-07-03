export type RestaurantSettingsEvent =
  | { type: "SettingsUpdated"; restaurant_id: string; group: string; version: number; changed_by?: string }
  | { type: "SettingsRolledBack"; restaurant_id: string; group: string; version: number; changed_by?: string }
  | { type: "EmployeeCreated"; restaurant_id: string; employee_id: string; role: string }
  | { type: "EmployeeUpdated"; restaurant_id: string; employee_id: string; role: string }
  | { type: "EmployeeRemoved"; restaurant_id: string; employee_id: string }
  | { type: "FeatureFlagChanged"; restaurant_id: string; flag: string; enabled: boolean };

type Listener = (event: RestaurantSettingsEvent) => void;

export class RestaurantSettingsEventBus {
  private listeners = new Set<Listener>();
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  publish(e: RestaurantSettingsEvent) { for (const l of this.listeners) l(e); }
  clear() { this.listeners.clear(); }
}

export const restaurantSettingsEventBus = new RestaurantSettingsEventBus();
