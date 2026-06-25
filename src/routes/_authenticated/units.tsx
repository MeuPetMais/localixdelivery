import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnits, upsertUnit, generateUnitsInsights } from "@/lib/units.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { brl, slugify } from "@/lib/format";
import { toast } from "sonner";
import { Building2, Plus, TrendingUp, Users, Wallet, ShoppingBag, Sparkles, Loader2, Trophy, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/units")({
  head: () => ({ meta: [{ title: "Multiunidades — Localix" }] }),
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
  component: UnitsPage,
});

function UnitsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUnits);
  const insightsFn = useServerFn(generateUnitsInsights);
  const upsertFn = useServerFn(upsertUnit);

  const { data, isLoading } = useQuery({ queryKey: ["units"], queryFn: () => listFn() });
  const [insights, setInsights] = useState<string>("");
  const insightsMut = useMutation({
    mutationFn: () => insightsFn(),
    onSuccess: (r) => setInsights(r.insights),
    onError: (e: Error) => toast.error(e.message),
  });

  type UpsertVars = Parameters<typeof onSubmitType>[0];
  const upsertMut = useMutation({
    mutationFn: (vars: UpsertVars) => upsertFn({ data: vars }),
    onSuccess: () => {
      toast.success("Unidade salva");
      qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const units = data?.units ?? [];
  const c = data?.consolidated ?? { revenue: 0, profit: 0, orders: 0, customers: 0 };
  const benchmark = data?.benchmark;
  const top = [...units].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground">Gestão de múltiplas unidades, benchmark de setor e IA estratégica — últimos 30 dias.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => insightsMut.mutate()} disabled={insightsMut.isPending}>
            <Sparkles className="mr-2 h-4 w-4" /> {insightsMut.isPending ? "Analisando..." : "Insights IA"}
          </Button>
          <UnitDialog onSubmit={(v) => upsertMut.mutate(v)} />
        </div>
      </div>

      {/* Visão Consolidada */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={Wallet} label="Receita total" value={brl(c.revenue)} accent="from-emerald-500/15 to-emerald-500/0" />
        <Kpi icon={TrendingUp} label="Lucro total" value={brl(c.profit)} accent="from-primary/15 to-primary/0" />
        <Kpi icon={ShoppingBag} label="Pedidos" value={c.orders.toLocaleString("pt-BR")} accent="from-amber-500/15 to-amber-500/0" />
        <Kpi icon={Users} label="Clientes" value={c.customers.toLocaleString("pt-BR")} accent="from-sky-500/15 to-sky-500/0" />
      </div>

      {/* Painel multiunidades */}
      <Card className="overflow-hidden border-border/60">
        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" /> Unidades ({units.length})</h2>
          {top && <Badge variant="secondary" className="gap-1"><Trophy className="h-3 w-3" /> Top: {top.name}</Badge>}
        </div>
        {units.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada. Adicione sua primeira unidade para começar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Unidade</th>
                  <th className="px-5 py-3 text-right">Receita</th>
                  <th className="px-5 py-3 text-right">Pedidos</th>
                  <th className="px-5 py-3 text-right">Ticket médio</th>
                  <th className="px-5 py-3 text-right">Lucro</th>
                  <th className="px-5 py-3 text-right">vs média</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const avg = c.revenue / units.length;
                  const delta = avg > 0 ? ((u.revenue - avg) / avg) * 100 : 0;
                  return (
                    <tr key={u.id} className="border-t hover:bg-muted/20">
                      <td className="px-5 py-3">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.address ?? "—"} · {u.manager_name ?? "Sem gerente"}</div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">{brl(u.revenue)}</td>
                      <td className="px-5 py-3 text-right">{u.orders}</td>
                      <td className="px-5 py-3 text-right">{brl(u.ticket)}</td>
                      <td className="px-5 py-3 text-right">{brl(u.profit)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3">
                        {u.active ? <Badge variant="default">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Benchmark */}
      <Card className="border-border/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Benchmark Inteligente</h2>
          {benchmark && <Badge variant="outline" className="ml-auto">Categoria: {benchmark.category} · {benchmark.sampleSize} restaurantes</Badge>}
        </div>
        {benchmark ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Bench label="Ticket médio do setor" value={brl(benchmark.avgTicket)} />
            <Bench label="Horário de pico" value={`${String(benchmark.peakHour).padStart(2, "0")}:00`} />
            <Bench label="Produto mais vendido" value={benchmark.topProduct ?? "—"} />
            <Bench label="Crescimento do setor" value={`${benchmark.sectorGrowth >= 0 ? "+" : ""}${benchmark.sectorGrowth.toFixed(1)}%`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Defina a <span className="font-medium">categoria</span> das suas unidades (ex.: Pizzaria, Hamburgueria) para ver comparativos do setor.</p>
        )}
      </Card>

      {/* Insights IA */}
      {insights && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-semibold">Insights da IA</h2></div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{insights}</pre>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: string }) {
  return (
    <Card className={`relative overflow-hidden border-border/60 bg-gradient-to-br ${accent} p-5`}>
      <Icon className="absolute right-3 top-3 h-5 w-5 text-muted-foreground/60" />
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
    </Card>
  );
}

function Bench({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function UnitDialog({ onSubmit }: { onSubmit: (v: { name: string; slug: string; category?: string; address?: string; phone?: string; whatsapp_phone?: string; manager_name?: string; active?: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", category: "", address: "", phone: "", whatsapp_phone: "", manager_name: "", active: true });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Nova unidade</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
          <Field label="Slug (URL)"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Input placeholder="Pizzaria, Hambúrguer..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Gerente"><Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></Field>
          </div>
          <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Ativa</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
          <Button
            onClick={() => {
              if (!form.name || !form.slug) return toast.error("Nome e slug obrigatórios");
              onSubmit(form);
              setOpen(false);
              setForm({ name: "", slug: "", category: "", address: "", phone: "", whatsapp_phone: "", manager_name: "", active: true });
            }}
          >
            Salvar unidade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
