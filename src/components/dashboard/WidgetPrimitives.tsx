import { Component, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function WidgetGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function WidgetCard({
  children,
  className,
  span = 1,
}: { children: ReactNode; className?: string; span?: 1 | 2 | 3 | 4 }) {
  const spanCls = { 1: "", 2: "sm:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" }[span];
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", spanCls, className)}>
      {children}
    </div>
  );
}

export function WidgetHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {action}
    </div>
  );
}

export function WidgetFooter({ children }: { children: ReactNode }) {
  return <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">{children}</div>;
}

export function WidgetLoading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-sm text-destructive">
      <p>Falha ao carregar: {message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs underline">Tentar novamente</button>
      )}
    </div>
  );
}

export function WidgetEmpty({ title = "Sem dados", description }: { title?: string; description?: string }) {
  return (
    <div className="py-6 text-center text-sm text-muted-foreground">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-xs">{description}</p>}
    </div>
  );
}

interface EBState { error?: Error }
export class WidgetErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, EBState> {
  state: EBState = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? <WidgetError message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
