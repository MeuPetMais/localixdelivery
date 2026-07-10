// Operations Filters & Search — puro.

import type { OperationsActiveDelivery, OperationsFilters } from "./operations-tracking.types";

export function applyFilters(list: OperationsActiveDelivery[], f: OperationsFilters): OperationsActiveDelivery[] {
  const q = f.search?.trim().toLowerCase();
  return list.filter((c) => {
    if (f.status?.length && !f.status.includes(c.status)) return false;
    if (f.driverId && c.driver_id !== f.driverId) return false;
    if (f.neighborhood && (c.neighborhood ?? "").toLowerCase() !== f.neighborhood.toLowerCase()) return false;
    if (f.since && new Date(c.started_at).getTime() < new Date(f.since).getTime()) return false;
    if (f.until && new Date(c.started_at).getTime() > new Date(f.until).getTime()) return false;
    if (q) {
      const hay = [c.customer_name, c.driver_name, String(c.order_number ?? "")].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
