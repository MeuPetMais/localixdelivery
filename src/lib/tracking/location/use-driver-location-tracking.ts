import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ingestDriverLocations } from "./driver-location.functions";
import {
  DriverLocationTracker,
  resolveLocationMode,
  type DriverLocationTrackerContext,
} from "./driver-location-tracker";

export type DriverLocationUiStatus =
  | "idle"
  | "tracking"
  | "permission_denied"
  | "unsupported";

export function useDriverLocationTracking(context: DriverLocationTrackerContext | null) {
  const ingest = useServerFn(ingestDriverLocations);
  const [status, setStatus] = useState<DriverLocationUiStatus>("idle");
  const tracker = useMemo(
    () =>
      new DriverLocationTracker({
        geolocation:
          typeof navigator === "undefined"
            ? null
            : navigator.geolocation,
        upload: async (sample) => {
          await ingest({ data: { samples: [sample] } });
        },
        onPermissionDenied: () => setStatus("permission_denied"),
        onUnsupported: () => setStatus("unsupported"),
      }),
    [ingest],
  );

  useEffect(() => {
    tracker.update(context);
    const mode = context ? resolveLocationMode(context) : "offline";
    if (!context || mode === "offline" || mode === "paused") {
      setStatus("idle");
    } else if (status !== "permission_denied" && status !== "unsupported") {
      setStatus("tracking");
    }
    return () => tracker.stop();
  }, [context, tracker]);

  return { status };
}
