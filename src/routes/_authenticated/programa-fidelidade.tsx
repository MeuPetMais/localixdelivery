import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Gift, TrendingUp, Users, Percent, DollarSign, AlertTriangle, Timer, Activity } from "lucide-react";
import { toast } from "sonner";
import { useRestaurant } from "@/contexts/RestaurantContext";
import {
  getRestaurantLoyaltySettings,
  saveRestaurantLoyaltySettings,
  getRestaurantLoyaltyStats,
  getRestaurantLoyaltyAnalytics,
  type LoyaltySettings,
} from "@/lib/loyalty.functions";

export const Route = createFileRoute("/_authenticated/programa-fidelidade")({
  head: () => ({ meta: [{ title: "Programa de Fidelidade — Localix" }] }),
  component: ProgramaFidelidadePage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProgramaFidelidadePage() {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const settingsFn = useServerFn(getRestaurantLoyaltySettings);
  const saveFn = useServerFn(saveRestaurantLoyaltySettings);
  const statsFn = useServerFn(getRestaurantLoyaltyStats);

  const settingsQ = useQuery({
    queryKey: ["loyalty-settings", restaurant?.id],
    queryFn: () => settingsFn({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant?.id,
  });

  const statsQ = useQuery({
    queryKey: ["loyalty-stats", restaurant?.id],
    queryFn: () => statsFn({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant?.id,
  });

  const [form, setForm] = useState<LoyaltySettings | null>(null);
  useEffect(() => { if (settingsQ.data) setForm(settingsQ.data); }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { restaurantId: restaurant!.id, settings: form! } }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["loyalty-settings"] });
      qc.invalidateQueries({ queryKey: ["loyalty-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  if (!restaurant) {
    return <div className="p-6 text-muted-foreground">Selecione um estabelecimento.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl">Programa de Fidelidade</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI icon={<Users className="h-4 w-4" />} label="Clientes fidelizados" value={String(statsQ.data?.participatingCustomers ?? "—")} />
        <KPI icon={<Sparkles className="h-4 w-4" />} label="Pontos emitidos" value={String(statsQ.data?.pointsIssued ?? "—")} />
        <KPI icon={<Gift className="h-4 w-4" />} label="Pontos resgatados" value={String(statsQ.data?.pointsRedeemed ?? "—")} />
        <KPI icon={<DollarSign className="h-4 w-4" />} label="Descontos concedidos" value={statsQ.data ? brl(statsQ.data.discountsGiven) : "—"} />
        <KPI icon={<TrendingUp className="h-4 w-4" />} label="Ticket com fidelidade" value={statsQ.data ? brl(statsQ.data.avgTicketWithLoyalty) : "—"} />
      </div>

      {/* Configuração */}
      <Card>
        <CardContent className="space-y-5 p-6">
          {settingsQ.isLoading || !form ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">Programa ativo</p>
                  <p className="text-xs text-muted-foreground">Quando ativo, os clientes acumulam e resgatam pontos.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Pontos por real gasto" hint="Ex.: 1 = 1 ponto para cada R$ 1">
                  <Input type="number" step="0.1" min={0.01} value={form.points_per_real}
                    onChange={(e) => setForm({ ...form, points_per_real: Number(e.target.value) })} />
                </Field>
                <Field label="Pedido mínimo para gerar pontos (R$)">
                  <Input type="number" step="0.5" min={0} value={form.min_order}
                    onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })} />
                </Field>
                <Field label="Pontos mínimos para resgate">
                  <Input type="number" min={1} value={form.min_redeem}
                    onChange={(e) => setForm({ ...form, min_redeem: Number(e.target.value) })} />
                </Field>
                <Field label="Percentual máximo de desconto por pedido">
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
