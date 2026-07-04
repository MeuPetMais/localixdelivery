import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Plus, Trash2, Ticket, Sparkles, Settings, Gift, Trophy, Users, BarChart3,
  Megaphone, Percent, DollarSign, Timer, AlertTriangle, Activity, Crown,
  Pencil, Copy, Pause, Play, Truck, Package, ChevronRight, ChevronLeft, Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getRestaurantLoyaltySettings, saveRestaurantLoyaltySettings,
  getRestaurantLoyaltyStats, getRestaurantLoyaltyAnalytics,
  type LoyaltySettings,
} from "@/lib/loyalty.functions";

export const Route = createFileRoute("/_authenticated/loyalty")({
  head: () => ({ meta: [{ title: "Central de Fidelidade — Localix" }] }),
  component: LoyaltyCentralPage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LoyaltyCentralPage() {
  const restaurant = useRestaurant();

  if (!restaurant) return <div className="p-6 text-muted-foreground">Selecione um estabelecimento.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Central de Fidelidade</p>
            <h1 className="font-display text-2xl font-extrabold">{restaurant.name}</h1>
            <p className="text-sm text-muted-foreground">Configure regras, benefícios, níveis e acompanhe o programa.</p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="settings"><Settings className="mr-1.5 h-4 w-4" />Configurações</TabsTrigger>
          <TabsTrigger value="benefits"><Gift className="mr-1.5 h-4 w-4" />Benefícios</TabsTrigger>
          <TabsTrigger value="levels"><Trophy className="mr-1.5 h-4 w-4" />Níveis</TabsTrigger>
          <TabsTrigger value="customers"><Users className="mr-1.5 h-4 w-4" />Clientes</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-4 w-4" />Analytics</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="mr-1.5 h-4 w-4" />Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="settings"><SettingsTab restaurantId={restaurant.id} /></TabsContent>
        <TabsContent value="benefits"><BenefitsTab restaurantId={restaurant.id} /></TabsContent>
        <TabsContent value="levels"><LevelsTab restaurantId={restaurant.id} /></TabsContent>
        <TabsContent value="customers"><CustomersTab restaurantId={restaurant.id} /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab restaurantId={restaurant.id} /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab restaurantId={restaurant.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- 1. Configurações ----------------
function SettingsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getRestaurantLoyaltySettings);
  const saveFn = useServerFn(saveRestaurantLoyaltySettings);

  const settingsQ = useQuery({
    queryKey: ["loyalty-settings", restaurantId],
    queryFn: () => settingsFn({ data: { restaurantId } }),
  });
  const [form, setForm] = useState<LoyaltySettings | null>(null);
  useEffect(() => { if (settingsQ.data) setForm(settingsQ.data); }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { restaurantId, settings: form! } }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["loyalty-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (settingsQ.isLoading || !form) return <LoadingCard />;

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-semibold">Programa ativo</p>
            <p className="text-xs text-muted-foreground">Quando ativo, os clientes acumulam e resgatam pontos.</p>
          </div>
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pontos por real gasto" hint="Ex.: 1 = 1 ponto por R$ 1">
            <Input type="number" step="0.1" min={0.01} value={form.points_per_real}
              onChange={(e) => setForm({ ...form, points_per_real: Number(e.target.value) })} />
          </Field>
          <Field label="Pedido mínimo (R$)">
            <Input type="number" step="0.5" min={0} value={form.min_order}
              onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} />
          </Field>
          <Field label="Resgate mínimo (pontos)">
            <Input type="number" min={1} value={form.min_redeem}
              onChange={(e) => setForm({ ...form, min_redeem: Number(e.target.value) })} />
          </Field>
          <Field label="Desconto máximo por pedido">
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={100} value={form.max_discount_percent}
                onChange={(e) => setForm({ ...form, max_discount_percent: Number(e.target.value) })} />
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
          </Field>
          <Field label="Validade dos pontos (dias)">
            <Input type="number" min={30} max={3650} value={form.validity_days}
              onChange={(e) => setForm({ ...form, validity_days: Number(e.target.value) })} />
          </Field>
          <Field label="Creditar pontos quando o pedido estiver">
            <RadioGroup
              value={form.earn_on}
              onValueChange={(v) => setForm({ ...form, earn_on: v as "paid" | "delivered" })}
              className="flex gap-4 pt-2"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="paid" id="earn-paid" /> Pago
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="delivered" id="earn-delivered" /> Entregue
              </label>
            </RadioGroup>
          </Field>
        </div>

        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => settingsQ.data && setForm(settingsQ.data)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- 2. Benefícios (cupons + tipos) ----------------
type Coupon = {
  id: string; restaurant_id: string; code: string; discount_percent: number;
  valid_until: string | null; is_active: boolean; uses_count: number;
};

const BENEFIT_TYPES = [
  { key: "DISCOUNT", label: "Desconto", icon: Percent },
  { key: "FREE_PRODUCT", label: "Produto grátis", icon: Gift },
  { key: "FREE_DELIVERY", label: "Frete grátis", icon: Ticket },
  { key: "CASHBACK", label: "Cashback", icon: DollarSign },
  { key: "COUPON", label: "Cupom", icon: Ticket },
  { key: "GIFT", label: "Brinde", icon: Sparkles },
];

function BenefitsTab({ restaurantId }: { restaurantId: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState(10);
  const [validUntil, setValidUntil] = useState("");

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.from("coupons").select("*")
      .eq("restaurant_id", restaurantId).order("created_at", { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [restaurantId]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || percent < 1 || percent > 100) return toast.error("Preencha código e percentual válido");
    setCreating(true);
    const { error } = await supabase.from("coupons").insert({
      restaurant_id: restaurantId, code: code.trim().toUpperCase(),
      discount_percent: percent, valid_until: validUntil || null, is_active: true,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    setCode(""); setPercent(10); setValidUntil("");
    toast.success("Cupom criado!");
    refresh();
  }
  async function toggle(c: Coupon) {
    const { error } = await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast.error(error.message); refresh();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este cupom?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message); refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold">Tipos de benefícios suportados</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {BENEFIT_TYPES.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Icon className="h-4 w-4 text-primary" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hoje o resgate acontece via pontos no checkout e via cupons abaixo. Novos tipos serão liberados nos próximos ciclos.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <Plus className="h-4 w-4" /> Novo cupom
            </h2>
            <form onSubmit={createCoupon} className="space-y-3">
              <div className="space-y-1.5"><Label>Código</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BEMVINDO10" maxLength={40} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Desconto (%)</Label>
                  <Input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5"><Label>Válido até</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar cupom"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
              <Ticket className="h-4 w-4" /> Cupons ativos
            </h2>
            {loading ? <LoadingCard inline /> : coupons.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cupom criado ainda.</p>
            ) : (
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-2">Código</th><th className="py-2 pr-2">%</th>
                      <th className="py-2 pr-2">Usos</th><th className="py-2 pr-2">Ativo</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-mono font-semibold">{c.code}</td>
                        <td className="py-2 pr-2">{c.discount_percent}%</td>
                        <td className="py-2 pr-2">{c.uses_count}</td>
                        <td className="py-2 pr-2"><Switch checked={c.is_active} onCheckedChange={() => toggle(c)} /></td>
                        <td className="py-2 text-right">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------- 3. Níveis ----------------
type Level = {
  id: string; name: string; minimum_points: number; display_order: number;
  active: boolean; benefits: any;
};

const LEVEL_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-700",
  PRATA: "bg-slate-400",
  SILVER: "bg-slate-400",
  OURO: "bg-yellow-500",
  GOLD: "bg-yellow-500",
  DIAMANTE: "bg-sky-500",
  DIAMOND: "bg-sky-500",
};

function LevelsTab({ restaurantId }: { restaurantId: string }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.from("loyalty_levels").select("*")
      .eq("restaurant_id", restaurantId).order("minimum_points", { ascending: true });
    setLevels((data ?? []) as Level[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [restaurantId]);

  async function update(l: Level) {
    const { error } = await supabase.from("loyalty_levels").update({
      name: l.name, minimum_points: l.minimum_points, active: l.active,
    }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Nível atualizado");
    refresh();
  }

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-3">
      {levels.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum nível cadastrado ainda para este restaurante.
        </CardContent></Card>
      ) : levels.map((l) => (
        <LevelRow key={l.id} level={l} onSave={update} />
      ))}
    </div>
  );
}

function LevelRow({ level, onSave }: { level: Level; onSave: (l: Level) => void }) {
  const [name, setName] = useState(level.name);
  const [min, setMin] = useState(level.minimum_points);
  const [active, setActive] = useState(level.active);
  const color = LEVEL_COLORS[name.toUpperCase()] ?? "bg-primary";

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-full text-white ${color}`}>
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-[140px] flex-1 space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-32 space-y-1">
          <Label className="text-xs">Mín. pontos</Label>
          <Input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <Switch checked={active} onCheckedChange={setActive} />
          <span className="text-sm text-muted-foreground">Ativo</span>
        </div>
        <Button size="sm" onClick={() => onSave({ ...level, name, minimum_points: min, active })}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------- 4. Clientes ----------------
function CustomersTab({ restaurantId }: { restaurantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["loyalty-customers", restaurantId],
    queryFn: async () => {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, name, phone, total_orders, total_spent")
        .eq("restaurant_id", restaurantId)
        .order("total_spent", { ascending: false })
        .limit(100);
      const ids = (custs ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const [{ data: pts }, { data: last }] = await Promise.all([
        supabase.from("customer_loyalty")
          .select("customer_id, points_balance, lifetime_points, level")
          .in("customer_id", ids).eq("restaurant_id", restaurantId),
        supabase.from("loyalty_transactions")
          .select("customer_id, created_at, transaction_type")
          .in("customer_id", ids).eq("restaurant_id", restaurantId)
          .eq("transaction_type", "REDEEM").order("created_at", { ascending: false }),
      ]);
      const ptsMap = new Map((pts ?? []).map((p: any) => [p.customer_id, p]));
      const lastMap = new Map<string, string>();
      for (const t of (last ?? []) as any[]) if (!lastMap.has(t.customer_id)) lastMap.set(t.customer_id, t.created_at);
      return (custs ?? []).map((c) => {
        const p = ptsMap.get(c.id) as any;
        return {
          ...c,
          balance: p?.points_balance ?? 0,
          lifetime: p?.lifetime_points ?? 0,
          level: p?.level ?? "—",
          lastRedeem: lastMap.get(c.id) ?? null,
        };
      }).sort((a, b) => b.balance - a.balance);
    },
  });

  if (isLoading) return <LoadingCard />;
  const rows = data ?? [];

  return (
    <Card>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente pontuando ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3">#</th><th className="p-3">Cliente</th>
                  <th className="p-3">Nível</th><th className="p-3">Saldo</th>
                  <th className="p-3">Pedidos</th><th className="p-3">Último resgate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </td>
                    <td className="p-3"><Badge variant="outline">{c.level}</Badge></td>
                    <td className="p-3 font-semibold text-primary">{c.balance} pts</td>
                    <td className="p-3">{c.total_orders}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {c.lastRedeem ? new Date(c.lastRedeem).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- 5. Analytics ----------------
function AnalyticsTab({ restaurantId }: { restaurantId: string }) {
  const statsFn = useServerFn(getRestaurantLoyaltyStats);
  const analyticsFn = useServerFn(getRestaurantLoyaltyAnalytics);
  const statsQ = useQuery({ queryKey: ["loyalty-stats", restaurantId], queryFn: () => statsFn({ data: { restaurantId } }) });
  const analyticsQ = useQuery({ queryKey: ["loyalty-analytics", restaurantId], queryFn: () => analyticsFn({ data: { restaurantId } }) });

  const s = statsQ.data; const a = analyticsQ.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI icon={<Users className="h-4 w-4" />} label="Clientes fidelizados" value={String(s?.participatingCustomers ?? "—")} />
        <KPI icon={<Sparkles className="h-4 w-4" />} label="Pontos emitidos" value={String(s?.pointsIssued ?? "—")} />
        <KPI icon={<Gift className="h-4 w-4" />} label="Pontos resgatados" value={String(s?.pointsRedeemed ?? "—")} />
        <KPI icon={<Timer className="h-4 w-4" />} label="Pontos expirados" value={String(s?.pointsExpired ?? "—")} />
        <KPI icon={<DollarSign className="h-4 w-4" />} label="Descontos concedidos" value={s ? brl(s.discountsGiven) : "—"} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI icon={<Activity className="h-4 w-4" />} label="Clientes ativos" value={String(a?.activeCustomers ?? "—")} />
        <KPI icon={<Users className="h-4 w-4" />} label="Sem resgate" value={String(a?.neverRedeemed ?? "—")} />
        <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Com pts expirando" value={String(a?.expiringSoonCustomers ?? "—")} />
        <KPI icon={<Percent className="h-4 w-4" />} label="Taxa de utilização" value={a ? `${(a.utilizationRate * 100).toFixed(1)}%` : "—"} />
        <KPI icon={<Percent className="h-4 w-4" />} label="Taxa de expiração" value={a ? `${(a.expirationRate * 100).toFixed(1)}%` : "—"} />
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold">Balanço de pontos</p>
          <PointsBar
            issued={s?.pointsIssued ?? 0}
            redeemed={s?.pointsRedeemed ?? 0}
            expired={s?.pointsExpired ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function PointsBar({ issued, redeemed, expired }: { issued: number; redeemed: number; expired: number }) {
  const total = Math.max(1, issued);
  const rPct = Math.min(100, (redeemed / total) * 100);
  const ePct = Math.min(100 - rPct, (expired / total) * 100);
  const active = Math.max(0, 100 - rPct - ePct);
  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-500" style={{ width: `${rPct}%` }} />
        <div className="bg-rose-500" style={{ width: `${ePct}%` }} />
        <div className="bg-primary/60" style={{ width: `${active}%` }} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendDot color="bg-emerald-500" label={`Resgatados (${redeemed})`} />
        <LegendDot color="bg-rose-500" label={`Expirados (${expired})`} />
        <LegendDot color="bg-primary/60" label={`Em circulação`} />
      </div>
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

// ---------------- 6. Campanhas ----------------
type Rule = {
  id: string; name: string; rule_type: string; config: any; active: boolean;
  starts_at: string | null; ends_at: string | null; priority: number;
};

const CAMPAIGN_TEMPLATES = [
  { key: "DOUBLE_POINTS", label: "Dobro de pontos", icon: Sparkles, desc: "Multiplicador em pedidos elegíveis" },
  { key: "BIRTHDAY_BONUS", label: "Aniversário", icon: Gift, desc: "Pontos extras no mês do cliente" },
  { key: "FIRST_PURCHASE_BONUS", label: "Primeira compra", icon: Trophy, desc: "Bônus na primeira compra" },
  { key: "SPECIAL_DATE", label: "Datas especiais", icon: Megaphone, desc: "Datas comemorativas" },
  { key: "WEEKDAY", label: "Dias da semana", icon: Timer, desc: "Ex.: terça em dobro" },
];

function CampaignsTab({ restaurantId }: { restaurantId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase.from("loyalty_rules").select("*")
      .eq("restaurant_id", restaurantId).order("priority", { ascending: true });
    setRules((data ?? []) as Rule[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [restaurantId]);

  async function toggle(r: Rule) {
    const { error } = await supabase.from("loyalty_rules").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message); refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-semibold">Modelos de campanha</p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {CAMPAIGN_TEMPLATES.map(({ key, label, icon: Icon, desc }) => (
              <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Campanhas cadastradas</p>
            <Badge variant="outline">{rules.length}</Badge>
          </div>
          {loading ? <LoadingCard inline /> : rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma campanha cadastrada. Os modelos acima serão liberados nos próximos ciclos.
            </p>
          ) : (
            <div className="divide-y">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.rule_type} · prio {r.priority}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={r.active ? "default" : "outline"}>{r.active ? "Ativa" : "Pausada"}</Badge>
                    <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Shared ----------------
function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function LoadingCard({ inline }: { inline?: boolean } = {}) {
  return (
    <div className={inline ? "py-6 text-center" : "grid place-items-center py-20"}>
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}
