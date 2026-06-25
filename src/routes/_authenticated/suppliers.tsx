import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listMarketplace, toggleFavorite, requestQuote, listMyQuotes,
  recordPurchase, getPurchasingDashboard, generatePurchasingInsights,
} from "@/lib/suppliers.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  Store, Search, Heart, Sparkles, Loader2, ShoppingCart, TrendingDown,
  Package, MessageSquare, Star, Beef, CupSoda, Box, Leaf, SprayCan, Snowflake, IceCream,
} from "lucide-react";

const CATEGORIES = [
  { key: "Carnes", icon: Beef },
  { key: "Bebidas", icon: CupSoda },
  { key: "Embalagens", icon: Box },
  { key: "Hortifruti", icon: Leaf },
  { key: "Limpeza", icon: SprayCan },
  { key: "Congelados", icon: Snowflake },
  { key: "Sobremesas", icon: IceCream },
] as const;

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Marketplace de Compras — Localix" }] }),
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
  component: SuppliersPage,
});

function SuppliersPage() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext() as { user: { id: string } };

  const list = useServerFn(listMarketplace);
  const toggleFav = useServerFn(toggleFavorite);
  const reqQuote = useServerFn(requestQuote);
  const myQuotes = useServerFn(listMyQuotes);
  const recPurchase = useServerFn(recordPurchase);
  const dash = useServerFn(getPurchasingDashboard);
  const aiFn = useServerFn(generatePurchasingInsights);

  const { data, isLoading } = useQuery({ queryKey: ["marketplace"], queryFn: () => list() });
  const { data: dashboard } = useQuery({ queryKey: ["purchasing-dashboard"], queryFn: () => dash() });
  const { data: quotes } = useQuery({ queryKey: ["my-quotes"], queryFn: () => myQuotes() });

  const { data: myRestaurant } = useQuery({
    queryKey: ["my-restaurant", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("restaurants").select("id, name").eq("owner_id", user.id).maybeSingle();
      return data;
    },
  });

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>("");

  const favMut = useMutation({
    mutationFn: (supplierId: string) => toggleFav({ data: { supplierId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplace"] }),
  });
  const quoteMut = useMutation({
    mutationFn: (vars: { supplierId: string; productName: string; quantity: number; unit: string; message?: string }) =>
      reqQuote({ data: vars }),
    onSuccess: () => {
      toast.success("Orçamento enviado");
      qc.invalidateQueries({ queryKey: ["my-quotes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const buyMut = useMutation({
    mutationFn: (vars: { supplierId: string; productName: string; quantity: number; unit: string; unitPrice: number; referencePrice?: number }) =>
      recPurchase({ data: vars }),
    onSuccess: () => {
      toast.success("Compra registrada");
      qc.invalidateQueries({ queryKey: ["purchasing-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const aiMut = useMutation({
    mutationFn: () => aiFn({ data: { restaurantId: myRestaurant?.id } }),
    onSuccess: (r) => setInsights(r.insights),
    onError: (e: Error) => toast.error(e.message),
  });

  const products = data?.products ?? [];
  const suppliers = data?.suppliers ?? [];
  const favorites = new Set(data?.favoriteIds ?? []);

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat && p.category !== activeCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, activeCat]);

  // Group by product name for price comparison; pick min as reference
  const comparisons = useMemo(() => {
    const map = new Map<string, typeof products>();
    for (const p of filteredProducts) {
      const k = `${p.name}|${p.unit}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()].map(([k, items]) => ({
      key: k,
      name: items[0].name,
      unit: items[0].unit,
      category: items[0].category,
      offers: items.sort((a, b) => Number(a.price) - Number(b.price)),
    }));
  }, [filteredProducts]);

  if (isLoading) {
    return <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Marketplace de Compras</h1>
          <p className="text-sm text-muted-foreground">Compare fornecedores, peça orçamentos e economize com a IA de compras.</p>
        </div>
        <Button variant="outline" onClick={() => aiMut.mutate()} disabled={aiMut.isPending}>
          <Sparkles className="mr-2 h-4 w-4" /> {aiMut.isPending ? "Analisando..." : "IA de Compras"}
        </Button>
      </div>

      {/* Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={TrendingDown} label="Economia gerada" value={brl(dashboard?.savings ?? 0)} accent="from-emerald-500/15 to-emerald-500/0" />
        <Kpi icon={ShoppingCart} label="Total comprado" value={brl(dashboard?.totalSpent ?? 0)} accent="from-primary/15 to-primary/0" />
        <Kpi icon={Package} label="Compras" value={(dashboard?.ordersCount ?? 0).toString()} accent="from-amber-500/15 to-amber-500/0" />
        <Kpi icon={Star} label="Favoritos" value={(dashboard?.favoritesCount ?? 0).toString()} accent="from-pink-500/15 to-pink-500/0" />
      </div>

      {insights && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5">
          <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-semibold">IA de Compras</h2></div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{insights}</pre>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou fornecedor..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryChip label="Todas" active={!activeCat} onClick={() => setActiveCat(null)} />
          {CATEGORIES.map((c) => (
            <CategoryChip key={c.key} label={c.key} icon={c.icon} active={activeCat === c.key} onClick={() => setActiveCat(c.key)} />
          ))}
        </div>
      </div>

      {/* Comparações de preço */}
      <div className="grid gap-4 md:grid-cols-2">
        {comparisons.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">Nenhum produto encontrado.</Card>
        )}
        {comparisons.map((c) => {
          const best = c.offers[0];
          const worst = c.offers[c.offers.length - 1];
          const savePct = c.offers.length > 1 ? ((Number(worst.price) - Number(best.price)) / Number(worst.price)) * 100 : 0;
          return (
            <Card key={c.key} className="overflow-hidden border-border/60">
              <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{c.category}</div>
                  <div className="font-semibold">{c.name}</div>
                </div>
                {savePct > 0 && (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    <TrendingDown className="h-3 w-3" /> Até {savePct.toFixed(0)}% mais barato
                  </Badge>
                )}
              </div>
              <ul className="divide-y">
                {c.offers.map((o, idx) => {
                  const s = supplierMap.get(o.supplier_id);
                  if (!s) return null;
                  const isBest = idx === 0;
                  const isFav = favorites.has(s.id);
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {s.name}
                          {isBest && <Badge className="bg-emerald-500 text-white">Melhor preço</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{s.city} · {s.phone ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="font-semibold">{brl(Number(o.price))}</div>
                          <div className="text-[10px] text-muted-foreground">/ {o.unit}</div>
                        </div>
                        <button
                          aria-label="Favoritar"
                          onClick={() => favMut.mutate(s.id)}
                          className={`grid h-8 w-8 place-items-center rounded-md border ${isFav ? "border-pink-500 bg-pink-500/10 text-pink-600" : "text-muted-foreground hover:bg-accent"}`}
                        >
                          <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                        </button>
                        <QuoteDialog
                          supplierName={s.name}
                          defaultProduct={c.name}
                          defaultUnit={c.unit}
                          onSubmit={(v) => quoteMut.mutate({ supplierId: s.id, ...v })}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => buyMut.mutate({
                            supplierId: s.id, productName: c.name, quantity: 1, unit: c.unit,
                            unitPrice: Number(o.price), referencePrice: Number(worst.price),
                          })}
                        >
                          Comprar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Quotes list */}
      <Card className="border-border/60">
        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" /> Meus orçamentos</h2>
          <Badge variant="outline">{quotes?.length ?? 0}</Badge>
        </div>
        {(quotes?.length ?? 0) === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum orçamento enviado.</div>
        ) : (
          <ul className="divide-y">
            {quotes!.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{q.product_name} · {q.quantity} {q.unit}</div>
                  <div className="text-xs text-muted-foreground">
                    {(q as { suppliers?: { name?: string } | null }).suppliers?.name ?? "Fornecedor"} · {new Date(q.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge variant={q.status === "pendente" ? "secondary" : "default"}>{q.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
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

function CategoryChip({ label, icon: Icon, active, onClick }: { label: string; icon?: React.ComponentType<{ className?: string }>; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function QuoteDialog({ supplierName, defaultProduct, defaultUnit, onSubmit }: {
  supplierName: string;
  defaultProduct: string;
  defaultUnit: string;
  onSubmit: (v: { productName: string; quantity: number; unit: string; message?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productName: defaultProduct, quantity: 1, unit: defaultUnit, message: "" });
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setForm({ productName: defaultProduct, quantity: 1, unit: defaultUnit, message: "" }); }}>
      <DialogTrigger asChild>
        <Button size="sm">Orçamento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar orçamento — {supplierName}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label className="text-xs">Produto</Label><Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-xs">Quantidade</Label><Input type="number" min={0.1} step={0.1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs">Unidade</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          </div>
          <div className="grid gap-1.5"><Label className="text-xs">Mensagem</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <Button onClick={() => {
            if (!form.productName || form.quantity <= 0) return toast.error("Preencha produto e quantidade");
            onSubmit({ productName: form.productName, quantity: form.quantity, unit: form.unit, message: form.message || undefined });
            setOpen(false);
          }}>Enviar pedido de orçamento</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
