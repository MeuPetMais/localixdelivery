import { WidgetCard, WidgetHeader, WidgetEmpty } from "../WidgetPrimitives";

export interface NotificationSummary {
  id: string;
  title: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  read: boolean;
  at: string;
}

export function NotificationWidget({ items, unread }: { items: NotificationSummary[]; unread: number }) {
  return (
    <WidgetCard>
      <WidgetHeader title={`Notificações (${unread} não lidas)`} />
      {items.length === 0 ? (
        <WidgetEmpty title="Sem notificações" />
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
              <span className={n.read ? "text-muted-foreground" : "font-medium"}>{n.title}</span>
              <span className="text-xs uppercase text-muted-foreground">{n.priority}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
