import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ShoppingCart, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { evaluateAlerts, type StockAlert } from "@/lib/inventory/StockAlerts";
import type { Ingredient } from "@/lib/inventory/types";

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  ingredient_id: string;
}

export function InventoryWidget({ restaurantId }: { restaurantId: string }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pendingPos, setPendingPos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ing, mov, po] = await Promise.all([
        supabase.from("ingredients").select("*").eq("restaurant_id", restaurantId),
        supabase.from("stock_movements").select("id, movement_type, quantity, created_at, ingredient_id")
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("purchase_orders").select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId).in("status", ["PENDING", "APPROVED", "ORDERED"]),
      ]);
      const items = (ing.data ?? []) as Ingredient[];
      setIngredients(items);
      setAlerts(evaluateAlerts(items));
      setMovements((mov.data ?? []) as Movement[]);
      setPendingPos(po.count ?? 0);
      setLoading(false);
    })();
  }, [restaurantId]);

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando estoque…</CardContent></Card>;

  const critical = alerts.filter((a) => a.level === "OUT" || a.level === "LOW").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" /> Estoque
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Itens" value={ingredients.length} />
          <Stat label="Críticos" value={critical} tone={critical ? "critical" : undefined} icon={AlertTriangle} />
          <Stat label="Compras" value={pendingPos} icon={ShoppingCart} />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Últimas movimentações
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                  <Badge variant="secondary">{m.movement_type}</Badge>
                  <span>{Number(m.quantity)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: "critical"; icon?: any }) {
  const color = tone === "critical" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
