import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, AlertTriangle, Package, TrendingDown, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

type Ingredient = {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  stock: number;
  min_stock: number;
  unit_cost: number;
};

type MenuItem = { id: string; name: string };
type Recipe = { id: string; menu_item_id: string; ingredient_id: string; quantity: number };

const UNITS = ["un", "g", "kg", "ml", "L", "fatia", "porção"];

function stockLevel(ing: Ingredient): "ok" | "low" | "critical" {
  if (ing.stock <= 0 || ing.stock <= ing.min_stock * 0.5) return "critical";
  if (ing.stock <= ing.min_stock) return "low";
  return "ok";
}

function StatusBadge({ level }: { level: "ok" | "low" | "critical" }) {
  if (level === "critical") return <Badge variant="destructive">Crítico</Badge>;
  if (level === "low") return <Badge className="bg-amber-500 hover:bg-amber-600">Baixo</Badge>;
  return <Badge variant="secondary">Normal</Badge>;
}

function InventoryPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [openIng, setOpenIng] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({ name: "", unit: "un", stock: "0", min_stock: "0", unit_cost: "0" });

  const [adjustOpen, setAdjustOpen] = useState<Ingredient | null>(null);
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustMode, setAdjustMode] = useState<"add" | "set">("add");

  const [recipeFor, setRecipeFor] = useState<MenuItem | null>(null);
  const [recIngId, setRecIngId] = useState<string>("");
  const [recQty, setRecQty] = useState("1");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase.from("restaurants").select("id").eq("owner_id", u.user.id).maybeSingle();
      if (!r) { setLoading(false); return; }
      setRestaurantId(r.id);
      await reload(r.id);
      setLoading(false);
    })();
  }, []);

  async function reload(rid: string) {
    const [ing, mi, rc] = await Promise.all([
      supabase.from("ingredients").select("*").eq("restaurant_id", rid).order("name"),
      supabase.from("menu_items").select("id, name").eq("restaurant_id", rid).order("name"),
      supabase.from("recipe_items").select("id, menu_item_id, ingredient_id, quantity"),
    ]);
    setIngredients((ing.data ?? []) as Ingredient[]);
    setMenuItems((mi.data ?? []) as MenuItem[]);
    setRecipes((rc.data ?? []) as Recipe[]);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", unit: "un", stock: "0", min_stock: "0", unit_cost: "0" });
    setOpenIng(true);
  }

  function openEdit(i: Ingredient) {
    setEditing(i);
    setForm({ name: i.name, unit: i.unit, stock: String(i.stock), min_stock: String(i.min_stock), unit_cost: String(i.unit_cost) });
    setOpenIng(true);
  }

  async function saveIngredient() {
    if (!restaurantId || !form.name.trim()) return;
    const payload = {
      restaurant_id: restaurantId,
      name: form.name.trim(),
      unit: form.unit,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit_cost: Number(form.unit_cost) || 0,
    };
    const { error } = editing
      ? await supabase.from("ingredients").update(payload).eq("id", editing.id)
      : await supabase.from("ingredients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Ingrediente salvo");
    setOpenIng(false);
    await reload(restaurantId);
  }

  async function removeIngredient(id: string) {
    if (!confirm("Excluir ingrediente?")) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (restaurantId) reload(restaurantId);
  }

  async function applyAdjust() {
    if (!adjustOpen || !restaurantId) return;
    const q = Number(adjustQty);
    if (Number.isNaN(q)) return;
    const newStock = adjustMode === "set" ? q : Number(adjustOpen.stock) + q;
    const { error } = await supabase.from("ingredients").update({ stock: newStock }).eq("id", adjustOpen.id);
    if (error) { toast.error(error.message); return; }
    toast.success(adjustMode === "set" ? "Inventário ajustado" : q >= 0 ? "Entrada registrada" : "Saída registrada");
    setAdjustOpen(null);
    setAdjustQty("0");
    reload(restaurantId);
  }

  async function addRecipe() {
    if (!recipeFor || !recIngId || !restaurantId) return;
    const qty = Number(recQty);
    if (qty <= 0) return;
    const { error } = await supabase.from("recipe_items").upsert(
      { menu_item_id: recipeFor.id, ingredient_id: recIngId, quantity: qty },
      { onConflict: "menu_item_id,ingredient_id" },
    );
    if (error) { toast.error(error.message); return; }
    setRecIngId(""); setRecQty("1");
    reload(restaurantId);
  }

  async function removeRecipe(id: string) {
    const { error } = await supabase.from("recipe_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (restaurantId) reload(restaurantId);
  }

  const metrics = useMemo(() => {
    const total = ingredients.length;
    const critical = ingredients.filter((i) => stockLevel(i) === "critical").length;
    const low = ingredients.filter((i) => stockLevel(i) === "low").length;
    const value = ingredients.reduce((s, i) => s + Number(i.stock) * Number(i.unit_cost), 0);
    return { total, critical, low, value };
  }, [ingredients]);

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!restaurantId) return <div className="text-muted-foreground">Configure seu restaurante primeiro.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Estoque</h1>
          <p className="text-muted-foreground">Ingredientes, fichas técnicas e baixa automática.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo ingrediente</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Package} label="Ingredientes" value={metrics.total} />
        <MetricCard icon={AlertTriangle} label="Itens críticos" value={metrics.critical} tone="critical" />
        <MetricCard icon={TrendingDown} label="Abaixo do mínimo" value={metrics.low} tone="low" />
        <MetricCard icon={DollarSign} label="Valor em estoque" value={metrics.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Ingredientes</TabsTrigger>
          <TabsTrigger value="recipes">Fichas Técnicas</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Estoque</th>
                      <th className="px-4 py-3">Mínimo</th>
                      <th className="px-4 py-3">Custo un.</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum ingrediente cadastrado.</td></tr>
                    )}
                    {ingredients.map((i) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{i.name}</td>
                        <td className="px-4 py-3">{Number(i.stock)} {i.unit}</td>
                        <td className="px-4 py-3">{Number(i.min_stock)} {i.unit}</td>
                        <td className="px-4 py-3">{Number(i.unit_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="px-4 py-3"><StatusBadge level={stockLevel(i)} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setAdjustOpen(i); setAdjustMode("add"); setAdjustQty("0"); }}>Ajustar</Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => removeIngredient(i.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes" className="mt-4 space-y-4">
          {menuItems.length === 0 && <p className="text-muted-foreground">Cadastre itens no cardápio para criar fichas técnicas.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {menuItems.map((mi) => {
              const items = recipes.filter((r) => r.menu_item_id === mi.id);
              return (
                <Card key={mi.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{mi.name}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => { setRecipeFor(mi); setRecIngId(""); setRecQty("1"); }}>
                      <Plus className="mr-1 h-4 w-4" /> Ingrediente
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem ficha técnica.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {items.map((r) => {
                          const ing = ingredients.find((i) => i.id === r.ingredient_id);
                          return (
                            <li key={r.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5">
                              <span>{ing?.name ?? "—"} · <strong>{Number(r.quantity)} {ing?.unit}</strong></span>
                              <Button size="icon" variant="ghost" onClick={() => removeRecipe(r.id)}><Trash2 className="h-4 w-4" /></Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openIng} onOpenChange={setOpenIng}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} ingrediente</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Custo unitário (R$)</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
              <div><Label>Estoque atual</Label><Input type="number" step="0.001" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
              <div><Label>Estoque mínimo</Label><Input type="number" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveIngredient}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustar estoque — {adjustOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Tabs value={adjustMode} onValueChange={(v) => setAdjustMode(v as "add" | "set")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="add">Compra / saída</TabsTrigger>
                <TabsTrigger value="set">Inventário (definir)</TabsTrigger>
              </TabsList>
            </Tabs>
            <div>
              <Label>{adjustMode === "set" ? "Novo estoque" : "Quantidade (use negativo p/ saída)"}</Label>
              <Input type="number" step="0.001" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">Atual: {Number(adjustOpen?.stock ?? 0)} {adjustOpen?.unit}</p>
          </div>
          <DialogFooter><Button onClick={applyAdjust}>Aplicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recipeFor} onOpenChange={(o) => !o && setRecipeFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ficha técnica — {recipeFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ingrediente</Label>
              <Select value={recIngId} onValueChange={setRecIngId}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{ingredients.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade por unidade vendida</Label>
              <Input type="number" step="0.001" value={recQty} onChange={(e) => setRecQty(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addRecipe}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone?: "critical" | "low" }) {
  const color = tone === "critical" ? "text-destructive" : tone === "low" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
