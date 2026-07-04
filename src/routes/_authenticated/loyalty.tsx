import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Ticket, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/loyalty")({
  head: () => ({ meta: [{ title: "Fidelidade — Localix" }] }),
  component: LoyaltyPage,
});

type Coupon = {
  id: string;
  restaurant_id: string;
  code: string;
  discount_percent: number;
  valid_until: string | null;
  is_active: boolean;
  uses_count: number;
};

function LoyaltyPage() {
  const restaurant = useRestaurant();


  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // form
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState(10);
  const [validUntil, setValidUntil] = useState("");

  async function refresh(restId: string) {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("restaurant_id", restId)
      .order("created_at", { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }

  useEffect(() => {
    if (restaurant?.id) refresh(restaurant.id);
  }, [restaurant?.id]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant?.id) return;
    if (!code.trim() || percent < 1 || percent > 100) return toast.error("Preencha código e percentual válido");
    setCreating(true);
    const { error } = await supabase.from("coupons").insert({
      restaurant_id: restaurant.id,
      code: code.trim().toUpperCase(),
      discount_percent: percent,
      valid_until: validUntil || null,
      is_active: true,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setCode(""); setPercent(10); setValidUntil("");
    toast.success("Cupom criado!");
    refresh(restaurant.id);
  }

  async function toggle(c: Coupon) {
    const { error } = await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    if (restaurant?.id) refresh(restaurant.id);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este cupom?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (restaurant?.id) refresh(restaurant.id);
  }

  // Top clients by points
  const { data: topClients } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["top-points", restaurant?.id],
    queryFn: async () => {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, name, phone, total_orders, total_spent")
        .eq("restaurant_id", restaurant!.id)
        .order("total_spent", { ascending: false })
        .limit(20);
      const ids = (custs ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const { data: pts } = await supabase
        .from("customer_loyalty")
        .select("customer_id, points_balance, lifetime_points")
        .in("customer_id", ids)
        .eq("restaurant_id", restaurant!.id);
      const map = new Map((pts ?? []).map((p: any) => [p.customer_id, p]));
      return (custs ?? [])
        .map((c) => ({ ...c, points: (map.get(c.id) as any)?.points_balance ?? 0, earned: (map.get(c.id) as any)?.lifetime_points ?? 0 }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);

    },
  });

  const totalUses = useMemo(() => coupons.reduce((s, c) => s + (c.uses_count ?? 0), 0), [coupons]);
  const activeCount = useMemo(() => coupons.filter((c) => c.is_active).length, [coupons]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Fidelidade</h1>
        <p className="text-sm text-muted-foreground">Cada R$1 gasto = 1 ponto. Crie cupons e recompense seus clientes mais fiéis.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cupons ativos</p><p className="mt-1 font-display text-3xl font-extrabold text-primary">{activeCount}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Usos totais</p><p className="mt-1 font-display text-3xl font-extrabold">{totalUses}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Clientes pontuando</p><p className="mt-1 font-display text-3xl font-extrabold">{topClients?.length ?? 0}</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Plus className="h-4 w-4" /> Novo cupom</h2>
          <form onSubmit={createCoupon} className="space-y-3">
            <div className="space-y-1.5"><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" maxLength={40} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Desconto (%)</Label><Input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Válido até</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar cupom"}
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-4 w-4 text-amber-500" /> Clientes mais fiéis</h2>
          {(!topClients || topClients.length === 0) ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ainda sem clientes pontuando.</p>
          ) : (
            <ul className="space-y-2">
              {topClients.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone} · {c.total_orders} pedidos</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    {c.points} pts
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Ticket className="h-4 w-4" /> Meus cupons</h2>
        {coupons.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cupom criado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Desconto</th>
                  <th className="py-2 pr-4">Validade</th>
                  <th className="py-2 pr-4">Usos</th>
                  <th className="py-2 pr-4">Ativo</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono font-semibold">{c.code}</td>
                    <td className="py-3 pr-4">{c.discount_percent}%</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("pt-BR") : "Sem validade"}</td>
                    <td className="py-3 pr-4">{c.uses_count}</td>
                    <td className="py-3 pr-4"><Switch checked={c.is_active} onCheckedChange={() => toggle(c)} /></td>
                    <td className="py-3 pr-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)} className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
