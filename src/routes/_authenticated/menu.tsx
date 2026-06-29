import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Loader2, FolderPlus, Sparkles, Flame } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { ProductImageUploader, type ProductImage } from "@/components/ProductImageUploader";
import { deleteProductImage } from "@/lib/image-upload";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({ meta: [{ title: "Cardápio — Localix" }] }),
  component: MenuPage,
});

type Category = { id: string; name: string; position: number };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  available_delivery: boolean;
  available_pickup: boolean;
  prep_time_minutes: number | null;
  category_id: string | null;
  position: number;
};

function MenuPage() {
  const qc = useQueryClient();
  const restaurant = useRestaurant();


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
    // remove gallery files from storage to avoid orphans
    const { data: imgs } = await supabase.from("menu_item_images").select("storage_path").eq("menu_item_id", item.id);
    if (imgs?.length) await Promise.all(imgs.map((i: any) => deleteProductImage(i.storage_path)));
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Item excluído");
    onChange();
  }
  const hasPromo = item.promo_price && Number(item.promo_price) > 0 && Number(item.promo_price) < Number(item.price);
  return (
    <Card className={`flex gap-3 overflow-hidden p-3 ${!item.is_available ? "opacity-60" : ""}`}>
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-lg bg-muted" />
      )}
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate font-semibold leading-tight">{item.name}</h4>
              {item.is_featured && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
              {item.is_bestseller && <Flame className="h-3.5 w-3.5 text-orange-500" />}
            </div>
            {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
          </div>
          <div className="text-right">
            {hasPromo ? (
              <>
                <div className="font-display font-bold text-primary">{brl(item.promo_price!)}</div>
                <div className="text-xs text-muted-foreground line-through">{brl(item.price)}</div>
              </>
            ) : (
              <span className="font-display font-bold text-primary">{brl(item.price)}</span>
            )}
          </div>
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
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    description: item?.description ?? "",
    category_id: item?.category_id ?? (categories[0]?.id ?? ""),
    price: item ? String(item.price) : "",
    promo_price: item?.promo_price ? String(item.promo_price) : "",
    prep_time_minutes: item?.prep_time_minutes ? String(item.prep_time_minutes) : "",
    available_delivery: item?.available_delivery ?? true,
    available_pickup: item?.available_pickup ?? true,
    is_featured: item?.is_featured ?? false,
    is_bestseller: item?.is_bestseller ?? false,
    is_active: item?.is_active ?? true,
  });

  // Load existing gallery on edit
  useEffect(() => {
    if (!open || !item) { if (!item) setImages([]); return; }
    (async () => {
      const { data } = await supabase
        .from("menu_item_images")
        .select("id, storage_path, url, is_primary, position")
        .eq("menu_item_id", item.id)
        .order("position");
      const list = (data ?? []) as ProductImage[];
      // Seed from legacy image_url if no gallery rows yet
      if (list.length === 0 && item.image_url) {
        setImages([{ storage_path: "", url: item.image_url, is_primary: true, position: 0 }]);
      } else {
        setImages(list);
      }
    })();
  }, [open, item]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price.trim()) {
      toast.error("Nome e preço são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const visible = images.filter((i) => !i._delete);
      const primary = visible.find((i) => i.is_primary) ?? visible[0];

      const payload = {
        restaurant_id: restaurantId,
        name: form.name,
        description: form.description || null,
        category_id: form.category_id || null,
        price: Number(form.price.replace(",", ".")),
        promo_price: form.promo_price ? Number(form.promo_price.replace(",", ".")) : null,
        prep_time_minutes: form.prep_time_minutes ? Number(form.prep_time_minutes) : null,
        available_delivery: form.available_delivery,
        available_pickup: form.available_pickup,
        is_featured: form.is_featured,
        is_bestseller: form.is_bestseller,
        is_active: form.is_active,
        is_available: form.is_active,
        image_url: primary?.url ?? null,
      };

      let itemId = item?.id;
      if (item) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("menu_items").insert(payload).select("id").single();
        if (error) throw error;
        itemId = data.id;
      }

      // Sync gallery
      const toDelete = images.filter((i) => i._delete && i.id);
      if (toDelete.length) {
        await supabase.from("menu_item_images").delete().in("id", toDelete.map((i) => i.id!));
        await Promise.all(toDelete.map((i) => deleteProductImage(i.storage_path)));
      }
      const toInsert = images.filter((i) => i._new && !i._delete && i.storage_path).map((i, idx) => ({
        menu_item_id: itemId!,
        restaurant_id: restaurantId,
        storage_path: i.storage_path,
        url: i.url,
        is_primary: i.is_primary,
        position: idx,
      }));
      if (toInsert.length) await supabase.from("menu_item_images").insert(toInsert);

      const toUpdate = images.filter((i) => !i._new && !i._delete && i.id);
      if (toUpdate.length) {
        await Promise.all(toUpdate.map((i, idx) =>
          supabase.from("menu_item_images").update({ is_primary: i.is_primary, position: idx }).eq("id", i.id!),
        ));
      }

      toast.success(item ? "Item atualizado" : "Item criado");
      setOpen(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> Item</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {/* 1. Foto */}
          <div className="space-y-1.5">
            <Label>Foto do produto</Label>
            <ProductImageUploader restaurantId={restaurantId} images={images} onChange={setImages} />
          </div>

          {/* 2. Nome */}
          <div className="space-y-1.5">
            <Label>Nome do produto</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pizza Margherita" />
          </div>

          {/* 3. Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Molho de tomate, mussarela e manjericão fresco" />
          </div>

          {/* 4. Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Preço & 6. Promoção */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49,90" />
            </div>
            <div className="space-y-1.5">
              <Label>Promoção (R$)</Label>
              <Input value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} placeholder="opcional" />
            </div>
          </div>

          {/* 7. Tempo de preparo */}
          <div className="space-y-1.5">
            <Label>Tempo de preparo (min)</Label>
            <Input type="number" min={0} value={form.prep_time_minutes} onChange={(e) => setForm({ ...form, prep_time_minutes: e.target.value })} placeholder="ex.: 20" />
          </div>

          {/* 8-12. Toggles */}
          <div className="space-y-2 rounded-xl border p-3">
            <ToggleRow label="Disponível para entrega" checked={form.available_delivery} onChange={(v) => setForm({ ...form, available_delivery: v })} />
            <ToggleRow label="Disponível para retirada" checked={form.available_pickup} onChange={(v) => setForm({ ...form, available_pickup: v })} />
            <ToggleRow label="Destaque do cardápio" checked={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} />
            <ToggleRow label="Produto mais vendido" checked={form.is_bestseller} onChange={(v) => setForm({ ...form, is_bestseller: v })} />
            <ToggleRow label="Ativo" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar produto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
