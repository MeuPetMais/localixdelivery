import type { OperationsFilters, OperationsOrderCard } from "./types";

function todayMatch(iso: string, now = Date.now()): boolean {
  const d = new Date(iso), n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function applyFilters(
  cards: OperationsOrderCard[],
  f: OperationsFilters,
  now = Date.now(),
): OperationsOrderCard[] {
  return cards.filter((c) => {
    if (f.today && !todayMatch(c.createdAt, now)) return false;
    if (f.pending && ["DELIVERED", "COMPLETED", "CANCELLED"].includes(c.status)) return false;
    if (f.delivery && c.deliveryMode !== f.delivery) return false;
    if (f.payment && c.paymentMethod !== f.payment) return false;
    if (f.priority && c.priority !== f.priority) return false;
    if (f.customer && !c.customerName.toLowerCase().includes(f.customer.toLowerCase())) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${c.number} ${c.customerName} ${c.customerPhone ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
