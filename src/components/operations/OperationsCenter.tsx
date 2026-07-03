import { useEffect, useState } from "react";
import { OrdersBoard } from "./OrdersBoard";
import { KitchenDisplay } from "./KitchenDisplay";
import { DeliveryPanel } from "./DeliveryPanel";
import { LiveTimeline } from "./LiveTimeline";
import { LiveCounters, OperationalMetricsView, OperationalAlerts } from "./LiveCounters";
import { OperationsQuickActions } from "./OperationsQuickActions";
import type { TimelineEntry } from "@/lib/orders/OrderTimelineService";
import {
  createOperationsService,
  OperationsRealtime,
  type OperationsAction,
  type OperationsOrderCard,
  type OperationsRole,
  type OperationsFilters,
  type OperationsOrchestrator,
} from "@/lib/operations";

interface Props {
  role: OperationsRole;
  restaurantOpen?: boolean;
  cards: OperationsOrderCard[];
  timeline?: TimelineEntry[];
  orchestrator: OperationsOrchestrator;
  onRefresh?: () => void;
  fullscreenMode?: "off" | "kitchen" | "attendant";
}

const TABS = ["orders", "kitchen", "delivery", "timeline"] as const;
type Tab = (typeof TABS)[number];

export function OperationsCenter({
  role, cards, timeline = [], orchestrator, onRefresh, fullscreenMode = "off",
}: Props) {
  const [tab, setTab] = useState<Tab>(fullscreenMode === "kitchen" ? "kitchen" : "orders");
  const [selected, setSelected] = useState<OperationsOrderCard | null>(null);
  const [filters] = useState<OperationsFilters>({});

  const service = createOperationsService({ orchestrator });
  const board = service.buildBoard(cards, filters);

  useEffect(() => OperationsRealtime.subscribe(() => onRefresh?.()), [onRefresh]);

  const runAction = async (action: OperationsAction) => {
    if (!selected) return;
    await service.perform({ action, orderId: selected.id, role });
    onRefresh?.();
  };

  return (
    <div className="space-y-3">
      <LiveCounters counters={board.counters} />
      <OperationalAlerts alerts={board.alerts} />
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium " +
              (tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {({ orders: "Pedidos", kitchen: "Cozinha", delivery: "Entrega", timeline: "Timeline" } as const)[t]}
          </button>
        ))}
        <div className="ml-auto">
          {selected && <OperationsQuickActions role={role} onAction={runAction} />}
        </div>
      </div>

      {tab === "orders" && <OrdersBoard cards={board.columns.flatMap((c) => c.cards)} onCardClick={setSelected} />}
      {tab === "kitchen" && (
        <KitchenDisplay
          cards={cards}
          onStart={(c) => { setSelected(c); void service.perform({ action: "START_PREP", orderId: c.id, role }).then(onRefresh); }}
          onFinish={(c) => { setSelected(c); void service.perform({ action: "FINISH_PREP", orderId: c.id, role }).then(onRefresh); }}
        />
      )}
      {tab === "delivery" && <DeliveryPanel cards={cards} />}
      {tab === "timeline" && <LiveTimeline entries={timeline} />}

      <OperationalMetricsView metrics={board.metrics} />
    </div>
  );
}
