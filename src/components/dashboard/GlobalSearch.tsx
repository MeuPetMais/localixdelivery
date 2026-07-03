import { useState } from "react";
import { Search } from "lucide-react";
import { DashboardAudit } from "@/lib/dashboard";

export type GlobalSearchScope = "orders" | "customers" | "products" | "categories" | "coupons";

export interface GlobalSearchResult {
  id: string;
  label: string;
  scope: GlobalSearchScope;
  to?: string;
}

interface Props {
  onSearch: (q: string) => Promise<GlobalSearchResult[]>;
  onSelect?: (r: GlobalSearchResult) => void;
}

export function GlobalSearch({ onSearch, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const submit = async (value: string) => {
    setQ(value);
    if (!value.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      DashboardAudit.record({ type: "SEARCH", payload: { q: value } });
      const r = await onSearch(value);
      setResults(r);
    } finally { setLoading(false); }
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => submit(e.target.value)}
        placeholder="Buscar pedidos, clientes, produtos…"
        className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
          {loading && <div className="p-2 text-xs text-muted-foreground">Buscando…</div>}
          {!loading && results.length === 0 && <div className="p-2 text-xs text-muted-foreground">Sem resultados</div>}
          {results.map((r) => (
            <button
              key={`${r.scope}-${r.id}`}
              onClick={() => onSelect?.(r)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span>{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.scope}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
