import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, FolderPlus } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({ meta: [{ title: "Cardápio — Localix" }] }),
  component: MenuPage,
});

type Category = { id: string; name: string; position: number };
type Item = { id: string; name: string; description: string | null; price: number; image_url: string | null; is_available: boolean; category_id: string | null; position: number };

function MenuPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const qc = useQueryClient();

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () => (await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle()).data,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    enabled: !!restaurant?.id,
    queryKey: ["categories", restaurant?.id],
    queryFn: async () => (await supabase.from("menu_categories").select("*").eq("restaurant_id", restaurant!.id).order("position")).data as Category[] ?? [],
  });

  const { data: items = [] } = useQuery<Item[]>({
    enabled: !!restaurant?.id,
    queryKey: ["items", restaurant?.id],
    queryFn: async () => (await supabase.from("menu_items").select("*").eq("restaurant_id", restaurant!.id).order("position")).data as Item[] ?? [],
  });

  if (!restaurant) {
    return <Card className="p-8 text-center">Você precisa criar seu restaurante primeiro no painel.</Card>;
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories", restaurant.id] });
    qc.invalidateQueries({ queryKey: ["items", restaurant.id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Cardápio</h1>
          <p className="text-sm text-muted-foreground">Organize categorias e adicione produtos.</p>
        </div>
        <div className="flex gap-2">
          <CategoryDialog restaurantId={restaurant.id} onSaved={invalidate} />
          <ItemDialog restaurantId={restaurant.id} categories={categories} onSaved={invalidate} />
        </div>
      </div>

      {categories.length === 0 && items.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderPlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-display text-xl font-bold">Comece criando uma categoria</h3>
          <p className="mt-1 text-sm text-muted-foreground">Por exemplo: Pizzas, Hambúrgueres, Bebidas, Sobremesas.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            return (
              <section key={cat.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">{cat.name} <span className="ml-2 text-sm font-normal text-muted-foreground">({catItems.length})</span></h2>
                  <div className="flex gap-1">
                    <CategoryDialog restaurantId={restaurant.id} category={cat} onSaved={invalidate} />
                    <Button size="icon" variant="ghost" onClick={async () => {
                      if (!confirm(`Excluir a categoria "${cat.name}"?`)) return;
                      const { error } = await supabase.from("menu_categories").delete().eq("id", cat.id);
                      if (error) return toast.error(error.message);
                      toast.success("Categoria excluída");
                      invalidate();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {catItems.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum item nesta categoria ainda.</Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {catItems.map((it) => (
                      <ItemRow key={it.id} item={it} restaurantId={restaurant.id} categories={categories} onChange={invalidate} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {items.filter((i) => !i.category_id).length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold">Sem categoria</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.filter((i) => !i.category_id).map((it) => (
                  <ItemRow key={it.id} item={it} restaurantId={restaurant.id} categories={categories} onChange={invalidate} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, restaurantId, categories, onChange }: { item: Item; restaurantId: string; categories: Category[]; onChange: () => void }) {
  async function toggleAvailable() {
    const { error } = await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    if (error) return toast.error(error.message);
    onChange();
  }
  async function remove() {
    if (!confirm(`Excluir "${item.name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Item excluído");
    onChange();
  }
  return (
    <Card className={`flex gap-3 overflow-hidden p-3 ${!item.is_available ? "opacity-60" : ""}`}>
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />
      )}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold leading-tight">{item.name}</h4>
            {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
          </div>
          <span className="whitespace-nowrap font-display font-bold text-primary">{brl(item.price)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs">
            <Switch checked={item.is_available} onCheckedChange={toggleAvailable} />
            <span className="text-muted-foreground">{item.is_available ? "Disponível" : "Indisponível"}</span>
          </div>
          <div className="flex gap-1">
            <ItemDialog restaurantId={restaurantId} categories={categories} item={item} onSaved={onChange} trigger={<Button size="icon" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>} />
            <Button size="icon" variant="ghost" onClick={remove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CategoryDialog({ restaurantId, category, onSaved }: { restaurantId: string; category?: Category; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = category
      ? await supabase.from("menu_categories").update({ name }).eq("id", category.id)
      : await supabase.from("menu_categories").insert({ restaurant_id: restaurantId, name });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(category ? "Categoria atualizada" : "Categoria criada");
    setOpen(false);
    setName(category?.name ?? "");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button variant="outline"><FolderPlus className="mr-2 h-4 w-4" /> Categoria</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Pizzas" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ restaurantId, categories, item, onSaved, trigger }: { restaurantId: string; categories: Category[]; item?: Item; onSaved: () => void; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? String(item.price) : "",
    image_url: item?.image_url ?? "",
    category_id: item?.category_id ?? (categories[0]?.id ?? ""),
  });
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || null,
      price: Number(form.price.replace(",", ".")),
      image_url: form.image_url || null,
      category_id: form.category_id || null,
    };
    const { error } = item
      ? await supabase.from("menu_items").update(payload).eq("id", item.id)
      : await supabase.from("menu_items").insert(payload);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(item ? "Item atualizado" : "Item criado");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> Item</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pizza Margherita" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Molho de tomate, mussarela e manjericão fresco" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49,90" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL da imagem (opcional)</Label>
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
