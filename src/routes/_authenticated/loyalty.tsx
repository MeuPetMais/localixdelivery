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

// ---------------- 2. Benefícios (campanhas de recompensa) ----------------
// Persistência: tabela existente `loyalty_rules` (rule_type + config jsonb).
// Nenhuma regra de domínio é alterada — a UI é apenas um catálogo editável
// sobre a mesma tabela que a aba Campanhas já consome.

type BenefitType =
  | "FREE_PRODUCT" | "DISCOUNT" | "FREE_DELIVERY"
  | "CASHBACK"     | "COUPON"   | "GIFT";

type TriggerKind = "POINTS" | "ORDERS" | "PRODUCTS" | "SPENT";

type BenefitConfig = {
  ui_kind: BenefitType;
  trigger: { kind: TriggerKind; qty: number; product_name?: string };
  reward: {
    product_name?: string;
    discount_percent?: number;
    cashback_amount?: number;
    coupon_code?: string;
    gift_note?: string;
  };
  starts_at?: string | null;
  ends_at?: string | null;
};

type Benefit = {
  id: string; restaurant_id: string; name: string; rule_type: string;
  config: BenefitConfig | any; active: boolean;
  starts_at: string | null; ends_at: string | null; priority: number;
};

const BENEFIT_TYPES: Array<{
  key: BenefitType; label: string; icon: any; hint: string; supported: boolean;
}> = [
  { key: "FREE_PRODUCT",  label: "Produto grátis", icon: Gift,       hint: "Junte X e ganhe um",              supported: true },
  { key: "DISCOUNT",      label: "Desconto",       icon: Percent,    hint: "% em pedidos elegíveis",           supported: true },
  { key: "FREE_DELIVERY", label: "Frete grátis",   icon: Truck,      hint: "Isentar taxa de entrega",          supported: true },
  { key: "CASHBACK",      label: "Cashback",       icon: DollarSign, hint: "Valor em R$ para próxima compra",  supported: true },
  { key: "COUPON",        label: "Cupom",          icon: Ticket,     hint: "Código promocional",               supported: true },
  { key: "GIFT",          label: "Brinde",         icon: Package,    hint: "Item cortesia sem custo extra",    supported: true },
];

const TRIGGER_LABEL: Record<TriggerKind, string> = {
  POINTS: "Pontos acumulados", ORDERS: "Nº de pedidos",
  PRODUCTS: "Nº de produtos",  SPENT: "Valor gasto (R$)",
};

function typeMeta(k: BenefitType) { return BENEFIT_TYPES.find((t) => t.key === k) ?? BENEFIT_TYPES[0]; }

function describeTrigger(c: BenefitConfig): string {
  const t = c?.trigger; if (!t) return "—";
  switch (t.kind) {
    case "POINTS":   return `Acumule ${t.qty} pontos`;
    case "ORDERS":   return `Complete ${t.qty} pedidos`;
    case "PRODUCTS": return `Compre ${t.qty} ${t.product_name || "produtos"}`;
    case "SPENT":    return `Gaste ${brl(Number(t.qty || 0))}`;
  }
}
function describeReward(c: BenefitConfig): string {
  const r = c?.reward ?? {}; const k = c?.ui_kind;
  if (k === "FREE_PRODUCT") return `Ganhe 1 ${r.product_name || "produto"}`;
  if (k === "DISCOUNT")     return `${r.discount_percent ?? 0}% de desconto`;
  if (k === "FREE_DELIVERY")return `Frete grátis`;
  if (k === "CASHBACK")     return `${brl(Number(r.cashback_amount || 0))} de cashback`;
  if (k === "COUPON")       return `Cupom ${r.coupon_code || ""}`.trim();
  if (k === "GIFT")         return `Brinde: ${r.gift_note || "cortesia"}`;
  return "—";
}

function BenefitsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ["loyalty-benefits", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loyalty_rules").select("*")
        .eq("restaurant_id", restaurantId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Benefit[];
    },
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing]       = useState<Benefit | null>(null);
  const [seedType, setSeedType]     = useState<BenefitType | null>(null);

  function openNew(t?: BenefitType) { setEditing(null); setSeedType(t ?? null); setWizardOpen(true); }
  function openEdit(b: Benefit)     { setEditing(b);    setSeedType(null);      setWizardOpen(true); }

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loyalty_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Benefício excluído"); qc.invalidateQueries({ queryKey: ["loyalty-benefits"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir"),
  });
  const toggle = useMutation({
    mutationFn: async (b: Benefit) => {
      const { error } = await supabase.from("loyalty_rules").update({ active: !b.active }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loyalty-benefits"] }),
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });
  const duplicate = useMutation({
    mutationFn: async (b: Benefit) => {
      const { error } = await supabase.from("loyalty_rules").insert({
        restaurant_id: restaurantId,
        name: `${b.name} (cópia)`,
        rule_type: b.rule_type,
        config: b.config,
        active: false,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        priority: (b.priority ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Duplicado"); qc.invalidateQueries({ queryKey: ["loyalty-benefits"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao duplicar"),
  });

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Cabeçalho orientado ao negócio */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold">Central de Benefícios</h2>
              <p className="text-sm text-muted-foreground">
                Crie campanhas como "junte 10 pizzas e ganhe outra", "gaste R$300 e ganhe frete grátis" ou "500 pontos = 1 produto".
              </p>
            </div>
            <Button onClick={() => openNew()}><Plus className="mr-1.5 h-4 w-4" />Nova campanha</Button>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comece por um tipo</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {BENEFIT_TYPES.map(({ key, label, icon: Icon, hint, supported }) => (
              <button
                key={key}
                type="button"
                disabled={!supported}
                onClick={() => openNew(key)}
                title={supported ? `Criar ${label}` : "Disponível em breve."}
                className="group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? <LoadingCard inline /> : rows.length === 0 ? (
            <div className="p-8 text-center">
              <Gift className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma campanha cadastrada</p>
              <p className="mb-3 text-xs text-muted-foreground">Escolha um tipo acima ou clique em "Nova campanha".</p>
              <Button size="sm" onClick={() => openNew()}><Plus className="mr-1.5 h-4 w-4" />Criar primeira campanha</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="p-3">Nome</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Como desbloquear</th>
                    <th className="p-3">Recompensa</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const cfg: BenefitConfig = (b.config as any) ?? { ui_kind: "DISCOUNT", trigger: { kind: "POINTS", qty: 0 }, reward: {} };
                    const meta = typeMeta(cfg.ui_kind);
                    const Icon = meta.icon;
                    return (
                      <tr key={b.id} className="border-b last:border-0 align-top">
                        <td className="p-3 font-medium">{b.name}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs">
                            <Icon className="h-3.5 w-3.5 text-primary" />{meta.label}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{describeTrigger(cfg)}</td>
                        <td className="p-3">{describeReward(cfg)}</td>
                        <td className="p-3">
                          <Badge variant={b.active ? "default" : "outline"}>{b.active ? "Ativa" : "Pausada"}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => openEdit(b)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Duplicar" onClick={() => duplicate.mutate(b)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title={b.active ? "Pausar" : "Ativar"} onClick={() => toggle.mutate(b)}>
                              {b.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir"
                              onClick={() => { if (confirm(`Excluir "${b.name}"?`)) remove.mutate(b.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <BenefitWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        restaurantId={restaurantId}
        editing={editing}
        seedType={seedType}
        onSaved={() => qc.invalidateQueries({ queryKey: ["loyalty-benefits"] })}
      />
    </div>
  );
}

// ---------------- Wizard de benefício (7 passos) ----------------
function BenefitWizard({
  open, onOpenChange, restaurantId, editing, seedType, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId: string;
  editing: Benefit | null;
  seedType: BenefitType | null;
  onSaved: () => void;
}) {
  const emptyCfg: BenefitConfig = {
    ui_kind: seedType ?? "FREE_PRODUCT",
    trigger: { kind: "PRODUCTS", qty: 10, product_name: "" },
    reward: {},
    starts_at: null, ends_at: null,
  };

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [cfg, setCfg] = useState<BenefitConfig>(emptyCfg);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1); setSaving(false);
    if (editing) {
      const c = (editing.config as BenefitConfig) ?? emptyCfg;
      setName(editing.name);
      setCfg({
        ...emptyCfg, ...c,
        trigger: { ...emptyCfg.trigger, ...(c.trigger ?? {}) },
        reward: { ...(c.reward ?? {}) },
        starts_at: editing.starts_at, ends_at: editing.ends_at,
      });
    } else {
      setName("");
      setCfg({ ...emptyCfg, ui_kind: seedType ?? "FREE_PRODUCT" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, seedType]);

  const meta = typeMeta(cfg.ui_kind);

  function next() { setStep((s) => Math.min(6, s + 1)); }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  const canNext = (() => {
    if (step === 1) return !!cfg.ui_kind;
    if (step === 2) return name.trim().length >= 2;
    if (step === 3) return cfg.trigger.qty > 0;
    if (step === 4) {
      const r = cfg.reward;
      if (cfg.ui_kind === "FREE_PRODUCT") return !!r.product_name?.trim();
      if (cfg.ui_kind === "DISCOUNT")     return !!r.discount_percent && r.discount_percent > 0 && r.discount_percent <= 100;
      if (cfg.ui_kind === "FREE_DELIVERY")return true;
      if (cfg.ui_kind === "CASHBACK")     return !!r.cashback_amount && r.cashback_amount > 0;
      if (cfg.ui_kind === "COUPON")       return !!r.coupon_code?.trim();
      if (cfg.ui_kind === "GIFT")         return !!r.gift_note?.trim();
    }
    return true;
  })();

  async function save() {
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      name: name.trim(),
      rule_type: cfg.ui_kind,
      config: { ...cfg, starts_at: cfg.starts_at || null, ends_at: cfg.ends_at || null },
      active: true,
      starts_at: cfg.starts_at || null,
      ends_at: cfg.ends_at || null,
      priority: 10,
    };
    const q = editing
      ? supabase.from("loyalty_rules").update(payload).eq("id", editing.id)
      : supabase.from("loyalty_rules").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Benefício atualizado" : "Benefício criado");
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon className="h-5 w-5 text-primary" />
            {editing ? "Editar benefício" : "Nova recompensa"}
            <Badge variant="outline" className="ml-2">Passo {step} de 6</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Tipo</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {BENEFIT_TYPES.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setCfg({ ...cfg, ui_kind: key })}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${cfg.ui_kind === key ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1.5">
              <Label>Nome da campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Junte 10 pizzas e ganhe outra" autoFocus />
              <p className="text-xs text-muted-foreground">Este nome aparece para você — o cliente verá a descrição do benefício.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Regra para ganhar</Label>
                <Select value={cfg.trigger.kind} onValueChange={(v) => setCfg({ ...cfg, trigger: { ...cfg.trigger, kind: v as TriggerKind } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRIGGER_LABEL) as TriggerKind[]).map((k) => (
                      <SelectItem key={k} value={k}>{TRIGGER_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{cfg.trigger.kind === "SPENT" ? "Valor (R$)" : "Quantidade"}</Label>
                  <Input type="number" min={1} step={cfg.trigger.kind === "SPENT" ? "0.5" : "1"}
                    value={cfg.trigger.qty}
                    onChange={(e) => setCfg({ ...cfg, trigger: { ...cfg.trigger, qty: Number(e.target.value) } })} />
                </div>
                {cfg.trigger.kind === "PRODUCTS" && (
                  <div className="space-y-1.5">
                    <Label>Produto (opcional)</Label>
                    <Input value={cfg.trigger.product_name ?? ""} placeholder="Ex.: pizza, hambúrguer"
                      onChange={(e) => setCfg({ ...cfg, trigger: { ...cfg.trigger, product_name: e.target.value } })} />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Prévia: <b>{describeTrigger(cfg)}</b></p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Selecionar recompensa</p>
              {cfg.ui_kind === "FREE_PRODUCT" && (
                <div className="space-y-1.5">
                  <Label>Produto grátis</Label>
                  <Input value={cfg.reward.product_name ?? ""} placeholder="Ex.: 1 pizza média"
                    onChange={(e) => setCfg({ ...cfg, reward: { ...cfg.reward, product_name: e.target.value } })} />
                </div>
              )}
              {cfg.ui_kind === "DISCOUNT" && (
                <div className="space-y-1.5">
                  <Label>Desconto (%)</Label>
                  <Input type="number" min={1} max={100} value={cfg.reward.discount_percent ?? ""}
                    onChange={(e) => setCfg({ ...cfg, reward: { ...cfg.reward, discount_percent: Number(e.target.value) } })} />
                </div>
              )}
              {cfg.ui_kind === "FREE_DELIVERY" && (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">O cliente terá a taxa de entrega isentada no pedido elegível.</p>
              )}
              {cfg.ui_kind === "CASHBACK" && (
                <div className="space-y-1.5">
                  <Label>Cashback (R$)</Label>
                  <Input type="number" min={0.5} step="0.5" value={cfg.reward.cashback_amount ?? ""}
                    onChange={(e) => setCfg({ ...cfg, reward: { ...cfg.reward, cashback_amount: Number(e.target.value) } })} />
                </div>
              )}
              {cfg.ui_kind === "COUPON" && (
                <div className="space-y-1.5">
                  <Label>Código do cupom</Label>
                  <Input value={cfg.reward.coupon_code ?? ""} placeholder="BEMVINDO10"
                    onChange={(e) => setCfg({ ...cfg, reward: { ...cfg.reward, coupon_code: e.target.value.toUpperCase() } })} />
                </div>
              )}
              {cfg.ui_kind === "GIFT" && (
                <div className="space-y-1.5">
                  <Label>Descrição do brinde</Label>
                  <Input value={cfg.reward.gift_note ?? ""} placeholder="Ex.: refrigerante 350ml"
                    onChange={(e) => setCfg({ ...cfg, reward: { ...cfg.reward, gift_note: e.target.value } })} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">Prévia: <b>{describeReward(cfg)}</b></p>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início (opcional)</Label>
                <Input type="date" value={cfg.starts_at ?? ""} onChange={(e) => setCfg({ ...cfg, starts_at: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Validade (opcional)</Label>
                <Input type="date" value={cfg.ends_at ?? ""} onChange={(e) => setCfg({ ...cfg, ends_at: e.target.value || null })} />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <p className="font-semibold">Resumo</p>
              <p><span className="text-muted-foreground">Tipo:</span> {meta.label}</p>
              <p><span className="text-muted-foreground">Nome:</span> {name}</p>
              <p><span className="text-muted-foreground">Desbloqueio:</span> {describeTrigger(cfg)}</p>
              <p><span className="text-muted-foreground">Recompensa:</span> {describeReward(cfg)}</p>
              <p><span className="text-muted-foreground">Vigência:</span> {cfg.starts_at || "hoje"} → {cfg.ends_at || "sem prazo"}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={back} disabled={step === 1}>
            <ChevronLeft className="mr-1 h-4 w-4" />Voltar
          </Button>
          {step < 6 ? (
            <Button onClick={next} disabled={!canNext}>
              Avançar<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              {editing ? "Salvar alterações" : "Criar benefício"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
