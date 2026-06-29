import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";

export function OwnerOnboarding({
  ownerId,
  onCreated,
}: {
  ownerId: string;
  onCreated: () => Promise<unknown> | void;
}) {
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
    await onCreated();
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="p-8">
        <h1 className="font-display text-2xl font-extrabold">Vamos criar seu Localix 🍔</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Em menos de 1 minuto seu cardápio digital está no ar.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome do estabelecimento</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="Pizzaria do Zé"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL pública</Label>
            <div className="flex items-center rounded-md border bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="border-0 bg-transparent focus-visible:ring-0"
                placeholder="pizzaria-do-ze"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp para receber pedidos</Label>
            <Input
              id="wa"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição curta (opcional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="As melhores pizzas artesanais do bairro."
            />
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
