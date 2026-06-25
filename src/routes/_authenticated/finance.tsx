import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Localix" }] }),
  component: FinancePage,
});

const REVENUE_CATEGORIES = ["Delivery", "Balcão", "Retirada"];
const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Salários",
  "Fornecedores",
  "Marketing",
  "Energia",
  "Água",
  "Internet",
  "Outros",
];

type Movement = {
  id: string;
  restaurant_id: string;
  type: "receita" | "despesa";
  category: string;
  description: string | null;
  amount: number;
  movement_date: string;
  created_at: string;
};

type Period = "daily" | "weekly" | "monthly" | "yearly";

const COLORS = ["#f97316", "#ef4444", "#8b5cf6", "#0ea5e9", "#10b981", "#eab308", "#ec4899", "#64748b"];

function startOfPeriod(p: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "daily") return d;
  if (p === "weekly") {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }
  if (p === "monthly") {
    d.setDate(1);
    return d;
  }
  d.setMonth(0, 1);
  return d;
}

function FinancePage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("monthly");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);

  async function refresh(restId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("financial_movements")
      .select("*")
      .eq("restaurant_id", restId)
      .order("movement_date", { ascending: false })
      .limit(500);
    setMovements((data ?? []) as Movement[]);
    setLoading(false);
  }

  useEffect(() => {
    if (restaurant?.id) refresh(restaurant.id);
  }, [restaurant?.id]);

  const filtered = useMemo(() => {
    const start = startOfPeriod(period);
    return movements.filter((m) => new Date(m.movement_date) >= start);
  }, [movements, period]);

  const totals = useMemo(() => {
    const receita = filtered.filter((m) => m.type === "receita").reduce((s, m) => s + Number(m.amount), 0);
    const despesa = filtered.filter((m) => m.type === "despesa").reduce((s, m) => s + Number(m.amount), 0);
    const allReceita = movements.filter((m) => m.type === "receita").reduce((s, m) => s + Number(m.amount), 0);
    const allDespesa = movements.filter((m) => m.type === "despesa").reduce((s, m) => s + Number(m.amount), 0);
    return {
      receita,
      despesa,
      lucro: receita - despesa,
      saldo: allReceita - allDespesa,
    };
  }, [filtered, movements]);

  const monthly = useMemo(() => {
    const map = new Map<string, { mes: string; receita: number; despesa: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, {
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        receita: 0,
        despesa: 0,
      });
    }
    movements.forEach((m) => {
      const key = m.movement_date.slice(0, 7);
      const row = map.get(key);
      if (row) {
        if (m.type === "receita") row.receita += Number(m.amount);
        else row.despesa += Number(m.amount);
      }
    });
    return Array.from(map.values());
  }, [movements]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((m) => m.type === "despesa")
      .forEach((m) => map.set(m.category, (map.get(m.category) ?? 0) + Number(m.amount)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const cashFlow = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => a.movement_date.localeCompare(b.movement_date));
    let saldo = 0;
    return sorted.map((m) => {
      saldo += m.type === "receita" ? Number(m.amount) : -Number(m.amount);
      return { date: new Date(m.movement_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), saldo };
    });
  }, [filtered]);

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta movimentação?")) return;
    const { error } = await supabase.from("financial_movements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Movimentação excluída");
    if (restaurant?.id) refresh(restaurant.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Controle entradas, saídas e lucro do seu negócio.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="daily">Diário</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensal</TabsTrigger>
              <TabsTrigger value="yearly">Anual</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova movimentação</Button>
            </DialogTrigger>
            <MovementDialog
              restaurantId={restaurant?.id}
              editing={editing}
              onSaved={() => { setDialogOpen(false); setEditing(null); if (restaurant?.id) refresh(restaurant.id); }}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Receita do período" value={brl(totals.receita)} icon={<ArrowUpCircle className="h-5 w-5 text-emerald-500" />} accent="emerald" />
        <MetricCard label="Despesas do período" value={brl(totals.despesa)} icon={<ArrowDownCircle className="h-5 w-5 text-red-500" />} accent="red" />
        <MetricCard label="Lucro estimado" value={brl(totals.lucro)} icon={<TrendingUp className="h-5 w-5 text-primary" />} accent="primary" />
        <MetricCard label="Saldo atual" value={brl(totals.saldo)} icon={<Wallet className="h-5 w-5 text-violet-500" />} accent="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Entradas x Saídas (mensal)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Despesas por categoria</h2>
          <div className="h-64">
            {byCategory.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Sem despesas no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-bold">Fluxo de caixa</h2>
          <div className="h-64">
            {cashFlow.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Sem movimentações no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-display text-lg font-bold">Movimentações</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} no período</span>
        </div>
        {loading ? (
          <div className="grid place-items-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma movimentação no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-left">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{new Date(m.movement_date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.type === "receita" ? "default" : "destructive"}>
                        {m.type === "receita" ? "Receita" : "Despesa"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{m.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.description || "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.type === "receita" ? "text-emerald-600" : "text-red-600"}`}>
                      {m.type === "receita" ? "+" : "-"} {brl(m.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
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

function MetricCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent: string }) {
  const ring: Record<string, string> = {
    emerald: "bg-emerald-500/10",
    red: "bg-red-500/10",
    primary: "bg-primary/10",
    violet: "bg-violet-500/10",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${ring[accent]}`}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
    </Card>
  );
}

function MovementDialog({
  restaurantId,
  editing,
  onSaved,
}: {
  restaurantId?: string;
  editing: Movement | null;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"receita" | "despesa">(editing?.type ?? "receita");
  const [category, setCategory] = useState(editing?.category ?? REVENUE_CATEGORIES[0]);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState<string>(editing ? String(editing.amount) : "");
  const [date, setDate] = useState(editing?.movement_date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setType(editing.type);
      setCategory(editing.category);
      setDescription(editing.description ?? "");
      setAmount(String(editing.amount));
      setDate(editing.movement_date);
    } else {
      setType("receita");
      setCategory(REVENUE_CATEGORIES[0]);
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [editing]);

  const categories = type === "receita" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0]);
  }, [type]);

  async function save() {
    if (!restaurantId) return;
    const val = Number(amount.replace(",", "."));
    if (!val || val <= 0) return toast.error("Informe um valor válido");
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      type,
      category,
      description: description || null,
      amount: val,
      movement_date: date,
    };
    const { error } = editing
      ? await supabase.from("financial_movements").update(payload).eq("id", editing.id)
      : await supabase.from("financial_movements").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Movimentação atualizada" : "Movimentação registrada");
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as "receita" | "despesa")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Pagamento fornecedor X" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editing ? "Salvar alterações" : "Registrar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
