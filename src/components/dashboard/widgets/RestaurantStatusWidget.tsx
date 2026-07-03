import { WidgetCard, WidgetHeader } from "../WidgetPrimitives";
import type { DashboardRestaurantStatus } from "@/lib/dashboard";

export function RestaurantStatusWidget({ status }: { status: DashboardRestaurantStatus }) {
  const rows: [string, string][] = [
    ["Aberto", status.isOpen ? "Sim" : "Não"],
    ["Aceitando pedidos", status.acceptingOrders ? "Sim" : "Não"],
    ["Modo férias", status.vacationMode ? "Sim" : "Não"],
    ["Modo manutenção", status.maintenanceMode ? "Sim" : "Não"],
    ["Modo entrega", status.deliveryMode],
  ];
  return (
    <WidgetCard>
      <WidgetHeader title="Status do restaurante" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </WidgetCard>
  );
}
