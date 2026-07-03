import type { TimelineEntry } from "@/lib/orders/OrderTimelineService";

export function LiveTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="space-y-2">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="font-medium">{e.label}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.at).toLocaleTimeString()} • {e.actorType}
              {e.reason ? ` • ${e.reason}` : ""}
            </p>
          </div>
        </li>
      ))}
      {entries.length === 0 && <li className="text-xs text-muted-foreground">Sem eventos.</li>}
    </ol>
  );
}
