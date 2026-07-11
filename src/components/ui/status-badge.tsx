import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "online"
  | "offline"
  | "queue"
  | "delivery"
  | "returning"
  | "paid"
  | "pending"
  | "cancelled"
  | "info"
  | "warning"
  | "success"
  | "danger"
  | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  online:     "bg-success/15 text-success ring-1 ring-inset ring-success/30",
  success:    "bg-success/15 text-success ring-1 ring-inset ring-success/30",
  paid:       "bg-success/15 text-success ring-1 ring-inset ring-success/30",
  offline:    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  neutral:    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  cancelled:  "bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/30",
  danger:     "bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/30",
  queue:      "bg-queue/20 text-[color:var(--queue-foreground)] ring-1 ring-inset ring-queue/40",
  pending:    "bg-warning/15 text-[color:var(--warning-foreground)] ring-1 ring-inset ring-warning/40",
  warning:    "bg-warning/15 text-[color:var(--warning-foreground)] ring-1 ring-inset ring-warning/40",
  delivery:   "bg-delivery/15 text-delivery ring-1 ring-inset ring-delivery/30",
  info:       "bg-info/15 text-info ring-1 ring-inset ring-info/30",
  returning:  "bg-returning/15 text-returning ring-1 ring-inset ring-returning/30",
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  dot?: boolean;
}

export function StatusBadge({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
