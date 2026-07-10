// Hook do Operations Tracking. Consome server function + Realtime.
// Sem polling: apenas invalidação por canal de realtime do restaurante.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOperationsDashboard } from "./operations-tracking.functions";
import { subscribeRestaurantTracking } from "../tracking.realtime";
import type { OperationsDashboardData } from "./operations-tracking.types";

export function useOperationsTracking(restaurantId: string | undefined) {
  const qc = useQueryClient();
  const fn = useServerFn(getOperationsDashboard);
  const queryKey = ["operations-tracking", restaurantId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!restaurantId,
    queryFn: async (): Promise<OperationsDashboardData> => fn({ data: { restaurantId: restaurantId! } }),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!restaurantId) return;
    const off = subscribeRestaurantTracking(restaurantId, {
      onUpdate: () => { void qc.invalidateQueries({ queryKey }); },
    });
    return () => { off(); };
  }, [restaurantId, qc]);

  return query;
}
