import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Localix" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const { data: restaurant, refetch } = useQuery({
    queryKey: ["restaurant", user.id],
    queryFn: async () => (await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle()).data,
  });

  const [form, setForm] = useState({
    name: "", slug: "", description: "", whatsapp_phone: "",
    logo_url: "", cover_url: "", delivery_fee: "0", min_order: "0",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (restaurant) setForm({
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description ?? "",
      whatsapp_phone: restaurant.whatsapp_phone,
      logo_url: restaurant.logo_url ?? "",
      cover_url: restaurant.cover_url ?? "",
      delivery_fee: String(restaurant.delivery_fee ?? 0),
      min_order: String(restaurant.min_order ?? 0),
    });
  }, [restaurant]);

  if (!restaurant) return <Card className="p-8 text-center">Crie seu restaurante primeiro no painel.</Card>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("restaurants").update({
      name: form.name,
      slug: slugify(form.slug),
      description: form.description || null,
      whatsapp_phone: form.whatsapp_phone,
      logo_url: form.logo_url || null,
      cover_url: form.cover_url || null,
      delivery_fee: Number(form.delivery_fee.replace(",", ".")) || 0,
      min_order: Number(form.min_order.replace(",", ".")) || 0,
      updated_at: new Date().toISOString(),
    }).eq("id", restaurant!.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    refetch();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold">Configurações</h1>
      <p className="text-sm text-muted-foreground">Informações do estabelecimento e regras de entrega.</p>

      <Card className="mt-6 p-6">
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do estabelecimento</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>URL pública</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/r/</span>
              <Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="border-0 bg-transparent focus-visible:ring-0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp (com DDD)</Label>
            <Input required value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} placeholder="+55 11 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Taxa de entrega (R$)</Label>
              <Input value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pedido mínimo (R$)</Label>
              <Input value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL do logo</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>URL da capa</Label>
            <Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." />
          </div>
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações</Button>
        </form>
      </Card>
    </div>
  );
}
