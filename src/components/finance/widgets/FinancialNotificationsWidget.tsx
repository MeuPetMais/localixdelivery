import { WidgetCard, WidgetHeader, WidgetEmpty } from "@/components/dashboard/WidgetPrimitives";

// Reuses NotificationCenter surface — here we render a lightweight
// summary tied to finance topics. Real events come from tenant_notifications
// via the shared NotificationsBell.
export function FinancialNotificationsWidget({ restaurantId }: { restaurantId: string }) {
  void restaurantId;
  return (
    <WidgetCard span={2}>
      <WidgetHeader title="Alertas financeiros" />
      <WidgetEmpty description="Sem alertas no momento. Falhas de pagamento, splits pendentes ou conciliações divergentes aparecerão aqui." />
    </WidgetCard>
  );
}
