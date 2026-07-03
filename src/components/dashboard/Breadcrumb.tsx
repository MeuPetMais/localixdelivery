import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface Crumb { label: string; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span>{c.label}</span>}
          {i < items.length - 1 && <ChevronRight className="h-3 w-3" />}
        </span>
      ))}
    </nav>
  );
}
