import { useEffect, useMemo, useState } from "react";

import { getRestaurantStatus, type OpeningHours } from "@/lib/restaurant-status";

type UseRestaurantStatusInput = {
  is_open?: boolean | null;
  opening_hours?: OpeningHours;
  timeZone?: string | null;
};

/**
 * React wrapper around the single status rule.
 *
 * The pure function is enough when data changes, but open/closed can also change
 * simply because the clock crossed an opening-hours boundary. This hook forces a
 * lightweight recalculation every minute so long-lived dashboard tabs and newly
 * opened public pages do not disagree.
 */
export function useRestaurantStatus(input: UseRestaurantStatusInput, refreshMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  return useMemo(
    () => getRestaurantStatus(input, now),
    [input.is_open, input.opening_hours, input.timeZone, now],
  );
}