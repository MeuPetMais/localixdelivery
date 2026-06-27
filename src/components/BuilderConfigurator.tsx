import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/format";
import { Check, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export type Builder = {
  id: string; name: string; emoji?: string | null; description?: string | null;
  image_url?: string | null; base_price: number;
  builder_groups: Group[];
};
type Group = {
  id: string; name: string; min_select: number; max_select: number; is_required: boolean; position: number;
  builder_options: Option[];
};
type Option = { id: string; name: string; price_delta: number; max_qty: number; position: number };

type Selection = Record<string, Record<string, number>>; // groupId -> { optionId: qty }

export function BuilderConfigurator({
  builder, open, onOpenChange, onAdd,
}: {
  builder: Builder | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (item: { id: string; name: string; price: number }) => void;
}) {
  const groups = useMemo(
    () => (builder?.builder_groups ?? []).slice().sort((a, b) => a.position - b.position),
    [builder],
  );
  const totalSteps = groups.length + 1; // +1 notes step
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Selection>({});
  const [notes, setNotes] = useState("");

  // reset when builder changes
  useMemo(() => { setStep(0); setSel({}); setNotes(""); }, [builder?.id]);

  if (!builder) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent /></Dialog>;

  const currentGroup: Group | undefined = groups[step];

  const totalForGroup = (gid: string) =>
    Object.values(sel[gid] ?? {}).reduce((s, n) => s + n, 0);

  const toggle = (g: Group, o: Option) => {
    setSel((prev) => {
      const cur = { ...(prev[g.id] ?? {}) };
      const have = cur[o.id] ?? 0;
      const totalNow = Object.values(cur).reduce((s, n) => s + n, 0);
      if (g.max_select === 1) {
        return { ...prev, [g.id]: { [o.id]: have ? 0 : 1 } };
      }
      if (have > 0) {
        const next = have - 1;
        if (next <= 0) delete cur[o.id]; else cur[o.id] = next;
      } else {
        if (totalNow >= g.max_select) { toast.error(`Máx ${g.max_select} nesta etapa`); return prev; }
        cur[o.id] = 1;
      }
      return { ...prev, [g.id]: cur };
    });
  };

  const inc = (g: Group, o: Option) => {
    setSel((prev) => {
      const cur = { ...(prev[g.id] ?? {}) };
      const have = cur[o.id] ?? 0;
      const totalNow = Object.values(cur).reduce((s, n) => s + n, 0);
      if (have >= o.max_qty) return prev;
      if (totalNow >= g.max_select) { toast.error(`Máx ${g.max_select} nesta etapa`); return prev; }
      cur[o.id] = have + 1;
      return { ...prev, [g.id]: cur };
    });
  };
  const dec = (g: Group, o: Option) => {
    setSel((prev) => {
      const cur = { ...(prev[g.id] ?? {}) };
      const have = cur[o.id] ?? 0;
      if (have <= 0) return prev;
      const next = have - 1;
      if (next <= 0) delete cur[o.id]; else cur[o.id] = next;
      return { ...prev, [g.id]: cur };
    });
  };

  const subtotal = useMemo(() => {
    let s = Number(builder?.base_price ?? 0) || 0;
    for (const g of groups) {
      const picks = sel[g.id] ?? {};
      for (const o of g.builder_options) s += (picks[o.id] ?? 0) * Number(o.price_delta);
    }
    return s;
  }, [sel, groups, builder?.base_price]);

  function next() {
    if (currentGroup) {
      const t = totalForGroup(currentGroup.id);
      if (currentGroup.is_required && t < currentGroup.min_select) {
        toast.error(`Selecione ao menos ${currentGroup.min_select} em ${currentGroup.name}`);
        return;
      }
    }
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  }

  function finish() {
    // validate all required
    for (const g of groups) {
      const t = totalForGroup(g.id);
      if (g.is_required && t < g.min_select) {
        toast.error(`Falta preencher: ${g.name}`);
        return;
      }
    }
    const parts: string[] = [];
    for (const g of groups) {
      const picks = sel[g.id] ?? {};
      const names = g.builder_options
        .filter((o) => (picks[o.id] ?? 0) > 0)
        .map((o) => (picks[o.id] > 1 ? `${picks[o.id]}x ${o.name}` : o.name));
      if (names.length) parts.push(`${g.name}: ${names.join(", ")}`);
    }
    if (notes.trim()) parts.push(`Obs: ${notes.trim()}`);
    if (!builder) return;
    const name = `${builder.emoji ?? ""} ${builder.name}${parts.length ? ` (${parts.join(" | ")})` : ""}`.trim();
    onAdd({ id: `builder:${builder.id}:${Date.now()}`, name, price: subtotal });
    toast.success("Adicionado ao carrinho");
    onOpenChange(false);
    setStep(0); setSel({}); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl p-0">
        <div className="sticky top-0 z-10 border-b bg-card p-4">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {builder.emoji} {builder.name}
            </DialogTitle>
          </DialogHeader>
          <Progress className="mt-3 h-1.5" value={((step + 1) / totalSteps) * 100} />
          <p className="mt-1 text-xs text-muted-foreground">Etapa {step + 1} de {totalSteps}</p>
        </div>

        <div className="p-4">
          {currentGroup ? (
            <div>
              <div className="mb-3">
                <h3 className="font-display text-lg font-extrabold">{currentGroup.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {currentGroup.is_required ? "Obrigatório · " : "Opcional · "}
                  {currentGroup.min_select > 0 && `mín ${currentGroup.min_select} · `}
                  máx {currentGroup.max_select}
                </p>
              </div>
              <div className="space-y-2">
                {currentGroup.builder_options.length === 0 && (
                  <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">Sem opções cadastradas nesta etapa.</p>
                )}
                {currentGroup.builder_options
                  .slice().sort((a, b) => a.position - b.position)
                  .map((o) => {
                    const qty = sel[currentGroup.id]?.[o.id] ?? 0;
                    const selected = qty > 0;
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => currentGroup.max_select === 1 ? toggle(currentGroup, o) : (selected ? null : inc(currentGroup, o))}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                      >
                        <div className="flex items-center gap-3">
                          {currentGroup.max_select === 1 ? (
                            <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          ) : (
                            <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          )}
                          <span className="text-sm font-semibold">{o.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {Number(o.price_delta) > 0 && (
                            <span className="text-xs font-bold text-primary">+ {brl(Number(o.price_delta))}</span>
                          )}
                          {currentGroup.max_select > 1 && o.max_qty > 1 && selected && (
                            <span className="flex items-center gap-1">
                              <span onClick={(e) => { e.stopPropagation(); dec(currentGroup, o); }} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border"><Minus className="h-3 w-3" /></span>
                              <span className="w-5 text-center text-sm font-bold">{qty}</span>
                              <span onClick={(e) => { e.stopPropagation(); inc(currentGroup, o); }} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border"><Plus className="h-3 w-3" /></span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-display text-lg font-extrabold">Observações</h3>
              <p className="mb-2 text-xs text-muted-foreground">Algum detalhe especial? (opcional)</p>
              <Label className="sr-only">Observações</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem cebola, massa bem assada..." />
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 flex-row items-center justify-between gap-2 border-t bg-card p-4">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="font-display text-lg font-extrabold text-primary">{brl(subtotal)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            {step < totalSteps - 1 ? (
              <Button onClick={next}>Avançar <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={finish}>Adicionar ao carrinho</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
