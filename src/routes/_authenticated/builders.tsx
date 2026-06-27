import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Copy, Pencil, GripVertical, Loader2, Sparkles, ImagePlus, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { uploadProductImage, deleteProductImage } from "@/lib/image-upload";
import { Progress } from "@/components/ui/progress";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/builders")({
  head: () => ({ meta: [{ title: "Monte do Seu Jeito — Localix" }] }),
  component: BuildersPage,
});

const TEMPLATES = [
  { emoji: "🍕", name: "Monte sua Pizza", groups: [
    { name: "Tamanho", min: 1, max: 1, opts: [["Pequena",0],["Média",10],["Grande",18],["Família",28]] },
    { name: "Massa", min: 1, max: 1, opts: [["Tradicional",0],["Integral",3],["Pan",4],["Artesanal",6]] },
    { name: "Borda", min: 1, max: 1, opts: [["Sem borda",0],["Catupiry",6],["Cheddar",6],["Chocolate",8]] },
    { name: "Sabores", min: 1, max: 4, opts: [["Margherita",0],["Calabresa",0],["Frango c/ Catupiry",0],["Portuguesa",0]] },
    { name: "Adicionais", min: 0, max: 6, opts: [["Bacon",4],["Catupiry extra",5],["Muçarela extra",4]] },
  ]},
  { emoji: "🍔", name: "Monte seu Hambúrguer", groups: [
    { name: "Pão", min: 1, max: 1, opts: [["Brioche",0],["Australiano",2],["Integral",1]] },
    { name: "Carne", min: 1, max: 1, opts: [["120g",0],["160g",4],["200g",7]] },
    { name: "Ponto", min: 1, max: 1, opts: [["Mal passado",0],["Ao ponto",0],["Bem passado",0]] },
    { name: "Queijo", min: 0, max: 2, opts: [["Cheddar",2],["Mussarela",2],["Prato",2]] },
    { name: "Adicionais", min: 0, max: 6, opts: [["Bacon",4],["Cebola caramelizada",3],["Ovo",2]] },
    { name: "Molho", min: 0, max: 3, opts: [["Maionese da casa",0],["Barbecue",1],["Mostarda e mel",1]] },
  ]},
  { emoji: "🥗", name: "Monte seu Prato", groups: [
    { name: "Proteína", min: 1, max: 1, opts: [["Frango grelhado",0],["Filé mignon",10],["Salmão",14]] },
    { name: "Arroz", min: 0, max: 1, opts: [["Branco",0],["Integral",2]] },
    { name: "Feijão", min: 0, max: 1, opts: [["Carioca",0],["Preto",0]] },
    { name: "Salada", min: 0, max: 3, opts: [["Mix de folhas",0],["Tomate",0],["Cenoura",0]] },
    { name: "Molhos", min: 0, max: 2, opts: [["Mostarda",0],["Iogurte",0]] },
  ]},
  { emoji: "🥙", name: "Monte seu Lanche", groups: [] },
  { emoji: "🌮", name: "Monte seu Combo", groups: [] },
  { emoji: "🍟", name: "Monte sua Porção", groups: [] },
  { emoji: "🥤", name: "Monte sua Bebida", groups: [] },
];

function BuildersPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: restaurant } = useQuery({
    queryKey: ["my-restaurant"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("restaurants").select("id, name, builders_enabled").eq("owner_id", u.user.id).maybeSingle();
      return data;
    },
  });

  const { data: builders, refetch } = useQuery({
    queryKey: ["builders", restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await supabase.from("builders").select("*, builder_groups(*, builder_options(*))").eq("restaurant_id", restaurant!.id).order("position");
      return data ?? [];
    },
  });

  async function toggleModule(v: boolean) {
    if (!restaurant) return;
    const { error } = await supabase.from("restaurants").update({ builders_enabled: v }).eq("id", restaurant.id);
    if (error) return toast.error(error.message);
    toast.success(v ? "Módulo ativado" : "Módulo desativado");
    qc.invalidateQueries({ queryKey: ["my-restaurant"] });
  }

  async function createFromTemplate(tpl: typeof TEMPLATES[number]) {
    if (!restaurant) return;
    const { data: b, error } = await supabase.from("builders").insert({
      restaurant_id: restaurant.id, name: tpl.name, emoji: tpl.emoji,
      description: "Monte do seu jeito.", base_price: 0, position: (builders?.length ?? 0) + 1,
    }).select("id").single();
    if (error || !b) return toast.error(error?.message ?? "Erro");
    for (let gi = 0; gi < tpl.groups.length; gi++) {
      const g = tpl.groups[gi];
      const { data: grp } = await supabase.from("builder_groups").insert({
        builder_id: b.id, name: g.name, min_select: g.min, max_select: g.max,
        is_required: g.min > 0, position: gi,
      }).select("id").single();
      if (!grp) continue;
      const rows = g.opts.map(([n, p], i) => ({ group_id: grp.id, name: n as string, price_delta: p as number, max_qty: 1, position: i }));
      if (rows.length) await supabase.from("builder_options").insert(rows);
    }
    toast.success("Modelo criado");
    refetch();
  }

  async function createBlank() {
    if (!restaurant) return;
    const { data: b, error } = await supabase.from("builders").insert({
      restaurant_id: restaurant.id, name: "Novo modelo", emoji: "✨",
      description: "Personalize do seu jeito.", base_price: 0, position: (builders?.length ?? 0) + 1,
    }).select("*").single();
    if (error || !b) return toast.error(error?.message ?? "Erro");
    setEditing({ ...b, builder_groups: [] });
    setOpen(true);
    refetch();
  }

  async function duplicate(b: any) {
    if (!restaurant) return;
    const { data: nb } = await supabase.from("builders").insert({
      restaurant_id: restaurant.id, name: `${b.name} (cópia)`, emoji: b.emoji,
      description: b.description, image_url: b.image_url, base_price: b.base_price,
      position: (builders?.length ?? 0) + 1,
    }).select("id").single();
    if (!nb) return;
    for (const g of b.builder_groups ?? []) {
      const { data: ng } = await supabase.from("builder_groups").insert({
        builder_id: nb.id, name: g.name, min_select: g.min_select, max_select: g.max_select,
        is_required: g.is_required, position: g.position,
      }).select("id").single();
      if (!ng) continue;
      const opts = (g.builder_options ?? []).map((o: any) => ({
        group_id: ng.id, name: o.name, price_delta: o.price_delta, max_qty: o.max_qty, position: o.position,
      }));
      if (opts.length) await supabase.from("builder_options").insert(opts);
    }
    toast.success("Duplicado");
    refetch();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await supabase.from("builders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    refetch();
  }

  async function toggleActive(b: any) {
    await supabase.from("builders").update({ is_active: !b.is_active }).eq("id", b.id);
    refetch();
  }

  if (!restaurant) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">🍕 Monte do Seu Jeito</h1>
          <p className="text-sm text-muted-foreground">Ofereça produtos totalmente personalizáveis ao seu cliente.</p>
        </div>
        <Card className="flex items-center gap-3 rounded-2xl border bg-gradient-warm/5 p-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-bold">Ativar módulo</p>
            <p className="text-xs text-muted-foreground">Quando desligado, nada aparece no cardápio.</p>
          </div>
          <Switch checked={!!restaurant.builders_enabled} onCheckedChange={toggleModule} />
        </Card>
      </div>

      {/* Templates */}
      <Card className="rounded-2xl p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Comece a partir de um modelo</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => createFromTemplate(t)}
              className="flex flex-col items-center gap-1 rounded-xl border bg-card p-3 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elegant">
              <span className="text-2xl">{t.emoji}</span>
              <span className="text-[11px] font-semibold leading-tight">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={createBlank}><Plus className="mr-1 h-4 w-4" />Modelo em branco</Button>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {(builders ?? []).map((b: any) => (
          <Card key={b.id} className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-muted text-2xl">{b.emoji ?? "✨"}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{b.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {b.is_active ? "Ativo" : "Pausado"}
                </span>
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">{b.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">{(b.builder_groups ?? []).length} etapas · base {brl(b.base_price)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => duplicate(b)}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => toggleActive(b)}>{b.is_active ? "Pausar" : "Ativar"}</Button>
              <Button size="sm" variant="outline" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </Card>
        ))}
        {(builders ?? []).length === 0 && (
          <Card className="rounded-2xl p-10 text-center text-muted-foreground">
            Nenhum modelo ainda. Escolha um template acima para começar.
          </Card>
        )}
      </div>

      <BuilderEditor open={open} onOpenChange={(v) => { setOpen(v); if (!v) refetch(); }} builder={editing} />
    </div>
  );
}

