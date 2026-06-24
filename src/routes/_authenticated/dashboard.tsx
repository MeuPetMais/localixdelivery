import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { brl, slugify } from "@/lib/format";
import { toast } from "sonner";
import { ExternalLink, Copy, ShoppingBag, UtensilsCrossed, Power, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel — Localix" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
  const navigate = useNavigate();

  const { data: restaurant, isLoading, refetch } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    enabled: !!restaurant?.id,
    queryKey: ["stats", restaurant?.id],
    queryFn: async () => {
      const [items, cats] = await Promise.all([
        supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant!.id),
        supabase.from("menu_categories").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant!.id),
      ]);
      return { items: items.count ?? 0, categories: cats.count ?? 0 };
    },
  });

  if (isLoading) return <Loader />;
  if (!restaurant) return <Onboarding ownerId={user.id} onCreated={() => refetch()} />;

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${restaurant.slug}`;

  async function toggleOpen() {
    const { error } = await supabase.from("restaurants").update({ is_open: !restaurant!.is_open }).eq("id", restaurant!.id);
    if (error) return toast.error(error.message);
    toast.success(restaurant!.is_open ? "Loja fechada" : "Loja aberta");
    refetch();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Olá, {restaurant.name} 👋</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu cardápio e compartilhe sua página de pedidos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${restaurant.is_open ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
            <span className={`h-2 w-2 rounded-full ${restaurant.is_open ? "bg-success" : "bg-destructive"} animate-pulse`} />
            {restaurant.is_open ? "Aberto" : "Fechado"}
          </div>
          <Button variant="outline" size="sm" onClick={toggleOpen}>
            <Power className="mr-2 h-4 w-4" />
            {restaurant.is_open ? "Fechar loja" : "Abrir loja"}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/30 bg-gradient-warm p-6 text-primary-foreground shadow-glow">
        <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Sua página de pedidos</p>
        <p className="mt-1 break-all font-display text-2xl font-bold">{publicUrl}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}>
            <Copy className="mr-2 h-4 w-4" /> Copiar link
          </Button>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm"><ExternalLink className="mr-2 h-4 w-4" /> Abrir</Button>
          </a>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Itens no cardápio" value={stats?.items ?? 0} icon={UtensilsCrossed} />
        <StatCard title="Categorias" value={stats?.categories ?? 0} icon={ShoppingBag} />
        <StatCard title="Taxa de entrega" value={brl(restaurant.delivery_fee)} icon={ShoppingBag} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">Próximos passos</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Adicione produtos ao seu cardápio</span>
              <Link to="/menu"><Button size="sm" variant="outline">Ir</Button></Link>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Configure WhatsApp e taxa de entrega</span>
              <Link to="/settings"><Button size="sm" variant="outline">Ajustar</Button></Link>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Compartilhe o link no Instagram</span>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado!"); }}>Copiar</Button>
            </li>
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">Dica do dia</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Pedidos com foto convertem até 3x mais. Capriche nas imagens dos seus itens mais vendidos!
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
    </Card>
  );
}

function Onboarding({ ownerId, onCreated }: { ownerId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const finalSlug = slug || slugify(name);
    const { error } = await supabase.from("restaurants").insert({
      owner_id: ownerId,
      name,
      slug: finalSlug,
      whatsapp_phone: whatsapp,
      description: description || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Restaurante criado!");
    onCreated();
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-8">
        <h1 className="font-display text-2xl font-extrabold">Vamos criar seu Localix 🍔</h1>
        <p className="mt-1 text-sm text-muted-foreground">Em menos de 1 minuto seu cardápio digital está no ar.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do estabelecimento</Label>
            <Input id="name" required value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Pizzaria do Zé" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/r/</span>
              <Input id="slug" required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="border-0 bg-transparent focus-visible:ring-0" placeholder="pizzaria-do-ze" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp para receber pedidos</Label>
            <Input id="wa" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição curta (opcional)</Label>
            <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="As melhores pizzas artesanais do bairro." />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar meu Localix
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
