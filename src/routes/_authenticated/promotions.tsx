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
import {
  Flame,
  Plus,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Calendar,
  Tag,
  Pause,
  Play,
  Copy,
  Pencil,
  Square,
  Search,
} from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  promoStatus,
  discountPct,
  type PromoLike,
  type PromoStatus,
  WEEKDAYS,
  CAMPAIGN_TEMPLATES,
} from "@/lib/promotions";

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
  is_paused: boolean;
  category_id: string | null;
  recurrence_days: number[] | null;
  recurrence_start_time: string | null;
  recurrence_end_time: string | null;
};

type Category = { id: string; name: string };

const QUICK_DISCOUNTS = [10, 15, 20, 30, 40, 50];

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
function summarizeRecurrence(item: Item): string | null {
  const days = item.recurrence_days ?? [];
  const hasDays = days.length > 0 && days.length < 7;
  const hasTime = !!(item.recurrence_start_time && item.recurrence_end_time);
  if (!hasDays && !hasTime) return null;
  const dayStr = hasDays ? days.map((d) => WEEKDAYS[d]?.label).filter(Boolean).join(", ") : "Todos os dias";
  const timeStr = hasTime ? `${item.recurrence_start_time!.slice(0, 5)}–${item.recurrence_end_time!.slice(0, 5)}` : "";
  return [dayStr, timeStr].filter(Boolean).join(" · ");
}

