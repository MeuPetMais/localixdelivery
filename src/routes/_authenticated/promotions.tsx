import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flame, Plus, Loader2, Trash2, Image as ImageIcon, Calendar, Tag } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { promoStatus, discountPct, type PromoLike } from "@/lib/promotions";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({ meta: [{ title: "Promoções — Localix" }] }),
  component: PromotionsPage,
});

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  promo_campaign: string | null;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
};

type Category = { id: string; name: string };

const CAMPAIGNS = [
  "Promoção do Dia",
  "Happy Hour",
  "Combo Especial",
  "Semana da Pizza",
  "Black Friday",
  "Aniversário da Loja",
];

const QUICK_DISCOUNTS = [10, 15, 20, 30, 50];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function PromotionsPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const qc = useQueryClient();

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () =>
      (await supabase.from("restaurants").select("id,name").eq("owner_id", user.id).maybeSingle()).data,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    enabled: !!restaurant?.id,
    queryKey: ["categories", restaurant?.id],
    queryFn: async () =>
      ((await supabase.from("menu_categories").select("id,name").eq("restaurant_id", restaurant!.id).order("position")).data as Category[]) ?? [],
  });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    enabled: !!restaurant?.id,
    queryKey: ["promo-items", restaurant?.id],
    queryFn: async () =>
      ((await supabase
        .from("menu_items")
        .select("id,name,description,price,promo_price,promo_starts_at,promo_ends_at,promo_campaign,image_url,is_available,category_id")
        .eq("restaurant_id", restaurant!.id)
        .order("name")).data as Item[]) ?? [],
  });

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const promos = items.filter((i) => i.promo_price != null);
  const active = promos.filter((i) => promoStatus(i as PromoLike) === "active");
  const scheduled = promos.filter((i) => promoStatus(i as PromoLike) === "scheduled");
  const ended = promos.filter((i) => promoStatus(i as PromoLike) === "ended");

  const [filter, setFilter] = useState<"all" | "active" | "scheduled" | "ended">("all");
  const filtered =
    filter === "all" ? promos : filter === "active" ? active : filter === "scheduled" ? scheduled : ended;

  const [open, setOpen] = useState(false);

  async function removePromo(id: string) {
    if (!confirm("Remover esta promoção?")) return;
    const { error } = await supabase
      .from("menu_items")
      .update({ promo_price: null, promo_starts_at: null, promo_ends_at: null, promo_campaign: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Promoção removida");
    qc.invalidateQueries({ queryKey: ["promo-items"] });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
            <Flame className="h-6 w-6 text-destructive" /> Promoções
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie ofertas ativas, agendadas e encerradas em um só lugar.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Nova Promoção
            </Button>
          </DialogTrigger>
          <NewPromotionDialog
            items={items}
            categories={categories}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["promo-items"] });
            }}
          />
        </Dialog>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Ativas" value={active.length} tone="success" onClick={() => setFilter("active")} />
        <KPI label="Agendadas" value={scheduled.length} tone="info" onClick={() => setFilter("scheduled")} />
        <KPI label="Encerradas" value={ended.length} tone="muted" onClick={() => setFilter("ended")} />
        <KPI label="Total" value={promos.length} tone="default" onClick={() => setFilter("all")} />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "scheduled", "ended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
            }`}
          >
            {f === "all" ? "Todas" : f === "active" ? "Ativas" : f === "scheduled" ? "Agendadas" : "Encerradas"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Flame className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma promoção {filter !== "all" ? "nesse status" : "cadastrada"} ainda.</p>
          <Button onClick={() => setOpen(true)} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Criar primeira promoção
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((it) => {
            const status = promoStatus(it as PromoLike);
            const pct = discountPct(it as PromoLike);
            return (
              <Card key={it.id} className="group flex flex-col overflow-hidden rounded-2xl">
                <div className="relative h-36 w-full bg-muted">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <StatusBadge status={status} />
                  {pct > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-extrabold text-background">
                      -{pct}%
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-sm font-bold">{it.name}</h3>
                    <p className="text-xs text-muted-foreground">{it.category_id ? catName[it.category_id] : "Sem categoria"}</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-base font-extrabold text-primary">{brl(it.promo_price)}</span>
                    <span className="text-xs text-muted-foreground line-through">{brl(it.price)}</span>
                  </div>
                  {it.promo_campaign && (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold">
                      <Tag className="h-3 w-3" /> {it.promo_campaign}
                    </span>
                  )}
                  <div className="space-y-0.5 text-[11px] text-muted-foreground">
                    <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Início: {fmtDate(it.promo_starts_at)}</p>
                    <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Término: {fmtDate(it.promo_ends_at)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={() => removePromo(it.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "success" | "info" | "muted" | "default";
  onClick?: () => void;
}) {
  const toneCls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "info"
      ? "border-primary/30 bg-primary/5"
      : tone === "muted"
      ? "border-border bg-muted/30"
      : "border-border";
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${toneCls}`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof promoStatus> }) {
  const map = {
    active: { label: "Ativa", cls: "bg-success text-success-foreground" },
    scheduled: { label: "Agendada", cls: "bg-primary text-primary-foreground" },
    ended: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
    inactive: { label: "Inativa", cls: "bg-muted text-muted-foreground" },
  } as const;
  const m = map[status];
  return (
    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

function NewPromotionDialog({
  items,
  categories,
  onClose,
  onSaved,
}: {
  items: Item[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"percent" | "price">("percent");
  const [percent, setPercent] = useState<number>(10);
  const [price, setPrice] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");
  const [campaign, setCampaign] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const visible = items.filter(
    (i) => i.is_available && (search ? i.name.toLowerCase().includes(search.toLowerCase()) : true),
  );
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function save() {
    if (selectedIds.length === 0) return toast.error("Selecione ao menos um produto.");
    if (mode === "percent" && (percent <= 0 || percent >= 100)) return toast.error("Desconto inválido.");
    if (mode === "price" && !price) return toast.error("Informe o preço promocional.");

    setSaving(true);
    try {
      const updates = selectedIds.map((id) => {
        const it = items.find((x) => x.id === id)!;
        const promo =
          mode === "percent"
            ? Number((Number(it.price) * (1 - percent / 100)).toFixed(2))
            : Number(price);
        return supabase
          .from("menu_items")
          .update({
            promo_price: promo,
            promo_starts_at: fromLocalInput(startsAt),
            promo_ends_at: fromLocalInput(endsAt),
            promo_campaign: campaign || null,
          })
          .eq("id", id);
      });
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      toast.success(`${selectedIds.length} promoção(ões) criada(s).`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-destructive" /> Nova Promoção</DialogTitle>
        <DialogDescription>Selecione produtos e configure o desconto.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Quick discounts */}
        <div>
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Promoções rápidas</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_DISCOUNTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setMode("percent"); setPercent(p); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  mode === "percent" && percent === p
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {p}% OFF
              </button>
            ))}
          </div>
        </div>

        {/* Mode + value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">% de desconto</SelectItem>
                <SelectItem value="price">Preço promocional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "percent" ? (
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" min={1} max={99} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
            </div>
          ) : (
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Início</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">Deixe em branco para começar agora.</p>
          </div>
          <div>
            <Label>Término</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">Deixe em branco para sem prazo.</p>
          </div>
        </div>

        {/* Campaign */}
        <div>
          <Label>Campanha (opcional)</Label>
          <Select value={campaign || "__none"} onValueChange={(v) => setCampaign(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Sem campanha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem campanha</SelectItem>
              {CAMPAIGNS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products picker */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>Produtos ({selectedIds.length} selecionados)</Label>
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 max-w-[200px]"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
            {visible.length === 0 && (
              <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto disponível.</p>
            )}
            {visible.map((it) => (
              <label
                key={it.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-accent"
              >
                <Checkbox
                  checked={!!selected[it.id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [it.id]: !!v }))}
                />
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {it.image_url ? (
                    <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{it.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.category_id ? catName[it.category_id] : "Sem categoria"} · {brl(it.price)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flame className="mr-2 h-4 w-4" />}
          Salvar promoção
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