function BuilderEditor({ open, onOpenChange, builder }: { open: boolean; onOpenChange: (v: boolean) => void; builder: any | null }) {
  const [form, setForm] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!builder) return;
    setForm({ name: builder.name, emoji: builder.emoji ?? "", description: builder.description ?? "", image_url: builder.image_url ?? "", base_price: builder.base_price ?? 0 });
    setGroups((builder.builder_groups ?? []).map((g: any) => ({ ...g, builder_options: g.builder_options ?? [] })).sort((a: any, b: any) => a.position - b.position));
  }, [builder?.id, open]);

  if (!builder || !form) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent /></Dialog>;

  async function saveMeta() {
    const { error } = await supabase.from("builders").update({
      name: form.name, emoji: form.emoji, description: form.description, image_url: form.image_url || null, base_price: Number(form.base_price) || 0,
    }).eq("id", builder.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
  }

  async function addGroup() {
    const { data } = await supabase.from("builder_groups").insert({
      builder_id: builder.id, name: "Nova etapa", min_select: 0, max_select: 1, is_required: false, position: groups.length,
    }).select("*").single();
    if (data) setGroups((g) => [...g, { ...data, builder_options: [] }]);
  }
  async function saveGroup(g: any) {
    await supabase.from("builder_groups").update({
      name: g.name, min_select: Number(g.min_select) || 0, max_select: Number(g.max_select) || 1, is_required: !!g.is_required,
    }).eq("id", g.id);
    toast.success("Etapa salva");
  }
  async function deleteGroup(id: string) {
    if (!confirm("Excluir etapa?")) return;
    await supabase.from("builder_groups").delete().eq("id", id);
    setGroups((gs) => gs.filter((g) => g.id !== id));
  }
  async function addOption(g: any) {
    const { data } = await supabase.from("builder_options").insert({
      group_id: g.id, name: "Nova opção", price_delta: 0, max_qty: 1, position: (g.builder_options?.length ?? 0),
    }).select("*").single();
    if (data) setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, builder_options: [...x.builder_options, data] } : x));
  }
  async function saveOption(o: any) {
    await supabase.from("builder_options").update({ name: o.name, price_delta: Number(o.price_delta) || 0, max_qty: Number(o.max_qty) || 1 }).eq("id", o.id);
  }
  async function deleteOption(gid: string, oid: string) {
    await supabase.from("builder_options").delete().eq("id", oid);
    setGroups((gs) => gs.map((g) => g.id === gid ? { ...g, builder_options: g.builder_options.filter((o: any) => o.id !== oid) } : g));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar modelo</DialogTitle></DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <div className="space-y-1.5"><Label>Emoji</Label><Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={4} /></div>
          <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Imagem do modelo</Label>
            <BuilderImageUpload
              restaurantId={builder.restaurant_id}
              value={form.image_url}
              onChange={async (url) => {
                setForm({ ...form, image_url: url });
                await supabase.from("builders").update({ image_url: url || null }).eq("id", builder.id);
              }}
            />
          </div>
          <div className="space-y-1.5"><Label>Preço base (R$)</Label><Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></div>
        </div>
        <div className="flex justify-end"><Button size="sm" onClick={saveMeta}>Salvar dados</Button></div>

        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Etapas</h3>
            <Button size="sm" variant="outline" onClick={addGroup}><Plus className="mr-1 h-3.5 w-3.5" />Etapa</Button>
          </div>
          <div className="space-y-3">
            {groups.map((g, gi) => (
              <Card key={g.id} className="rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2 h-4 w-4 text-muted-foreground" />
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_80px_80px_auto]">
                    <Input value={g.name} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, name: e.target.value } : x))} placeholder="Nome (ex: Tamanho)" />
                    <Input type="number" value={g.min_select} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, min_select: e.target.value } : x))} placeholder="Mín" />
                    <Input type="number" value={g.max_select} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, max_select: e.target.value } : x))} placeholder="Máx" />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => saveGroup(g)}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteGroup(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2 pl-6">
                  {g.builder_options.map((o: any, oi: number) => (
                    <div key={o.id} className="grid gap-2 sm:grid-cols-[1fr_100px_80px_auto]">
                      <Input value={o.name} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, builder_options: x.builder_options.map((y: any, j: number) => j === oi ? { ...y, name: e.target.value } : y) } : x))} />
                      <Input type="number" step="0.01" value={o.price_delta} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, builder_options: x.builder_options.map((y: any, j: number) => j === oi ? { ...y, price_delta: e.target.value } : y) } : x))} placeholder="+R$" />
                      <Input type="number" value={o.max_qty} onChange={(e) => setGroups((gs) => gs.map((x, i) => i === gi ? { ...x, builder_options: x.builder_options.map((y: any, j: number) => j === oi ? { ...y, max_qty: e.target.value } : y) } : x))} placeholder="Qtd" />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => saveOption(o)}>Salvar</Button>
                        <Button size="sm" variant="outline" onClick={() => deleteOption(g.id, o.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => addOption(g)}><Plus className="mr-1 h-3.5 w-3.5" />Opção</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter><Button onClick={() => onOpenChange(false)}>Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