function PromotionsPage() {
  const qc = useQueryClient();
  const restaurant = useRestaurant();


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
        .select("id,name,description,price,promo_price,promo_starts_at,promo_ends_at,promo_campaign,image_url,is_available,is_paused,category_id,recurrence_days,recurrence_start_time,recurrence_end_time")
        .eq("restaurant_id", restaurant!.id)
        .order("name")).data as Item[]) ?? [],
  });

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const promos = items.filter((i) => i.promo_price != null);
  const active = promos.filter((i) => promoStatus(i as PromoLike) === "active");
  const scheduled = promos.filter((i) => promoStatus(i as PromoLike) === "scheduled");
  const ended = promos.filter((i) => promoStatus(i as PromoLike) === "ended");
  const paused = promos.filter((i) => promoStatus(i as PromoLike) === "paused");

  const [filter, setFilter] = useState<"all" | "active" | "scheduled" | "paused" | "ended">("all");
  const [search, setSearch] = useState("");

  const filtered = (
    filter === "all"
      ? promos
      : filter === "active"
      ? active
      : filter === "scheduled"
      ? scheduled
      : filter === "paused"
      ? paused
      : ended
  ).filter((i) => (search ? i.name.toLowerCase().includes(search.toLowerCase()) : true));

  const [openCreate, setOpenCreate] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["promo-items"] });
  }

  async function updateOne(id: string, patch: Partial<Item>) {
    const { error } = await supabase.from("menu_items").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }
  async function pausePromo(id: string) { await updateOne(id, { is_paused: true }); toast.success("Promoção pausada"); }
  async function resumePromo(id: string) { await updateOne(id, { is_paused: false }); toast.success("Promoção retomada"); }
  async function endPromo(id: string) {
    if (!confirm("Encerrar esta promoção agora?")) return;
    await updateOne(id, { promo_ends_at: new Date().toISOString(), is_paused: false });
    toast.success("Promoção encerrada");
  }
  async function deletePromo(id: string) {
    if (!confirm("Remover esta promoção? O produto continua no cardápio.")) return;
    await updateOne(id, {
      promo_price: null, promo_starts_at: null, promo_ends_at: null,
      promo_campaign: null, is_paused: false, recurrence_days: null,
      recurrence_start_time: null, recurrence_end_time: null,
    });
    toast.success("Promoção removida");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold sm:text-3xl">
            <Flame className="h-6 w-6 text-destructive" /> Promoções
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie ofertas ativas, agendadas, pausadas e encerradas em um só lugar.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Nova Promoção
            </Button>
          </DialogTrigger>
          <PromotionDialog
            items={items}
            categories={categories}
            onClose={() => setOpenCreate(false)}
            onSaved={() => { setOpenCreate(false); invalidate(); }}
          />
        </Dialog>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KPI label="Ativas" value={active.length} tone="success" onClick={() => setFilter("active")} active={filter === "active"} />
        <KPI label="Agendadas" value={scheduled.length} tone="info" onClick={() => setFilter("scheduled")} active={filter === "scheduled"} />
        <KPI label="Pausadas" value={paused.length} tone="warn" onClick={() => setFilter("paused")} active={filter === "paused"} />
        <KPI label="Encerradas" value={ended.length} tone="muted" onClick={() => setFilter("ended")} active={filter === "ended"} />
        <KPI label="Total" value={promos.length} tone="default" onClick={() => setFilter("all")} active={filter === "all"} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar promoção por produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <Flame className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma promoção {filter !== "all" ? "nesse status" : "cadastrada"} ainda.</p>
          <Button onClick={() => setOpenCreate(true)} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Criar primeira promoção
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((it) => {
            const status = promoStatus(it as PromoLike);
            const pct = discountPct(it as PromoLike);
            const recur = summarizeRecurrence(it);
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
                    <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(it.promo_starts_at)} → {fmtDate(it.promo_ends_at)}</p>
                    {recur && <p className="flex items-center gap-1">🔁 {recur}</p>}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto grid grid-cols-3 gap-1 pt-1">
                    <ActionBtn onClick={() => setEditItem(it)} icon={Pencil} label="Editar" />
                    <ActionBtn onClick={() => setDuplicateItem(it)} icon={Copy} label="Duplicar" />
                    {status === "paused" ? (
                      <ActionBtn onClick={() => resumePromo(it.id)} icon={Play} label="Retomar" tone="success" />
                    ) : status === "active" || status === "scheduled" ? (
                      <ActionBtn onClick={() => pausePromo(it.id)} icon={Pause} label="Pausar" tone="warn" />
                    ) : (
                      <ActionBtn onClick={() => resumePromo(it.id)} icon={Play} label="Reativar" tone="success" disabled={status === "ended" && !!it.promo_ends_at && new Date(it.promo_ends_at) < new Date()} />
                    )}
                    {status !== "ended" && (
                      <ActionBtn onClick={() => endPromo(it.id)} icon={Square} label="Encerrar" tone="muted" />
                    )}
                    <ActionBtn onClick={() => deletePromo(it.id)} icon={Trash2} label="Excluir" tone="destructive" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        {editItem && (
          <PromotionDialog
            mode="edit"
            editing={editItem}
            items={items}
            categories={categories}
            onClose={() => setEditItem(null)}
            onSaved={() => { setEditItem(null); invalidate(); }}
          />
        )}
      </Dialog>

      {/* Duplicate dialog */}
      <Dialog open={!!duplicateItem} onOpenChange={(o) => !o && setDuplicateItem(null)}>
        {duplicateItem && (
          <PromotionDialog
            mode="duplicate"
            editing={duplicateItem}
            items={items}
            categories={categories}
            onClose={() => setDuplicateItem(null)}
            onSaved={() => { setDuplicateItem(null); invalidate(); }}
          />
        )}
      </Dialog>
    </div>
  );
}

