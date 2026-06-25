import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { Crown, Repeat, UserPlus, MoonStar, Users, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "CRM — Clientes — Localix" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  total_orders: number;
  total_spent: number;
  avg_ticket: number;
  last_order_at: string | null;
};

type Segment = "vip" | "inativo" | "frequente" | "novo";

const SEG_META: Record<Segment, { label: string; tone: string }> = {
  vip: { label: "VIP", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  inativo: { label: "Inativo", tone: "bg-muted text-muted-foreground border-border" },
  frequente: { label: "Frequente", tone: "bg-primary/10 text-primary border-primary/30" },
  novo: { label: "Novo", tone: "bg-success/15 text-success border-success/30" },
};

function segmentOf(c: Customer): Segment {
  const days = c.last_order_at ? (Date.now() - new Date(c.last_order_at).getTime()) / 86400000 : Infinity;
  if (days > 30) return "inativo";
  if (Number(c.total_spent) > 300) return "vip";
  if (c.total_orders >= 3) return "frequente";
  return "novo";
}

function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Segment | "todos">("todos");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, total_orders, total_spent, avg_ticket, last_order_at")
        .order("last_order_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) toast.error("Falha ao carregar clientes");
      setItems((data ?? []) as Customer[]);
      setLoading(false);
    })();
  }, []);

  const segmented = useMemo(() => items.map((c) => ({ ...c, segment: segmentOf(c) })), [items]);

  const counts = useMemo(() => {
    const c = { total: segmented.length, vip: 0, frequente: 0, inativo: 0, novo: 0 };
    for (const s of segmented) c[s.segment]++;
    return c;
  }, [segmented]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return segmented.filter((c) => {
      if (filter !== "todos" && c.segment !== filter) return false;
      if (!term) return true;
      return c.name.toLowerCase().includes(term) || c.phone.includes(term);
    });
  }, [segmented, q, filter]);

  const cards = [
    { key: "todos", label: "Total de clientes", value: counts.total, icon: Users, tone: "text-foreground" },
    { key: "vip", label: "Clientes VIP", value: counts.vip, icon: Crown, tone: "text-amber-600 dark:text-amber-400" },
    { key: "frequente", label: "Frequentes", value: counts.frequente, icon: Repeat, tone: "text-primary" },
    { key: "inativo", label: "Inativos (30d+)", value: counts.inativo, icon: MoonStar, tone: "text-muted-foreground" },
  ] as const;

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">CRM · Clientes</h1>
        <p className="text-sm text-muted-foreground">Sua base de clientes é construída automaticamente a cada pedido recebido.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = filter === c.key || (c.key === "todos" && filter === "todos");
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key as any)}
              className={`text-left ${active ? "ring-2 ring-primary/40 rounded-xl" : ""}`}
            >
              <Card className="p-4 transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <Icon className={`h-4 w-4 ${c.tone}`} />
                </div>
                <p className={`mt-1 font-display text-3xl font-extrabold ${c.tone}`}>{c.value}</p>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "novo", "frequente", "vip", "inativo"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
              >
                {s === "todos" ? "Todos" : SEG_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Telefone</th>
                <th className="py-2 pr-4">Total gasto</th>
                <th className="py-2 pr-4">Pedidos</th>
                <th className="py-2 pr-4">Última compra</th>
                <th className="py-2 pr-4">Segmento</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.phone}</td>
                  <td className="py-3 pr-4 font-semibold">{brl(Number(c.total_spent))}</td>
                  <td className="py-3 pr-4">{c.total_orders}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className={SEG_META[c.segment].tone}>
                      {c.segment === "novo" && <UserPlus className="mr-1 h-3 w-3" />}
                      {c.segment === "frequente" && <Repeat className="mr-1 h-3 w-3" />}
                      {c.segment === "vip" && <Crown className="mr-1 h-3 w-3" />}
                      {c.segment === "inativo" && <MoonStar className="mr-1 h-3 w-3" />}
                      {SEG_META[c.segment].label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