function KPI({
  label, value, tone, onClick, active,
}: {
  label: string; value: number; tone: "success" | "info" | "warn" | "muted" | "default"; onClick?: () => void; active?: boolean;
}) {
  const toneCls =
    tone === "success" ? "border-success/30 bg-success/5"
    : tone === "info" ? "border-primary/30 bg-primary/5"
    : tone === "warn" ? "border-amber-400/40 bg-amber-50 dark:bg-amber-950/20"
    : tone === "muted" ? "border-border bg-muted/30"
    : "border-border";
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:shadow-sm ${toneCls} ${active ? "ring-2 ring-primary" : ""}`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: PromoStatus }) {
  const map: Record<PromoStatus, { label: string; cls: string }> = {
    active: { label: "🟢 Ativa", cls: "bg-success text-success-foreground" },
    scheduled: { label: "🟡 Agendada", cls: "bg-primary text-primary-foreground" },
    paused: { label: "🔴 Pausada", cls: "bg-amber-500 text-white" },
    ended: { label: "⚪ Encerrada", cls: "bg-muted text-muted-foreground" },
    inactive: { label: "Inativa", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status];
  return (
    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ActionBtn({
  onClick, icon: Icon, label, tone = "default", disabled,
}: {
  onClick: () => void; icon: any; label: string; tone?: "default" | "success" | "warn" | "muted" | "destructive"; disabled?: boolean;
}) {
  const cls =
    tone === "destructive" ? "text-destructive hover:bg-destructive/10"
    : tone === "warn" ? "text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/30"
    : tone === "success" ? "text-success hover:bg-success/10"
    : tone === "muted" ? "text-muted-foreground hover:bg-muted"
    : "hover:bg-accent";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-lg border border-transparent px-1 py-1.5 text-[10px] font-semibold transition disabled:opacity-40 ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ---------------- Promotion Dialog (create / edit / duplicate / bulk) ---------------- */

function PromotionDialog({
  items, categories, onClose, onSaved, mode = "create", editing,
}: {
  items: Item[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  mode?: "create" | "edit" | "duplicate";
  editing?: Item | null;
}) {
  const initialSelected = editing ? { [editing.id]: true } : {};
  const initialMode: "percent" | "price" = editing
    ? (editing.promo_price != null
        ? "price"
        : "percent")
    : "percent";
  const initialPct = editing && editing.promo_price != null
    ? Math.max(1, Math.round((1 - Number(editing.promo_price) / Number(editing.price)) * 100))
    : 10;

  const [selected, setSelected] = useState<Record<string, boolean>>(initialSelected);
  const [discMode, setDiscMode] = useState<"percent" | "price">(initialMode);
  const [percent, setPercent] = useState<number>(initialPct);
  const [price, setPrice] = useState<string>(editing?.promo_price != null ? String(editing.promo_price) : "");
  const [startsAt, setStartsAt] = useState<string>(mode === "duplicate" ? "" : toLocalInput(editing?.promo_starts_at ?? null));
  const [endsAt, setEndsAt] = useState<string>(mode === "duplicate" ? "" : toLocalInput(editing?.promo_ends_at ?? null));
  const [campaign, setCampaign] = useState<string>(editing?.promo_campaign ?? "");
  const [recurDays, setRecurDays] = useState<number[]>(editing?.recurrence_days ?? []);
  const [recurStart, setRecurStart] = useState<string>(editing?.recurrence_start_time?.slice(0, 5) ?? "");
  const [recurEnd, setRecurEnd] = useState<string>(editing?.recurrence_end_time?.slice(0, 5) ?? "");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = mode === "edit";
  const isDuplicate = mode === "duplicate";

  const catName = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);
  const visible = items.filter(
    (i) => i.is_available && (search ? i.name.toLowerCase().includes(search.toLowerCase()) : true),
  );
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  function applyTemplate(tpl: typeof CAMPAIGN_TEMPLATES[number]) {
    setCampaign(`${tpl.emoji} ${tpl.label}`);
    if (tpl.suggest?.percent) { setDiscMode("percent"); setPercent(tpl.suggest.percent); }
    if (tpl.suggest?.days) setRecurDays(tpl.suggest.days);
    if (tpl.suggest?.start) setRecurStart(tpl.suggest.start);
    if (tpl.suggest?.end) setRecurEnd(tpl.suggest.end);
  }

  function toggleDay(d: number) {
    setRecurDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  }

  async function save() {
    if (selectedIds.length === 0) return toast.error("Selecione ao menos um produto.");
    if (discMode === "percent" && (percent <= 0 || percent >= 100)) return toast.error("Desconto inválido.");
    if (discMode === "price" && !price) return toast.error("Informe o preço promocional.");
    if ((recurStart && !recurEnd) || (!recurStart && recurEnd)) return toast.error("Preencha início e fim da janela horária.");

    setSaving(true);
    try {
      const basePatch = {
        promo_starts_at: fromLocalInput(startsAt),
        promo_ends_at: fromLocalInput(endsAt),
        promo_campaign: campaign || null,
        recurrence_days: recurDays.length > 0 && recurDays.length < 7 ? recurDays : null,
        recurrence_start_time: recurStart || null,
        recurrence_end_time: recurEnd || null,
        is_paused: false,
      };
      const updates = selectedIds.map((id) => {
        const it = items.find((x) => x.id === id)!;
        const promo = discMode === "percent"
          ? Number((Number(it.price) * (1 - percent / 100)).toFixed(2))
          : Number(price);
        return supabase.from("menu_items").update({ ...basePatch, promo_price: promo } as any).eq("id", id);
      });
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      toast.success(
        isEdit ? "Promoção atualizada." :
        isDuplicate ? "Promoção duplicada." :
        `${selectedIds.length} promoção(ões) criada(s).`
      );
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
        <DialogTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          {isEdit ? "Editar Promoção" : isDuplicate ? "Duplicar Promoção" : "Nova Promoção"}
        </DialogTitle>
        <DialogDescription>
          {isEdit ? "Ajuste preço, agendamento ou recorrência." :
           isDuplicate ? "Revise as configurações e ajuste datas/produtos." :
           "Selecione produtos, modelo de campanha e desconto."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        {/* Campaign templates */}
        {!isEdit && (
          <div>
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Campanhas prontas</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CAMPAIGN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent"
                >
                  {tpl.emoji} {tpl.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick discounts */}
        <div>
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Promoções rápidas</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_DISCOUNTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setDiscMode("percent"); setPercent(p); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  discMode === "percent" && percent === p
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
            <Select value={discMode} onValueChange={(v) => setDiscMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">% de desconto</SelectItem>
                <SelectItem value="price">Preço promocional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discMode === "percent" ? (
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
            <p className="mt-1 text-[11px] text-muted-foreground">Vazio = começa agora.</p>
          </div>
          <div>
            <Label>Término</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">Vazio = sem prazo.</p>
          </div>
        </div>

        {/* Recurrence */}
        <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase">🔁 Recorrência (opcional)</Label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setRecurDays([1,2,3,4,5])} className="rounded-md border px-2 py-1 text-[10px] hover:bg-accent">Seg–Sex</button>
              <button type="button" onClick={() => setRecurDays([0,6])} className="rounded-md border px-2 py-1 text-[10px] hover:bg-accent">Fim de semana</button>
              <button type="button" onClick={() => setRecurDays([])} className="rounded-md border px-2 py-1 text-[10px] hover:bg-accent">Todos</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = recurDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hora início</Label>
              <Input type="time" value={recurStart} onChange={(e) => setRecurStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora fim</Label>
              <Input type="time" value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use recorrência para Happy Hour, Terça da Pizza, etc. A promoção só fica ativa nos dias e horários definidos.
          </p>
        </div>

        {/* Campaign label */}
        <div>
          <Label>Rótulo da campanha (opcional)</Label>
          <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Ex.: 🔥 Promoção do Dia" />
        </div>

        {/* Products picker */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>Produtos ({selectedIds.length} selecionados)</Label>
            {!isEdit && (
              <Input
                placeholder="Buscar produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 max-w-[200px]"
              />
            )}
          </div>
          {isEdit ? (
            <Card className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {editing?.image_url && <img src={editing.image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div>
                <p className="text-sm font-semibold">{editing?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {editing?.category_id ? catName[editing.category_id] : "Sem categoria"} · {brl(editing?.price)}
                </p>
              </div>
            </Card>
          ) : (
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
                    {it.image_url ? <img src={it.image_url} alt="" className="h-full w-full object-cover" /> : null}
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
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flame className="mr-2 h-4 w-4" />}
          {isEdit ? "Salvar alterações" : isDuplicate ? "Criar cópia" : "Salvar promoção"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
